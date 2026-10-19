#!/bin/sh
# يبني إعداد coturn من متغيرات البيئة ثم يشغّل الخادم.
set -eu

CONF_PATH="${TURN_CONFIG_PATH:-/etc/coturn/turnserver.conf}"

REALM="${TURN_REALM:-wasal.local}"
LISTENING_PORT="${TURN_PORT:-3478}"
TLS_PORT="${TURN_TLS_PORT:-5349}"
MIN_PORT="${TURN_MIN_PORT:-49160}"
MAX_PORT="${TURN_MAX_PORT:-49200}"
EXTERNAL_IP="${TURN_EXTERNAL_IP:-}"
TLS_CERT="${TURN_TLS_CERT:-}"
TLS_KEY="${TURN_TLS_KEY:-}"

if [ -z "${TURN_SECRET:-}" ]; then
  echo "TURN_SECRET is required (must match the media server secret)." >&2
  exit 1
fi

{
  echo "realm=${REALM}"
  echo "server-name=${REALM}"
  echo "listening-port=${LISTENING_PORT}"
  echo "listening-ip=0.0.0.0"

  # بيانات اعتماد مؤقتة: نفس السرّ المشترك مع خادم الوسائط (TURN REST API).
  echo "use-auth-secret"
  echo "static-auth-secret=${TURN_SECRET}"
  echo "stale-nonce=600"

  # نطاق منافذ الترحيل (افتحها في جدار الحماية للـ UDP)
  echo "min-port=${MIN_PORT}"
  echo "max-port=${MAX_PORT}"

  # حماية: منع ترحيل الحزم إلى الشبكات الداخلية والعناوين المحلية
  echo "denied-peer-ip=0.0.0.0-0.255.255.255"
  echo "denied-peer-ip=10.0.0.0-10.255.255.255"
  echo "denied-peer-ip=127.0.0.0-127.255.255.255"
  echo "denied-peer-ip=169.254.0.0-169.254.255.255"
  echo "denied-peer-ip=172.16.0.0-172.31.255.255"
  echo "denied-peer-ip=192.168.0.0-192.168.255.255"
  echo "no-multicast-peers"

  echo "fingerprint"
  echo "total-quota=100"
  echo "user-quota=12"
  echo "no-cli"
  echo "simple-log"
  echo "log-file=stdout"

  if [ -n "${EXTERNAL_IP}" ]; then
    echo "external-ip=${EXTERNAL_IP}"
  fi

  if [ -n "${TLS_CERT}" ] && [ -n "${TLS_KEY}" ]; then
    echo "tls-listening-port=${TLS_PORT}"
    echo "cert=${TLS_CERT}"
    echo "pkey=${TLS_KEY}"
    echo "no-tlsv1"
    echo "no-tlsv1_1"
  fi
} > "${CONF_PATH}"

echo "starting coturn: realm=${REALM} port=${LISTENING_PORT} relay=${MIN_PORT}-${MAX_PORT}"

exec turnserver -c "${CONF_PATH}"
