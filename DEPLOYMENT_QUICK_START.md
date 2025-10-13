# デプロイクイックスタートガイド

**最終更新**: 2025-10-11
**構成**: Railway (Backend) + Vercel (Frontend) + Neon (PostgreSQL)
**月額コスト**: $5-15

---

## 🎯 構成概要

```
Frontend:  https://<project>.vercel.app          ($0/月)
Backend:   https://<project>.up.railway.app      ($5-15/月)
Database:  Neon PostgreSQL                       ($0/月)
──────────────────────────────────────────────────────
合計:      $5-15/月
```

---

## 📋 前提条件

- GitHubアカウント
- Railway アカウント ([railway.app](https://railway.app))
- Vercel アカウント ([vercel.com](https://vercel.com))
- Neon アカウント ([neon.tech](https://neon.tech))
- Terraform Cloud アカウント（推奨）

---

## 🚀 初回デプロイ手順

### 1. GitHub Secretsの設定

リポジトリの `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

#### 必須Secrets

```bash
# Railway
RAILWAY_TOKEN=<Railwayダッシュボード → Account Settings → Tokens>
RAILWAY_PROJECT_ID=<Railwayプロジェクト作成後に取得>
BACKEND_URL=https://your-app.up.railway.app

# Vercel
VERCEL_TOKEN=<Vercelダッシュボード → Settings → Tokens>
VERCEL_ORG_ID=<Vercelプロジェクト → Settings → General>
VERCEL_PROJECT_ID=<Vercelプロジェクト → Settings → General>

# Terraform
TF_API_TOKEN=<Terraform Cloud → User Settings → Tokens>

# アプリケーション
GOOGLE_API_KEY=<Google AI Studio>
NEXTAUTH_SECRET=<32文字以上のランダム文字列>
GITHUB_OAUTH_ID=<GitHub OAuth App>
GITHUB_OAUTH_SECRET=<GitHub OAuth App>
FLOWER_PASSWORD=<Flower監視UI用パスワード>
```

#### NEXTAUTH_SECRETの生成

```bash
openssl rand -base64 32
```

### 2. GitHub OAuth Appの作成

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. 設定:
   ```
   Application name: Hackathon Support Agent
   Homepage URL: https://your-app.vercel.app
   Authorization callback URL: https://your-app.vercel.app/api/auth/callback/github
   ```
3. Client IDとClient Secretをコピー → GitHub Secretsに設定

### 3. Neon PostgreSQLのセットアップ（Terraform）

```bash
# Terraformディレクトリに移動
cd terraform

# 初期化
terraform init

# 環境変数ファイルを編集
# environments/prod/terraform.tfvars
# github_repo と backend_url を実際の値に変更

# 環境変数を設定
export TF_VAR_nextauth_secret="<NEXTAUTH_SECRET>"
export TF_VAR_github_oauth_id="<GITHUB_OAUTH_ID>"
export TF_VAR_github_oauth_secret="<GITHUB_OAUTH_SECRET>"

# プラン確認
terraform plan -var-file=environments/prod/terraform.tfvars

# デプロイ
terraform apply -var-file=environments/prod/terraform.tfvars

# DATABASE_URLを取得
terraform output -raw neon_database_url
```

### 4. Railwayプロジェクトの作成

```bash
# Railway CLIインストール
npm install -g @railway/cli

# ログイン
railway login

# プロジェクト作成
cd back
railway init

# プロジェクトIDを取得
railway status

# GitHub Secretsに RAILWAY_PROJECT_ID を設定
```

#### Railwayダッシュボードで環境変数を設定

```bash
DATABASE_URL=<Terraformで取得したNeon接続文字列>
GOOGLE_API_KEY=<Google Gemini API Key>
FLOWER_PASSWORD=<Flower監視UI用パスワード>
```

#### Railway支出上限の設定

1. Railway Dashboard → Project → Settings → Usage
2. Budget Limit: $20/月 を設定

### 5. Railwayへ初回デプロイ

```bash
cd back
railway up
```

デプロイ完了後、URLを確認:
```bash
railway status
# または Railway Dashboard → Deployments → Domain
```

取得したURLを `BACKEND_URL` としてGitHub Secretsに設定

### 6. Vercelプロジェクトの作成

```bash
# Vercel CLIインストール
npm install -g vercel

# ログイン
vercel login

# プロジェクト作成
cd front
vercel

# 本番デプロイ
vercel --prod
```

#### Vercelダッシュボードで環境変数を設定

1. Vercel Dashboard → Project → Settings → Environment Variables

```bash
NEXT_PUBLIC_API_URL=<BACKEND_URL>
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=<NEXTAUTH_SECRET>
GITHUB_ID=<GITHUB_OAUTH_ID>
GITHUB_SECRET=<GITHUB_OAUTH_SECRET>
```

### 7. データベース初期化

```bash
# Railwayで実行
railway run python create_tables.py
```

---

## 🔄 自動デプロイの確認

### mainブランチへのpushで自動デプロイ

```bash
git add .
git commit -m "feat: 新機能追加"
git push origin main
```

以下が自動実行されます:
1. Backend → Railway にデプロイ
2. Frontend → Vercel にデプロイ
3. Infrastructure → Terraform Apply（terraform/配下の変更時のみ）

---

## 📊 コスト監視

### 手動チェック

```bash
./scripts/cost-check.sh
```

### Railway使用量の確認

```bash
railway status
```

または Railway Dashboard → Usage

### Vercel使用量の確認

```bash
vercel inspect
```

または Vercel Dashboard → Usage

---

## 🔍 ログ確認

### Backend（Railway）

```bash
railway logs
```

または Railway Dashboard → Deployments → Logs

### Frontend（Vercel）

```bash
vercel logs https://your-app.vercel.app
```

### Celery監視（Flower）

```
https://your-app.up.railway.app:5555
ID: admin
PW: <FLOWER_PASSWORD>
```

---

## 🐛 トラブルシューティング

### Railwayデプロイが失敗する

```bash
# ログ確認
railway logs

# 再デプロイ
railway up

# ヘルスチェック
curl https://your-app.up.railway.app/
```

### Neon接続エラー

```bash
# 接続文字列確認
terraform output neon_database_url

# 手動接続テスト
psql $(terraform output -raw neon_database_url)
```

### Vercelビルドエラー

```bash
# ローカルでビルドテスト
cd front
npm run build

# 環境変数確認
vercel env ls
```

---

## 📚 関連ドキュメント

- [詳細デプロイ設計書](./DEPLOYMENT_DESIGN.md)
- [アーキテクチャ設計](./ARCHITECTURE_DESIGN_ANALYSIS.md)
- [API仕様](./back/README.md)

---

**作成**: Claude Code
**最終更新**: 2025-10-11
