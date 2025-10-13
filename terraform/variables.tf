variable "project_name" {
  description = "プロジェクト名"
  type        = string
  default     = "hackathon-support-agent"
}

variable "environment" {
  description = "環境（dev/prod）"
  type        = string
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "環境はdevまたはprodである必要があります"
  }
}

variable "neon_region" {
  description = "Neonリージョン（シンガポールが日本に最も近い）"
  type        = string
  default     = "aws-ap-southeast-1"
}

variable "github_repo" {
  description = "GitHubリポジトリ（org/repo形式）"
  type        = string
}

variable "backend_url" {
  description = "Railway BackendのURL"
  type        = string
}

variable "nextauth_secret" {
  description = "NextAuth.jsシークレット（32文字以上のランダム文字列）"
  type        = string
  sensitive   = true
}

variable "gh_oauth_client_id" {
  description = "GitHub OAuth App Client ID"
  type        = string
  sensitive   = true
}

variable "gh_oauth_client_secret" {
  description = "GitHub OAuth App Client Secret"
  type        = string
  sensitive   = true
}
