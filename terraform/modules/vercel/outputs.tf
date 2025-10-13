output "project_id" {
  description = "VercelプロジェクトID"
  value       = vercel_project.frontend.id
}

output "project_url" {
  description = "VercelプロジェクトURL"
  value       = "https://${vercel_project.frontend.name}.vercel.app"
}

output "deployment_url" {
  description = "最新デプロイメントURL"
  value       = vercel_project.frontend.name
}
