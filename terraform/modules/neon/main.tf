terraform {
  required_providers {
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.2.0"
    }
  }
}

# Neonプロジェクト
resource "neon_project" "main" {
  name                     = "${var.project_name}-${var.environment}"
  region_id                = var.region
  pg_version               = 15
  history_retention_seconds = 21600 # 無料枠の上限: 6時間
}

# メインブランチ
resource "neon_branch" "main" {
  project_id = neon_project.main.id
  name       = "main"
}

# 開発ブランチ（dev環境のみ）
resource "neon_branch" "dev" {
  count      = var.environment == "dev" ? 1 : 0
  project_id = neon_project.main.id
  parent_id  = neon_branch.main.id
  name       = "dev"
}

# メインエンドポイント
resource "neon_endpoint" "main" {
  project_id = neon_project.main.id
  branch_id  = neon_branch.main.id
  type       = "read_write"

  autoscaling_limit_min_cu = 0.25
  autoscaling_limit_max_cu = var.environment == "prod" ? 2 : 1

  pooler_enabled = true
  pooler_mode    = "transaction"
}

# データベース作成
resource "neon_database" "main" {
  project_id = neon_project.main.id
  branch_id  = neon_branch.main.id
  name       = "hackathon_support_agent"
  owner_name = "neondb_owner"
}

# ロール（ユーザー）作成
resource "neon_role" "app_user" {
  project_id = neon_project.main.id
  branch_id  = neon_branch.main.id
  name       = "app_user"
}
