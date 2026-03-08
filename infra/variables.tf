#-------------------------------------------------------------------------------
# Input Variables
#-------------------------------------------------------------------------------
# Defaults are set so `terraform plan` works without a tfvars file.
# Override in terraform.tfvars or via -var for your environment.

variable "aws_region" {
  description = "AWS region for all resources (e.g. us-east-1)."
  type        = string
  default     = "us-east-1"
}

variable "s3_bucket_name" {
  description = "Name of the S3 bucket for original and processed images."
  type        = string
  default     = "pet-image-processor"
}

variable "queue_name" {
  description = "Name of the SQS queue for image processing jobs."
  type        = string
  default     = "image-processing-queue"
}

variable "lambda_function_name" {
  description = "Name of the Lambda function that runs the image worker."
  type        = string
  default     = "pet-image-processor-worker"
}

variable "s3_original_prefix" {
  description = "S3 key prefix for uploaded original images."
  type        = string
  default     = "original-images"
}

variable "s3_processed_prefix" {
  description = "S3 key prefix for processed images (must be readable by frontend)."
  type        = string
  default     = "processed-images"
}
