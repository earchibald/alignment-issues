output "bucket" {
  value = aws_s3_bucket.submissions.bucket
}

output "region" {
  value = var.region
}

output "function_url" {
  value = aws_lambda_function_url.broker.function_url
}

output "analyst_access_key_id" {
  value = aws_iam_access_key.analyst.id
}

output "analyst_secret_access_key" {
  value     = aws_iam_access_key.analyst.secret
  sensitive = true
}
