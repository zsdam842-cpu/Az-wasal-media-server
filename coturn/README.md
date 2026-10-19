# Wasal TURN server (coturn)

A ready-to-run TURN relay for Wasal voice/video calls.
STUN alone is not enough: calls between mobile networks and symmetric NATs fail
without a relay. This kit runs **coturn with time-limited credentials**
(TURN REST API), so no static user accounts and no passwords in clients.

> ملاحظة سريعة: لا تضع هذا الحاوية على Railway — منصة Railway تمرّر TCP فقط
> ولا تدعم UDP، وخادم TURN يحتاج منافذ UDP. استخدم سيرفرًا (VPS) بعنوان عام.

## What runs where

```
client  ──(turns:5349 / turn:3478)──►  coturn (this kit)
                                          │  relay ports UDP 49160-49200
                                          ▼
                                       the other peer
```

The media server never relays media. It only **signs** credentials:
`GET /api/calls/ice-servers` returns the STUN/TURN list with a short-lived
`username`/`credential` derived from the shared `TURN_SECRET`.

## 1. Requirements

- A host with a public IP (any 1 vCPU VPS is enough: 2–5 USD/month).
- Open inbound: `3478/udp`, `3478/tcp`, `5349/tcp`, `49160-49200/udp`.
- Docker (or Docker Compose) on that host.
- Optional but recommended: a DNS name (`turn.example.com`) + TLS certificate,
  needed to reach the relay from networks that block non-TLS ports.

## 2. Configure

```bash
cd coturn
cp .env.example .env
openssl rand -hex 32          # copy the output into TURN_SECRET
```

Edit `.env`:

| Variable | Meaning |
|---|---|
| `TURN_REALM` | Realm shown in credentials, usually your turn hostname |
| `TURN_SECRET` | Shared secret — **must equal** the media server's `TURN_SECRET` |
| `TURN_EXTERNAL_IP` | Public IP of the host (required behind NAT/hosting bridge) |
| `TURN_PORT` / `TURN_TLS_PORT` | 3478 / 5349 by default |
| `TURN_MIN_PORT` / `TURN_MAX_PORT` | Relay port range (keep it small, e.g. 40 ports) |
| `TURN_TLS_CERT` / `TURN_TLS_KEY` | Optional TLS pair |

## 3. Run

```bash
docker compose up -d --build
docker compose logs -f coturn
```

The entrypoint generates `/etc/coturn/turnserver.conf` from the environment on
every start — do not edit that file by hand.

## 4. Firewall

```bash
# ufw example (Debian/Ubuntu)
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 5349/tcp
sudo ufw allow 49160:49200/udp
sudo ufw allow 49160:49200/tcp
```

## 5. Point the media server at it

Set these on the media server deployment (see `env.example`):

```
TURN_URLS=turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349
TURN_SECRET=<the same secret as .env above>
TURN_TTL_SECONDS=3600
```

Restart the media server, then verify the credentials reach clients:

```bash
curl -s -H "Authorization: Bearer <access token>" \
  https://<media-server>/api/calls/ice-servers
```

Expected: a `turn:` entry with `username` shaped like `<expiry>:<userId>`.

## 6. Test the relay

- Browser: <https://icetest.info> or the WebRTC trickle-ICE page — a working
  TURN entry shows a `relay` candidate.
- Command line, generate a credential by hand:

```bash
EXPIRY=$(($(date +%s) + 3600))
USERNAME="${EXPIRY}:manual-test"
CREDENTIAL=$(printf '%s' "$USERNAME" | openssl dgst -binary -sha1 -hmac "$TURN_SECRET" | openssl base64)
echo "$USERNAME / $CREDENTIAL"
```

## Oracle Cloud (OCI) — one command

Ubuntu images on OCI block every port except SSH, and the instance sits behind
1:1 NAT, so coturn must be told its public **and** private address.

```bash
git clone <repo> && cd <repo>/coturn/oracle-cloud
sudo ./bootstrap.sh              # detects the IPs, opens ports, starts the relay
```

The script:

1. reads the public/private IP from the OCI metadata service (falls back to
   `api.ipify.org`; override with `sudo TURN_PUBLIC_IP=1.2.3.4 ./bootstrap.sh`);
2. installs Docker if needed;
3. inserts and persists iptables rules for `3478/tcp+udp`, `5349/tcp` and the
   relay range, then saves them to `/etc/iptables/rules.v4`;
4. writes `.env` with a random secret and `TURN_EXTERNAL_IP=<public>/<private>`;
5. builds and runs the container, then prints the exact `TURN_URLS` /
   `TURN_SECRET` values to paste into the media server.

Still manual (cannot be done from inside the instance): the **VCN Security
List** (or Network Security Group) ingress rules. Add source `0.0.0.0/0`:

| Protocol | Ports |
|---|---|
| UDP | 3478 |
| TCP | 3478 |
| TCP | 5349 |
| UDP | 49160-49200 |

With the OCI CLI configured, the same rules can be added by JSON, or in the
console: Networking → Virtual Cloud Networks → your VCN → Security Lists →
Add Ingress Rules.

### Always Free notes

- Current Always Free Ampere A1 allowance is **2 OCPU / 12 GB** (it was reduced
  from 4 OCPU / 24 GB without announcement); `VM.Standard.E2.1.Micro`
  (1 OCPU / 1 GB) is also always free — more than enough for a TURN relay.
- "Out of host capacity" is common for Always Free shapes; another availability
  domain or region usually works.
- Oracle may reclaim **idle** Always Free instances — a relay in real use stays
  active, but do not leave the box completely unused for long periods.

## Security notes

- Relay to private and loopback ranges is denied in the generated config.
- `total-quota` / `user-quota` limit abuse of the relay.
- Credentials expire (`TURN_TTL_SECONDS`, default 1 hour) and are bound to the
  user id that requested them.
- Keep `TURN_SECRET` out of git; it lives only in the deployment environment.
