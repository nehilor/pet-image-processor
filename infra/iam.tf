#-------------------------------------------------------------------------------
# IAM Role and Policies for the Lambda Worker
#-------------------------------------------------------------------------------
# The worker needs:
# - S3: GetObject (read originals), PutObject (write processed)
# - SQS: ReceiveMessage, DeleteMessage (consume queue); SendMessage if republishing
# - CloudWatch Logs: CreateLogStream, PutLogEvents (Lambda default logging)
#
# We scope S3 and SQS permissions to the specific bucket and queue created
# by this Terraform configuration.

resource "aws_iam_role" "worker" {
  name = "pet-image-processor-worker-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# S3: read from original prefix, write to processed prefix.
resource "aws_iam_role_policy" "worker_s3" {
  name = "worker-s3"
  role = aws_iam_role.worker.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.images.arn}/${var.s3_original_prefix}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl"
        ]
        Resource = "${aws_s3_bucket.images.arn}/${var.s3_processed_prefix}/*"
      }
    ]
  })
}

# SQS: receive, delete (and optionally send) messages on the processing queue.
resource "aws_iam_role_policy" "worker_sqs" {
  name = "worker-sqs"
  role = aws_iam_role.worker.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:SendMessage"
        ]
        Resource = aws_sqs_queue.image_processing.arn
      }
    ]
  })
}

# CloudWatch Logs: required for Lambda to write logs (managed policy alternative).
resource "aws_iam_role_policy_attachment" "worker_logs" {
  role       = aws_iam_role.worker.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
