# デプロイ設計書

**作成日**: 2025-10-11
**対象システム**: ハッカソンサポートエージェント
**デプロイ先**: Railway (Backend) + Neon (PostgreSQL) + Vercel (Frontend)
**目標コスト**: $5-15/月

---

## 📋 目次

1. [システムアーキテクチャ](#システムアーキテクチャ)
2. [ディレクトリ構成](#ディレクトリ構成)
3. [Infrastructure as Code (Terraform)](#infrastructure-as-code-terraform)
4. [Docker構成の最適化](#docker構成の最適化)
5. [CI/CD パイプライン](#cicd-パイプライン)
6. [環境変数管理](#環境変数管理)
7. [コスト監視とアラート](#コスト監視とアラート)
8. [デプロイ手順](#デプロイ手順)
9. [運用・監視](#運用監視)
10. [トラブルシューティング](#トラブルシューティング)

---

## システムアーキテクチャ

### 全体構成図

```
┌──────────────────────────────────────────────────┐
│              GitHub Repository                    │
│  ├─ /front  (Next.js)                            │
│  ├─ /back   (FastAPI + Celery)                   │
│  └─ /terraform (IaC)                             │
└──────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ↓                       ↓
┌──────────────┐      ┌──────────────────┐
│   Vercel     │      │   Railway        │
│   (Frontend) │──────→  (Backend)       │
└──────────────┘      └──────────────────┘
                              │
                              ↓
                      ┌──────────────┐
                      │ Neon (DB)    │
                      └──────────────┘
```

### コンポーネント詳細

#### 1. Frontend (Vercel)
- **フレームワーク**: Next.js 15 (App Router)
- **認証**: NextAuth.js (GitHub OAuth)
- **状態管理**: SWR
- **料金**: $0/月 (Hobby Plan)

#### 2. Backend (Railway)
- **API**: FastAPI (Uvicorn)
- **非同期処理**: Celery + Redis
- **ワーカー数**: 3並列
- **監視**: Flower
- **料金**: $5-15/月 (Hobby Plan + 従量課金)

#### 3. Database (Neon PostgreSQL)
- **容量**: 0.5GB (無料枠)
- **ブランチ**: main (prod), dev
- **料金**: $0/月 (無料枠内)

---

## ディレクトリ構成

```
hackathon-support-agent/
├── front/                          # Next.js フロントエンド
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   └── .env.local (gitignore)
│
├── back/                           # FastAPI バックエンド
│   ├── app.py                      # メインアプリ
│   ├── celery_app.py               # Celery設定
│   ├── database.py                 # DB接続
│   ├── routers/                    # APIエンドポイント
│   ├── services/                   # ビジネスロジック
│   ├── models/                     # SQLAlchemyモデル
│   ├── requirements.txt
│   ├── Dockerfile                  # 本番用
│   ├── Dockerfile.dev              # 開発用
│   ├── docker-compose.yml          # ローカル開発用
│   ├── docker-compose.railway.yml  # Railway用
│   └── .env (gitignore)
│
├── terraform/                      # Infrastructure as Code
│   ├── main.tf                     # エントリーポイント
│   ├── variables.tf                # 変数定義
│   ├── outputs.tf                  # 出力値
│   ├── backend.tf                  # Terraformステート管理
│   │
│   ├── modules/
│   │   ├── neon/                   # Neon PostgreSQL
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   │
│   │   ├── vercel/                 # Vercel Project
│   │   │   ├── main.tf
│   │   │   ├── env_vars.tf
│   │   │   └── outputs.tf
│   │   │
│   │   └── monitoring/             # アラート設定
│   │       ├── main.tf
│   │       └── outputs.tf
│   │
│   └── environments/
│       ├── dev/
│       │   └── terraform.tfvars
│       └── prod/
│           └── terraform.tfvars
│
├── railway/                        # Railway設定
│   ├── railway.json                # Railway設定
│   ├── railway.toml                # サービス定義
│   └── nixpacks.toml               # ビルド設定（オプション）
│
├── .github/
│   └── workflows/
│       ├── deploy-backend.yml      # Backend CI/CD
│       ├── deploy-frontend.yml     # Frontend CI/CD
│       ├── terraform-plan.yml      # Terraform Plan (PR時)
│       └── terraform-apply.yml     # Terraform Apply (merge時)
│
├── docs/
│   ├── DEPLOYMENT_DESIGN.md        # このファイル
│   ├── API_ENDPOINTS.md            # API仕様
│   └── TROUBLESHOOTING.md          # トラブルシューティング
│
├── scripts/
│   ├── setup-local.sh              # ローカル環境セットアップ
│   ├── deploy-railway.sh           # Railway手動デプロイ
│   ├── db-migrate.sh               # DBマイグレーション
│   └── cost-check.sh               # コスト確認スクリプト
│
├── .gitignore
├── README.md
└── CLAUDE.md
```

---

## Infrastructure as Code (Terraform)

### Terraform構成の設計思想

1. **モジュール化**: 再利用可能なモジュール設計
2. **環境分離**: dev/prod環境の完全分離
3. **ステート管理**: Terraform Cloudでリモート管理
4. **セキュリティ**: シークレットはGitHub Secretsで管理

### 対応状況

| サービス | Terraform対応 | 管理方法 |
|---------|--------------|---------|
| Neon PostgreSQL | ✅ 完全対応 | Terraform Provider |
| Vercel | ✅ 完全対応 | Terraform Provider |
| Railway | ❌ 非対応 | railway.json + GitHub Actions |

### Neon PostgreSQL Terraform構成

```hcl
# terraform/modules/neon/main.tf

terraform {
  required_providers {
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.2.0"
    }
  }
}

resource "neon_project" "main" {
  name               = var.project_name
  region_id          = var.region  # aws-ap-southeast-1 (Singapore)
  pg_version         = 16

  default_endpoint_settings {
    autoscaling_limit_min_cu = 0.25
    autoscaling_limit_max_cu = 2
    suspend_timeout_seconds  = 300  # 5分でスケールtoゼロ
  }
}

resource "neon_branch" "main" {
  project_id = neon_project.main.id
  name       = "main"
}

resource "neon_branch" "dev" {
  project_id = neon_project.main.id
  parent_id  = neon_branch.main.id
  name       = "dev"
}

resource "neon_endpoint" "main" {
  project_id = neon_project.main.id
  branch_id  = neon_branch.main.id
  type       = "read_write"

  autoscaling_limit_min_cu = 0.25
  autoscaling_limit_max_cu = 2
}

resource "neon_endpoint" "dev" {
  project_id = neon_project.main.id
  branch_id  = neon_branch.dev.id
  type       = "read_write"

  autoscaling_limit_min_cu = 0.25
  autoscaling_limit_max_cu = 1
}

resource "neon_database" "main" {
  project_id = neon_project.main.id
  branch_id  = neon_branch.main.id
  name       = "hackathon_support_agent"
  owner_name = "neondb_owner"
}
```

### Vercel Terraform構成

```hcl
# terraform/modules/vercel/main.tf

terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
  }
}

resource "vercel_project" "frontend" {
  name      = var.project_name
  framework = "nextjs"

  git_repository = {
    type = "github"
    repo = var.github_repo
  }

  root_directory = "front"

  environment = [
    {
      key    = "NEXT_PUBLIC_API_URL"
      value  = var.backend_url
      target = ["production", "preview"]
    },
    {
      key    = "NEXTAUTH_URL"
      value  = "https://${var.project_name}.vercel.app"
      target = ["production"]
    },
    {
      key       = "NEXTAUTH_SECRET"
      value     = var.nextauth_secret
      target    = ["production", "preview"]
      sensitive = true
    },
    {
      key       = "GITHUB_ID"
      value     = var.github_oauth_id
      target    = ["production", "preview"]
      sensitive = true
    },
    {
      key       = "GITHUB_SECRET"
      value     = var.github_oauth_secret
      target    = ["production", "preview"]
      sensitive = true
    }
  ]
}

resource "vercel_project_domain" "frontend" {
  project_id = vercel_project.frontend.id
  domain     = "${var.project_name}.vercel.app"
}
```

---

## Docker構成の最適化

### Railway用docker-compose.yml

Railway向けに最適化したdocker-compose構成：

```yaml
# back/docker-compose.railway.yml

version: '3.8'

services:
  # FastAPI Application
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379/0
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - PYTHONUNBUFFERED=1
    depends_on:
      - redis
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.25'
          memory: 512M
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Celery Worker 1
  celery-worker-1:
    build:
      context: .
      dockerfile: Dockerfile
    command: celery -A celery_app worker --loglevel=info --concurrency=1 --hostname=worker1@%h
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379/0
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - PYTHONUNBUFFERED=1
      - CELERYD_MAX_TASKS_PER_CHILD=100
      - CELERY_TASK_TIME_LIMIT=600
      - CELERY_TASK_SOFT_TIME_LIMIT=540
    depends_on:
      - redis
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 1G
        reservations:
          cpus: '0.1'
          memory: 256M
    restart: unless-stopped

  # Celery Worker 2
  celery-worker-2:
    build:
      context: .
      dockerfile: Dockerfile
    command: celery -A celery_app worker --loglevel=info --concurrency=1 --hostname=worker2@%h
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379/0
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - PYTHONUNBUFFERED=1
      - CELERYD_MAX_TASKS_PER_CHILD=100
      - CELERY_TASK_TIME_LIMIT=600
      - CELERY_TASK_SOFT_TIME_LIMIT=540
    depends_on:
      - redis
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 1G
        reservations:
          cpus: '0.1'
          memory: 256M
    restart: unless-stopped

  # Celery Worker 3
  celery-worker-3:
    build:
      context: .
      dockerfile: Dockerfile
    command: celery -A celery_app worker --loglevel=info --concurrency=1 --hostname=worker3@%h
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379/0
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - PYTHONUNBUFFERED=1
      - CELERYD_MAX_TASKS_PER_CHILD=100
      - CELERY_TASK_TIME_LIMIT=600
      - CELERY_TASK_SOFT_TIME_LIMIT=540
    depends_on:
      - redis
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 1G
        reservations:
          cpus: '0.1'
          memory: 256M
    restart: unless-stopped

  # Redis (Broker & Result Backend)
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 512M
        reservations:
          cpus: '0.05'
          memory: 128M
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  # Flower (Celery Monitoring)
  flower:
    build:
      context: .
      dockerfile: Dockerfile
    command: celery -A celery_app flower --port=5555 --basic_auth=admin:${FLOWER_PASSWORD}
    ports:
      - "5555:5555"
    environment:
      - REDIS_URL=redis://redis:6379/0
      - FLOWER_UNAUTHENTICATED_API=false
    depends_on:
      - redis
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 512M
    restart: unless-stopped

volumes:
  redis_data:
    driver: local
```

### 最適化されたDockerfile

```dockerfile
# back/Dockerfile

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

# ヘルスチェック用スクリプト
RUN echo '#!/bin/sh\ncurl -f http://localhost:8000/ || exit 1' > /healthcheck.sh && \
    chmod +x /healthcheck.sh

# 非rootユーザーで実行
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# ポート公開
EXPOSE 8000

# デフォルトコマンド（FastAPI）
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### Railway設定ファイル

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "docker-compose -f docker-compose.railway.yml up",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/",
    "healthcheckTimeout": 100
  }
}
```

---

## CI/CD パイプライン

### Backend (Railway) デプロイ

```yaml
# .github/workflows/deploy-backend.yml

name: Deploy Backend to Railway

on:
  push:
    branches:
      - main
    paths:
      - 'back/**'
      - '.github/workflows/deploy-backend.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy to Railway
        working-directory: ./back
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          railway up --service backend

      - name: Run Database Migrations
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          railway run python back/create_tables.py

      - name: Health Check
        run: |
          sleep 30
          curl -f https://your-backend-url.railway.app/ || exit 1

      - name: Notify Deployment
        if: success()
        run: echo "✅ Backend deployed successfully"
```

### Frontend (Vercel) デプロイ

```yaml
# .github/workflows/deploy-frontend.yml

name: Deploy Frontend to Vercel

on:
  push:
    branches:
      - main
    paths:
      - 'front/**'
      - '.github/workflows/deploy-frontend.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Pull Vercel Environment
        working-directory: ./front
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build Project
        working-directory: ./front
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy to Vercel
        working-directory: ./front
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Health Check
        run: |
          sleep 20
          curl -f https://your-app.vercel.app/ || exit 1
```

### Terraform Plan/Apply

```yaml
# .github/workflows/terraform-plan.yml

name: Terraform Plan

on:
  pull_request:
    paths:
      - 'terraform/**'

jobs:
  plan:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.6.0

      - name: Terraform Init
        working-directory: ./terraform
        env:
          TF_CLOUD_TOKEN: ${{ secrets.TF_CLOUD_TOKEN }}
        run: terraform init

      - name: Terraform Format Check
        working-directory: ./terraform
        run: terraform fmt -check

      - name: Terraform Validate
        working-directory: ./terraform
        run: terraform validate

      - name: Terraform Plan
        working-directory: ./terraform
        env:
          TF_VAR_neon_api_key: ${{ secrets.NEON_API_KEY }}
          TF_VAR_vercel_token: ${{ secrets.VERCEL_TOKEN }}
          TF_VAR_github_oauth_id: ${{ secrets.GITHUB_OAUTH_ID }}
          TF_VAR_github_oauth_secret: ${{ secrets.GITHUB_OAUTH_SECRET }}
        run: terraform plan -out=tfplan

      - name: Comment PR with Plan
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('terraform/tfplan.txt', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Terraform Plan\n\`\`\`\n${plan}\n\`\`\``
            });
```

```yaml
# .github/workflows/terraform-apply.yml

name: Terraform Apply

on:
  push:
    branches:
      - main
    paths:
      - 'terraform/**'

jobs:
  apply:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.6.0

      - name: Terraform Init
        working-directory: ./terraform
        env:
          TF_CLOUD_TOKEN: ${{ secrets.TF_CLOUD_TOKEN }}
        run: terraform init

      - name: Terraform Apply
        working-directory: ./terraform
        env:
          TF_VAR_neon_api_key: ${{ secrets.NEON_API_KEY }}
          TF_VAR_vercel_token: ${{ secrets.VERCEL_TOKEN }}
          TF_VAR_github_oauth_id: ${{ secrets.GITHUB_OAUTH_ID }}
          TF_VAR_github_oauth_secret: ${{ secrets.GITHUB_OAUTH_SECRET }}
        run: terraform apply -auto-approve

      - name: Output Connection Strings
        working-directory: ./terraform
        run: |
          echo "DATABASE_URL=$(terraform output -raw database_url)" >> $GITHUB_ENV
          echo "VERCEL_URL=$(terraform output -raw vercel_url)" >> $GITHUB_ENV
```

---

## 環境変数管理

### GitHub Secrets設定

```bash
# Railway
RAILWAY_TOKEN=<Railway API Token>

# Neon
NEON_API_KEY=<Neon API Key>
DATABASE_URL=<Neon PostgreSQL Connection String>

# Vercel
VERCEL_TOKEN=<Vercel API Token>
VERCEL_ORG_ID=<Vercel Organization ID>
VERCEL_PROJECT_ID=<Vercel Project ID>

# Terraform Cloud
TF_CLOUD_TOKEN=<Terraform Cloud Token>

# Application Secrets
GOOGLE_API_KEY=<Google Gemini API Key>
NEXTAUTH_SECRET=<Random 32-char string>
GITHUB_OAUTH_ID=<GitHub OAuth App ID>
GITHUB_OAUTH_SECRET=<GitHub OAuth App Secret>
FLOWER_PASSWORD=<Flower監視UI Password>
```

### Railway環境変数

Railway Dashboard → Service → Variables で設定:

```bash
DATABASE_URL=${NEON_DATABASE_URL}
REDIS_URL=redis://redis:6379/0
GOOGLE_API_KEY=${GOOGLE_API_KEY}
PYTHONUNBUFFERED=1
```

### Vercel環境変数

Vercel Dashboard → Project → Settings → Environment Variables:

```bash
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_NEXT_API_URL=https://your-app.vercel.app/api
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
GITHUB_ID=${GITHUB_OAUTH_ID}
GITHUB_SECRET=${GITHUB_OAUTH_SECRET}
```

---

## コスト監視とアラート

### Railway支出上限設定

```bash
# Railway Dashboard
Settings → Usage → Budget Limit
設定: $20/月
```

### コスト監視スクリプト

```bash
#!/bin/bash
# scripts/cost-check.sh

# Railway使用量チェック
echo "=== Railway Usage ==="
railway status --json | jq '.usage'

# Neon使用量チェック
echo "=== Neon Storage Usage ==="
# Neon APIで確認
curl -H "Authorization: Bearer $NEON_API_KEY" \
  https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/consumption_history

# Vercel使用量チェック
echo "=== Vercel Bandwidth Usage ==="
vercel inspect --token=$VERCEL_TOKEN
```

### アラート設定（GitHub Actions）

```yaml
# .github/workflows/cost-alert.yml

name: Cost Alert Check

on:
  schedule:
    - cron: '0 0 * * *'  # 毎日0時に実行

jobs:
  check-costs:
    runs-on: ubuntu-latest

    steps:
      - name: Check Railway Usage
        run: |
          # Railway APIで使用量確認
          # 閾値超過時にSlack通知等

      - name: Check Neon Storage
        run: |
          # Neon APIでストレージ確認
          # 0.4GB超過時にアラート
```

---

## デプロイ手順

### 初回セットアップ

```bash
# 1. リポジトリクローン
git clone https://github.com/your-org/hackathon-support-agent.git
cd hackathon-support-agent

# 2. Terraform初期化
cd terraform
terraform init
terraform plan
terraform apply

# 3. GitHub Secrets設定
# GitHubリポジトリのSettings → Secrets and variables → Actions
# 上記「GitHub Secrets設定」を参照して登録

# 4. Railway初回デプロイ
cd ../back
railway login
railway link
railway up

# 5. Vercel初回デプロイ
cd ../front
vercel login
vercel --prod

# 6. データベース初期化
railway run python create_tables.py
```

### 通常のデプロイフロー

```bash
# mainブランチへのpushで自動デプロイ
git add .
git commit -m "feat: 新機能追加"
git push origin main

# GitHub Actionsが自動実行:
# 1. Backend → Railway
# 2. Frontend → Vercel
# 3. Terraform → Infrastructure更新
```

---

## 運用・監視

### ログ確認

```bash
# Railway
railway logs --service api
railway logs --service celery-worker-1

# Vercel
vercel logs https://your-app.vercel.app

# Flower (Celery監視)
# https://your-backend.railway.app:5555
# ID: admin / PW: ${FLOWER_PASSWORD}
```

### ヘルスチェック

```bash
# Backend API
curl https://your-backend.railway.app/

# Frontend
curl https://your-app.vercel.app/

# Database接続確認
psql $DATABASE_URL -c "SELECT version();"
```

### データベースバックアップ

Neonは自動バックアップ（6時間分）を提供。
手動バックアップスクリプト:

```bash
#!/bin/bash
# scripts/db-backup.sh

pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## トラブルシューティング

### Railway デプロイ失敗

```bash
# ログ確認
railway logs --service api

# 再デプロイ
railway up --service api

# ヘルスチェック確認
railway status
```

### Neon 接続エラー

```bash
# 接続文字列確認
echo $DATABASE_URL

# 手動接続テスト
psql $DATABASE_URL

# Neonダッシュボードで稼働状態確認
# https://console.neon.tech/
```

### Celery タスクが実行されない

```bash
# Redisの動作確認
railway run redis-cli ping

# Celeryワーカー状態確認
# Flowerで確認: https://your-backend.railway.app:5555

# ワーカー再起動
railway restart --service celery-worker-1
```

---

**最終更新**: 2025-10-11
**作成者**: Claude Code
