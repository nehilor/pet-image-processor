#-------------------------------------------------------------------------------
# SQS Queue for Asynchronous Processing
#-------------------------------------------------------------------------------
# The backend publishes messages { jobId, imageKey } to this queue. The worker
# (Lambda or long-running process) consumes messages, processes images, and
# deletes them on success. visibility_timeout gives the worker time to process
# before the message becomes visible again (should be >= Lambda timeout).

resource "aws_sqs_queue" "image_processing" {
  name = var.queue_name

  # Time window during which the message is invisible after being received.
  # Should be at least as long as the Lambda timeout (30s) plus processing.
  visibility_timeout_seconds = 60

  # How long messages are retained if not deleted (1 day).
  message_retention_seconds = 86400

  # Long polling reduces empty receives and cost (recommended).
  receive_wait_time_seconds = 20

  tags = {
    Name = var.queue_name
  }
}

# Optional: dead-letter queue (DLQ) for failed messages after max receives.
# Uncomment and set redrive_policy on the main queue to use.
# resource "aws_sqs_queue" "image_processing_dlq" {
#   name = "${var.queue_name}-dlq"
#   message_retention_seconds = 1209600  # 14 days
# }
