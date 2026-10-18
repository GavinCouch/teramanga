# Official Suwayomi release, pinned to its verified image digest.
FROM ghcr.io/suwayomi/tachidesk:v2.4.2366@sha256:1fac27c387dc2ea9949e1a01ad7f6d6de9d72d3988338a95476748e5c45c4582
USER root
COPY backend/start.sh /usr/local/bin/teramanga-server
RUN chmod 755 /usr/local/bin/teramanga-server
ENV WEB_UI_ENABLED=false \
    BIND_IP=0.0.0.0 \
    AUTH_MODE=BASIC_AUTH \
    AUTH_USERNAME=reader \
    KCEF_ENABLED=false \
    JAVA_TOOL_OPTIONS="-Xms32m -Xmx160m -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=32m -XX:MaxDirectMemorySize=32m -Xss512k -XX:ActiveProcessorCount=2"
ENTRYPOINT ["tini", "--"]
CMD ["/usr/local/bin/teramanga-server"]
