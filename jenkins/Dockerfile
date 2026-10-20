FROM jenkins/jenkins:lts

USER root

ARG DOCKER_COMPOSE_VERSION=v5.6.0
ARG DOCKER_COMPOSE_SHA256=40343e21ca777173e69cff5dbafeb37c6f81f3b0d57d9e597f036e95eb63e76a

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       docker-cli \
       docker-buildx \
       curl \
       ca-certificates \
    && mkdir -p /usr/local/lib/docker/cli-plugins \
    && curl -fL \
       "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" \
       -o /usr/local/lib/docker/cli-plugins/docker-compose \
    && echo "${DOCKER_COMPOSE_SHA256}  /usr/local/lib/docker/cli-plugins/docker-compose" | sha256sum -c - \
    && chmod +x /usr/local/lib/docker/cli-plugins/docker-compose \
    && rm -rf /var/lib/apt/lists/*

USER jenkins
