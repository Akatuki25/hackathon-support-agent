#!/bin/bash

# 環境セットアップスクリプト
# 初回デプロイ時に実行

set -e

echo "🚀 Hackathon Support Agent - 環境セットアップ"
echo "=============================================="

# 1. GitHub Secretsの設定確認
echo ""
echo "📋 Step 1: GitHub Secretsの設定を確認してください"
echo ""
echo "以下のSecretsがGitHubリポジトリに設定されている必要があります:"
echo ""
echo "  Railway関連:"
echo "    - RAILWAY_TOKEN"
echo "    - RAILWAY_PROJECT_ID"
echo "    - BACKEND_URL"
echo ""
echo "  Vercel関連:"
echo "    - VERCEL_TOKEN"
echo "    - VERCEL_ORG_ID"
echo "    - VERCEL_PROJECT_ID"
echo ""
echo "  Terraform関連:"
echo "    - TF_API_TOKEN"
echo ""
echo "  アプリケーション関連:"
echo "    - GOOGLE_API_KEY"
echo "    - NEXTAUTH_SECRET"
echo "    - GITHUB_OAUTH_ID"
echo "    - GITHUB_OAUTH_SECRET"
echo "    - FLOWER_PASSWORD"
echo ""

read -p "GitHub Secretsの設定は完了していますか？ (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 先にGitHub Secretsを設定してください"
    echo "   Settings → Secrets and variables → Actions → New repository secret"
    exit 1
fi

# 2. Terraform初期化
echo ""
echo "📦 Step 2: Terraformの初期化"
cd terraform

if [ ! -f "terraform.tfstate" ]; then
    echo "Terraformを初期化します..."
    terraform init
    echo "✅ Terraform初期化完了"
else
    echo "✅ Terraformは既に初期化済みです"
fi

# 3. Terraform Plan
echo ""
echo "🔍 Step 3: Terraform Planの実行"
echo "以下の環境変数を設定してください:"
echo "  export TF_VAR_github_repo=your-org/hackathon-support-agent"
echo "  export TF_VAR_backend_url=https://your-app.up.railway.app"
echo ""

read -p "Terraform Planを実行しますか？ (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    terraform plan -var-file=environments/prod/terraform.tfvars
fi

# 4. デプロイ手順の表示
echo ""
echo "✅ セットアップ完了！"
echo ""
echo "次のステップ:"
echo "1. Railwayプロジェクトを作成"
echo "   $ railway login"
echo "   $ railway init"
echo ""
echo "2. Neon PostgreSQLをTerraformでデプロイ"
echo "   $ cd terraform"
echo "   $ terraform apply"
echo ""
echo "3. Railwayにバックエンドをデプロイ"
echo "   $ cd ../back"
echo "   $ railway up"
echo ""
echo "4. Vercelにフロントエンドをデプロイ"
echo "   $ cd ../front"
echo "   $ vercel --prod"
echo ""
echo "5. 自動デプロイの確認"
echo "   mainブランチにpushすると自動デプロイされます"
echo ""
