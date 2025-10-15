FROM python:3.12-slim

# 作業ディレクトリ
WORKDIR /app

# システムパッケージのインストール（最小限）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Pythonパッケージのインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードのコピー
COPY . .

# Supervisor設定ファイルのコピー
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ヘルスチェック用スクリプト
RUN echo '#!/bin/sh\ncurl -f http://localhost:${PORT:-8000}/ || exit 1' > /healthcheck.sh && \
    chmod +x /healthcheck.sh

# 非rootユーザーで実行
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# ポート公開（Railwayが動的に設定）
EXPOSE 8000

# デフォルトコマンド（Supervisor経由でFastAPI + Celery起動）
CMD ["/usr/local/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
