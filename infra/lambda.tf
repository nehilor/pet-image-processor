#-------------------------------------------------------------------------------
# Lambda Function (Image Processing Worker)
#-------------------------------------------------------------------------------
# The worker is packaged from the worker/ directory and invoked by SQS messages.
# Handler "worker.handler" expects a file worker.js at the root of the deployment
# package exporting a function handler(event, context). For the current polling-based
# worker, you would add a Lambda adapter that receives SQS events and processes
# each record, then call the existing processing logic.
#
# Zip is built from ../worker. Excludes node_modules and secrets; for production
# run a build step (e.g. npm ci && zip) that includes node_modules, or use Lambda
# layers. The handler "worker.handler" expects worker.js at package root exporting
# a handler(event, context); adapt the polling worker to export such a handler for Lambda.
data "archive_file" "worker" {
  type        = "zip"
  source_dir  = "${path.module}/../worker"
  output_path = "${path.module}/worker.zip"
  excludes    = ["node_modules", ".env", ".env.*", ".git", "*.log"]
}

resource "aws_lambda_function" "worker" {
  function_name = var.lambda_function_name
  role          = aws_iam_role.worker.arn
  handler       = "worker.handler"
  runtime       = "nodejs18.x"

  filename         = data.archive_file.worker.output_path
  source_code_hash = data.archive_file.worker.output_base64sha256

  timeout = 30
  memory_size = 512

  environment {
    variables = {
      S3_BUCKET_NAME       = aws_s3_bucket.images.id
      SQS_QUEUE_URL        = aws_sqs_queue.image_processing.url
      S3_ORIGINAL_PREFIX   = var.s3_original_prefix
      S3_PROCESSED_PREFIX  = var.s3_processed_prefix
    }
  }

  tags = {
    Name = var.lambda_function_name
  }
}

# Allow SQS to invoke the Lambda (required for event source mapping).
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.image_processing.arn
  function_name   = aws_lambda_function.worker.function_name
  batch_size      = 10
}
