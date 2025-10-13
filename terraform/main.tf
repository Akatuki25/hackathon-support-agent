terraform {
  required_version = ">= 1.6.0"

  required_providers {
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.2.0"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
  }

  # Terraform Cloud でステート管理（推奨）
  # または S3/GCS などのリモートバックエンド
  cloud {
    organization = "akatuki-project"
    workspaces {
      name = "hackathon-support-agent"
    }
  }
}

# Provider configurations
provider "neon" {
  api_key = var.neon_api_key
}

provider "vercel" {
  api_token = var.vercel_api_token
}

# Neon PostgreSQL
module "neon" {
  source = "./modules/neon"

  project_name = var.project_name
  region       = var.neon_region
  environment  = var.environment
}

# Vercel Frontend
module "vercel" {
  source = "./modules/vercel"

  project_name           = var.project_name
  github_repo            = var.github_repo
  backend_url            = var.backend_url
  environment            = var.environment
  nextauth_secret        = var.nextauth_secret
  gh_oauth_client_id     = var.gh_oauth_client_id
  gh_oauth_client_secret = var.gh_oauth_client_secret
}
# Trigger apply after Neon project deletion



