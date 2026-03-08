#-------------------------------------------------------------------------------
# S3 Bucket for Image Storage
#-------------------------------------------------------------------------------
# Single bucket with two logical "folders" (prefixes):
# - original-images/ : uploads from the backend (private)
# - processed-images/: output from the worker; public read for frontend display
#
# Versioning is enabled so we can recover from accidental overwrites or support
# rollback. Block public access is set at bucket level; we allow public read
# only on the processed-images prefix via a bucket policy.

resource "aws_s3_bucket" "images" {
  bucket = var.s3_bucket_name

  tags = {
    Name = var.s3_bucket_name
  }
}

# Versioning: keep object history for recovery and audit.
resource "aws_s3_bucket_versioning" "images" {
  bucket = aws_s3_bucket.images.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Block all public access by default; we will allow read on processed-images
# via the bucket policy below.
resource "aws_s3_bucket_public_access_block" "images" {
  bucket = aws_s3_bucket.images.id

  block_public_acls       = true
  block_public_policy     = false # set false so our policy can grant read on processed/
  ignore_public_acls      = true
  restrict_public_buckets = false
}

# Allow public read only for objects under processed-images/ so the frontend
# can display processed image URLs (e.g. https://bucket.s3.region.amazonaws.com/processed-images/...).
resource "aws_s3_bucket_policy" "processed_public_read" {
  bucket = aws_s3_bucket.images.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadProcessedImages"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.images.arn}/${var.s3_processed_prefix}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.images]
}

# Optional: server-side encryption (recommended for production).
# Uncomment to enable AES256 on the bucket.
# resource "aws_s3_bucket_server_side_encryption_configuration" "images" {
#   bucket = aws_s3_bucket.images.id
#   rule {
#     apply_server_side_encryption_by_default {
#       sse_algorithm = "AES256"
#     }
#   }
# }
