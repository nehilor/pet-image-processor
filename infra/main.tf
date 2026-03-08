#-------------------------------------------------------------------------------
# Main Terraform Configuration
#-------------------------------------------------------------------------------
# This file ties together the infrastructure. Resources are split by service:
# - s3.tf    : S3 bucket for image storage (originals + processed)
# - sqs.tf   : SQS queue for async job messages
# - iam.tf   : IAM role and policies for the Lambda worker
# - lambda.tf: Lambda function (worker) triggered by SQS
#
# No automatic deploy: run `terraform plan` to review, then `terraform apply`
# when ready. Ensure AWS credentials are configured (e.g. AWS_PROFILE or
# default provider chain).
