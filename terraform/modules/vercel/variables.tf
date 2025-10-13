variable "project_name" {
  description = "プロジェクト名"
  type        = string
}

variable "github_repo" {
  description = "GitHubリポジトリ（org/repo形式）"
  type        = string
}

variable "backend_url" {
  description = "Railway BackendのURL"
  type        = string
}

variable "environment" {
  description = "環境（dev/prod）"
  type        = string
}

variable "nextauth_secret" {
  description = "NextAuth.jsシークレット"
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
