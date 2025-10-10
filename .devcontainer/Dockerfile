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



# 以降の RUN は bash -lc で実行（nvm を素直に使うため）
SHELL ["/bin/bash", "-lc"]

# ---- nvm + Node (最新安定) + pnpm セットアップ ----
# nvm は /usr/local/nvm に入れて全ユーザーから使えるように
ENV NVM_DIR=/usr/local/nvm
RUN mkdir -p "$NVM_DIR" \
 && curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# Node 最新（stable = 'node' エイリアス）を入れてデフォルト化
# さらに corepack で pnpm を最新化＆有効化
RUN source "$NVM_DIR/nvm.sh" \
 && nvm install node --latest-npm \
 && nvm alias default node \
 && corepack enable \
 && corepack prepare pnpm@latest --activate \
 # nvm 管理の node/npm/pnpm をパスの通った場所にシンボリックリンク
 && ln -s "$NVM_DIR/versions/node/$(nvm version)/bin/node"    /usr/local/bin/node \
 && ln -s "$NVM_DIR/versions/node/$(nvm version)/bin/npm"     /usr/local/bin/npm \
 && ln -s "$NVM_DIR/versions/node/$(nvm version)/bin/npx"     /usr/local/bin/npx \
 && ln -s "$NVM_DIR/versions/node/$(nvm version)/bin/corepack" /usr/local/bin/corepack \
 && ln -s "$NVM_DIR/versions/node/$(nvm version)/bin/pnpm"    /usr/local/bin/pnpm

# ---- バージョン確認（ログ出力用）----
RUN python --version && pip --version && node -v && npm -v && pnpm -v




# バージョン確認（デバッグ用・任意）
RUN python --version && pip --version && node -v && npm -v

# Phase 3: Python依存パッケージのインストール（Celery含む）
COPY back/requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt --break-system-packages && rm /tmp/requirements.txt

# 開発用コンテナとして止まらないように
CMD ["tail", "-f", "/dev/null"]
