#-------------------------------------------------------------------------------
# Outputs
#-------------------------------------------------------------------------------
# These values are used by the application (backend, worker) and by operators
# to configure env vars (e.g. S3_BUCKET_NAME, SQS_QUEUE_URL).

output "s3_bucket_name" {
  description = "Name of the S3 bucket used for original and processed images."
  value       = aws_s3_bucket.images.id
}

output "sqs_queue_url" {
  description = "URL of the SQS queue for image processing jobs (use in backend and worker)."
  value       = aws_sqs_queue.image_processing.url
}

output "lambda_function_name" {
  description = "Name of the Lambda function that processes images from the queue."
  value       = aws_lambda_function.worker.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function (e.g. for event source mapping)."
  value       = aws_lambda_function.worker.arn
}
