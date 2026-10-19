FROM coturn/coturn:4.6.3-alpine

USER root

COPY docker-entrypoint.sh /usr/local/bin/wasal-turn-entrypoint.sh

RUN chmod +x /usr/local/bin/wasal-turn-entrypoint.sh

# 3478 = TURN/UDP+TCP، 5349 = TURN over TLS، ونطاق منافذ الترحيل
EXPOSE 3478/tcp 3478/udp 5349/tcp
EXPOSE 49160-49200/udp

ENTRYPOINT ["/usr/local/bin/wasal-turn-entrypoint.sh"]
