FROM ubuntu:latest

# 環境変数でタイムゾーン設定を自動化
ENV DEBIAN_FRONTEND=noninteractive

# curlをダウンロードする
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    software-properties-common \
    build-essential \
    curl \
    && add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update
# Pythonのインストール
RUN apt-get install -y --no-install-recommends \
    python3.11\
    python3.11-venv \
    python3.11-dev \
    python3-pip

# Python3 をデフォルトの `python` コマンドに設定
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 && \
    update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

# node_modulesのインストール
RUN apt install -y nodejs npm && npm install n -g \
    && n stable \
    && apt purge -y nodejs npm \
    && apt autoremove -y \
    && n stable



# キャッシュを削除してイメージサイズを小さくする。
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# gitのダウンロード
RUN apt-get update && apt-get install -y git

# コンテナが終了しないように tail -f /dev/null を実行
CMD ["tail", "-f", "/dev/null"]