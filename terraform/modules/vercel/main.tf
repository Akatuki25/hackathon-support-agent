terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
  }
}

# Vercelプロジェクト
resource "vercel_project" "frontend" {
  name      = "${var.project_name}-${var.environment}"
  framework = "nextjs"

  git_repository = {
    type = "github"
    repo = var.github_repo
  }

  root_directory = "front"

  build_command    = "npm run build"
  output_directory = ".next"
  install_command  = "npm install"
}

# 環境変数（Production）
resource "vercel_project_environment_variable" "api_url" {
  project_id = vercel_project.frontend.id
  key        = "NEXT_PUBLIC_API_URL"
  value      = var.backend_url
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "nextauth_url" {
  project_id = vercel_project.frontend.id
  key        = "NEXTAUTH_URL"
  value      = "https://${vercel_project.frontend.name}.vercel.app"
  target     = ["production"]
}

resource "vercel_project_environment_variable" "nextauth_secret" {
  project_id = vercel_project.frontend.id
  key        = "NEXTAUTH_SECRET"
  value      = var.nextauth_secret
  target     = ["production", "preview"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "github_id" {
  project_id = vercel_project.frontend.id
  key        = "GITHUB_ID"
  value      = var.gh_oauth_client_id
  target     = ["production", "preview"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "github_secret" {
  project_id = vercel_project.frontend.id
  key        = "GITHUB_SECRET"
  value      = var.gh_oauth_client_secret
  target     = ["production", "preview"]
  sensitive  = true
}

# ローカル開発用環境変数
resource "vercel_project_environment_variable" "dev_api_url" {
  project_id = vercel_project.frontend.id
  key        = "NEXT_PUBLIC_API_URL"
  value      = "http://localhost:8000"
  target     = ["development"]
}
