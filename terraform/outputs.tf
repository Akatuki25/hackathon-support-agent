output "neon_connection_string" {
  description = "Neon PostgreSQL接続文字列"
  value       = module.neon.connection_string
  sensitive   = true
}

output "neon_database_url" {
  description = "Neon Database URL（Railway環境変数用）"
  value       = module.neon.database_url
  sensitive   = true
}

output "vercel_project_url" {
  description = "VercelプロジェクトURL"
  value       = module.vercel.project_url
}

output "vercel_deployment_url" {
  description = "Vercel最新デプロイURL"
  value       = module.vercel.deployment_url
}
