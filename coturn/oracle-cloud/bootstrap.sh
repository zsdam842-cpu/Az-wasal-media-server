#!/usr/bin/env bash
#
# تشغيل خادم TURN (coturn) على سيرفر Oracle Cloud يعمل بـ Ubuntu — بأمر واحد.
#
#   git clone <repo> && cd <repo>/coturn/oracle-cloud
#   sudo ./bootstrap.sh
#
# ما يفعله:
#   1) يكتشف العنوان العام والخاص (OCI يحتاج الصيغة المزدوجة).
#   2) يثبّت Docker إن لم يكن موجودًا.
#   3) يفتح المنافذ على مستوى النظام (iptables) ويحفظها — صور Ubuntu في OCI
#      تحجب كل شيء عدا SSH افتراضيًا، وهذا سبب شائع لتوقف TURN.
#   4) ينشئ ملف .env بسرّ عشوائي، ثم يبني الصورة ويشغّل الحاوية.
#   5) يطبع القيم التي تنسخها إلى خادم الوسائط.
#
# ملاحظة: يبقى عليك فتح نفس المنافذ في قائمة الأمان للشبكة (VCN Security List /
# Network Security Group) من لوحة Oracle — لا يمكن فعل ذلك من داخل السيرفر.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COTURN_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTAINER_NAME="${TURN_CONTAINER_NAME:-wasal-coturn}"
IMAGE_NAME="wasal-coturn:latest"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

if [ "${EUID}" -ne 0 ]; then
  fail "شغّل السكربت بصلاحية root:  sudo $0"
fi

if [ ! -f "${COTURN_DIR}/Dockerfile" ]; then
  fail "لم أجد Dockerfile في ${COTURN_DIR} — شغّل السكربت من مجلد coturn/oracle-cloud داخل المستودع."
fi

# ---------------------------------------------------------------- 1) العناوين
log "اكتشاف عنوان السيرفر"

PUBLIC_IP="${TURN_PUBLIC_IP:-}"
PRIVATE_IP="${TURN_PRIVATE_IP:-}"

if [ -z "${PUBLIC_IP}" ]; then
  PUBLIC_IP="$(
    curl -fsS --max-time 5 \
      -H 'Authorization: Bearer Oracle' \
      'http://169.254.169.254/opc/v2/vnics/' 2>/dev/null |
      python3 -c 'import json,sys; print(json.load(sys.stdin)[0].get("publicIp") or "")' 2>/dev/null || true
  )"
fi

if [ -z "${PUBLIC_IP}" ]; then
  PUBLIC_IP="$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)"
fi

if [ -z "${PRIVATE_IP}" ]; then
  PRIVATE_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi

[ -n "${PUBLIC_IP}" ] || fail "تعذّر اكتشاف العنوان العام. مرّره يدويًا:  sudo TURN_PUBLIC_IP=1.2.3.4 $0"
[ -n "${PRIVATE_IP}" ] || fail "تعذّر اكتشاف العنوان الخاص. مرّره يدويًا:  sudo TURN_PRIVATE_IP=10.0.0.2 $0"

echo "    العام   : ${PUBLIC_IP}"
echo "    الخاص   : ${PRIVATE_IP}"

# ------------------------------------------------------------------ 2) Docker
log "التأكد من وجود Docker"

if ! command -v docker >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y docker.io
  systemctl enable --now docker
fi

docker info >/dev/null 2>&1 || fail "خدمة Docker لا تعمل. جرّب:  sudo systemctl start docker"

# ---------------------------------------------------------------- 3) iptables
log "فتح المنافذ على مستوى النظام (iptables)"

TURN_PORT_VALUE="${TURN_PORT:-3478}"
TURN_TLS_PORT_VALUE="${TURN_TLS_PORT:-5349}"
RELAY_MIN="${TURN_MIN_PORT:-49160}"
RELAY_MAX="${TURN_MAX_PORT:-49200}"

allow_tcp() {
  local port="$1"
  if ! iptables -C INPUT -p tcp --dport "${port}" -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 1 -p tcp --dport "${port}" -j ACCEPT
    echo "    TCP ${port} ✓"
  fi
}

allow_udp() {
  local port="$1"
  if ! iptables -C INPUT -p udp --dport "${port}" -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 1 -p udp --dport "${port}" -j ACCEPT
    echo "    UDP ${port} ✓"
  fi
}

allow_udp_range() {
  local from="$1" to="$2"
  if ! iptables -C INPUT -p udp -m multiport --dports "${from}:${to}" -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 1 -p udp -m multiport --dports "${from}:${to}" -j ACCEPT
    echo "    UDP ${from}-${to} ✓"
  fi
}

allow_tcp "${TURN_PORT_VALUE}"
allow_udp "${TURN_PORT_VALUE}"
allow_tcp "${TURN_TLS_PORT_VALUE}"
allow_udp_range "${RELAY_MIN}" "${RELAY_MAX}"

mkdir -p /etc/iptables
if command -v netfilter-persistent >/dev/null 2>&1; then
  netfilter-persistent save >/dev/null 2>&1 || true
fi
iptables-save > /etc/iptables/rules.v4
echo "    حُفظت القواعد في /etc/iptables/rules.v4"

# ------------------------------------------------------------------ 4) التشغيل
log "تجهيز الإعداد وتشغيل الحاوية"

if [ ! -f "${COTURN_DIR}/.env" ]; then
  TURN_SECRET_VALUE="$(openssl rand -hex 32)"
  cat > "${COTURN_DIR}/.env" <<EOF
TURN_REALM=${TURN_REALM:-${PUBLIC_IP}}
TURN_SECRET=${TURN_SECRET_VALUE}
# الصيغة المزدوجة: العام/الخاص — إلزامية على Oracle Cloud (NAT 1:1)
TURN_EXTERNAL_IP=${PUBLIC_IP}/${PRIVATE_IP}
TURN_PORT=${TURN_PORT_VALUE}
TURN_TLS_PORT=${TURN_TLS_PORT_VALUE}
TURN_MIN_PORT=${RELAY_MIN}
TURN_MAX_PORT=${RELAY_MAX}
EOF
  chmod 600 "${COTURN_DIR}/.env"
  echo "    أُنشئ ${COTURN_DIR}/.env بسرّ عشوائي"
else
  echo "    ملف .env موجود مسبقًا — لم أغيّره"
fi

docker build -t "${IMAGE_NAME}" "${COTURN_DIR}" >/dev/null
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --env-file "${COTURN_DIR}/.env" \
  -p "${TURN_PORT_VALUE}:${TURN_PORT_VALUE}/tcp" \
  -p "${TURN_PORT_VALUE}:${TURN_PORT_VALUE}/udp" \
  -p "${TURN_TLS_PORT_VALUE}:${TURN_TLS_PORT_VALUE}/tcp" \
  -p "${RELAY_MIN}-${RELAY_MAX}:${RELAY_MIN}-${RELAY_MAX}/udp" \
  "${IMAGE_NAME}" >/dev/null

sleep 2

if docker ps --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
  echo "    الحاوية تعمل ✓"
else
  echo "    الحاوية لم تبدأ — آخر السجلات:"
  docker logs --tail 30 "${CONTAINER_NAME}" || true
  exit 1
fi

# ------------------------------------------------------------------- 5) الخلاصة
SECRET_FROM_ENV="$(grep -E '^TURN_SECRET=' "${COTURN_DIR}/.env" | cut -d= -f2-)"

cat <<EOF

================================================================
اكتمل تشغيل خادم TURN على العنوان: ${PUBLIC_IP}

خطوة أخيرة عليك (من لوحة Oracle):
  Networking → Virtual Cloud Networks → شبكتك → Security List (أو NSG)
  أضف قواعد Ingress للـ Source 0.0.0.0/0:
      UDP  ${TURN_PORT_VALUE}
      TCP  ${TURN_PORT_VALUE}
      TCP  ${TURN_TLS_PORT_VALUE}
      UDP  ${RELAY_MIN}-${RELAY_MAX}

ثم ضع هذه القيم في متغيرات بيئة خادم الوسائط وأعد نشره:

  TURN_URLS=turn:${PUBLIC_IP}:${TURN_PORT_VALUE}?transport=udp,turn:${PUBLIC_IP}:${TURN_TLS_PORT_VALUE}
  TURN_SECRET=${SECRET_FROM_ENV}
  TURN_TTL_SECONDS=3600

للمتابعة:   docker logs -f ${CONTAINER_NAME}
================================================================
EOF
