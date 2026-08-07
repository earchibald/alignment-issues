variable "bucket_name" {
  description = "Globally unique S3 bucket name for submissions"
  type        = string
}

variable "region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-west-2"
}

variable "allowed_origin" {
  description = "The single browser origin allowed to call the broker and upload"
  type        = string
  default     = "https://earchibald.github.io"
}

variable "submit_token" {
  description = "Shared submit token; also set as the GitHub secret HYT_SUBMIT_TOKEN"
  type        = string
  sensitive   = true
}

variable "expire_days" {
  description = "Days before submitted objects expire"
  type        = number
  default     = 90
}
