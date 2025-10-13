# Production環境設定

project_name = "hackathon-support-agent"
environment  = "prod"
neon_region  = "aws-ap-southeast-1" # シンガポール

# GitHubリポジトリ（要変更）
github_repo = "Akatuki25/hackathon-support-agent"

# Railway BackendのURL（デプロイ後に更新）
backend_url = "https://hackathon-agent-api.up.railway.app"

# シークレットはGitHub Secretsまたは環境変数から注入
# nextauth_secret        = ""  # TF_VAR_nextauth_secretで設定
# gh_oauth_client_id     = ""  # TF_VAR_gh_oauth_client_idで設定
# gh_oauth_client_secret = ""  # TF_VAR_gh_oauth_client_secretで設定
