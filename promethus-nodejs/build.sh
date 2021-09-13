#!/bin/sh -e

account_id="427368570714"
aws_region="ca-central-1"

image_domain="khaledez"
image_name="prometheus-nodejs"

docker buildx build --platform linux/amd64 -t "$image_domain/$image_name:latest" .

