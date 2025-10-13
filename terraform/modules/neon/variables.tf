variable "project_name" {
  description = "プロジェクト名"
  type        = string
}

variable "region" {
  description = "Neonリージョン"
  type        = string
  default     = "aws-ap-southeast-1"  # シンガポール（日本に最も近い）
}

variable "environment" {
  description = "環境（dev/prod）"
  type        = string
}
