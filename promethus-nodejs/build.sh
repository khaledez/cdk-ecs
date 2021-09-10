#!/bin/sh

image_domain='427368570714.dkr.ecr.ca-central-1.amazonaws.com'
image_name="prometheus-nodejs"

docker buildx build --platform linux/amd64 -t "$image_domain/$image_name:latest" .

docker push "$image_domain/$image_name:latest"