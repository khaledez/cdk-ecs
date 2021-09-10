#!/usr/bin/env node
import * as cdk from "@aws-cdk/core";
import "source-map-support/register";
import { InfraStack } from "../lib/infra-stack";

const accountId = "427368570714";
const region = "ca-central-1";

const app = new cdk.App();
const stage = app.node.tryGetContext("STAGE") || "dev";

new InfraStack(app, "InfraStack", {
  env: { account: accountId, region },
  tags: {
    stage,
  },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
