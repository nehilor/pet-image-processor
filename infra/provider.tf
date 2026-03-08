#-------------------------------------------------------------------------------
# AWS Provider
#-------------------------------------------------------------------------------
# Configures the AWS provider. Region is parameterized so the same code can
# target different regions (e.g. us-east-1 for production, us-west-2 for DR).

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "pet-image-processor"
      ManagedBy   = "terraform"
    }
  }
}
