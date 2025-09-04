# .devcontainer/Dockerfile
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Python 3.12 と基本ツールのインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-venv \
    python3.12-dev \
    python3-pip \
    curl \
    git \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Python と pip のデフォルト設定（Python 3.12を使う）
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1 && \
    update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

# Node.js（LTSバージョン）と npm のインストール
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# バージョン確認（デバッグ用・任意）
RUN python --version && pip --version && node -v && npm -v

# 開発用コンテナとして止まらないように
CMD ["tail", "-f", "/dev/null"]
