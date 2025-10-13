output "project_id" {
  description = "NeonプロジェクトID"
  value       = neon_project.main.id
}

output "connection_string" {
  description = "PostgreSQL接続文字列"
  value       = neon_endpoint.main.host
  sensitive   = true
}

output "database_url" {
  description = "完全なDATABASE_URL（Railwayなどで使用）"
  value = format(
    "postgresql://%s:%s@%s/%s?sslmode=require",
    neon_role.app_user.name,
    neon_role.app_user.password,
    neon_endpoint.main.host,
    neon_database.main.name
  )
  sensitive = true
}

output "pooler_connection_string" {
  description = "Connection Pooler経由の接続文字列"
  value = format(
    "postgresql://%s:%s@%s/%s?sslmode=require&pgbouncer=true",
    neon_role.app_user.name,
    neon_role.app_user.password,
    neon_endpoint.main.host,
    neon_database.main.name
  )
  sensitive = true
}
