#!/bin/sh -e

account_id="427368570714"
aws_region="ca-central-1"

image_domain="$account_id.dkr.ecr.$aws_region.amazonaws.com"
image_name="prometheus-nodejs"

docker buildx build --platform linux/amd64 -t "$image_domain/$image_name:latest" .

aws ecr get-login-password --region $aws_region | docker login --username AWS --password-stdin "$image_domain"

docker push "$image_domain/$image_name:latest"
