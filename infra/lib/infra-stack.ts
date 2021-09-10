import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns";
import * as iam from "@aws-cdk/aws-iam";
import { RetentionDays } from "@aws-cdk/aws-logs";
import * as cdk from "@aws-cdk/core";

export class InfraStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = props?.tags?.stage ?? "dev";

    // The code that defines your stack goes here
    const vpc = new ec2.Vpc(this, "VPC", {
      maxAzs: 3,
      natGateways: 1,
    });

    const cluster = new ecs.Cluster(this, "ECSCluster", {
      vpc,
      clusterName: `${stage}-ecs-cluster`,
    });

    const taskRole = new iam.Role(this, "ECSTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    const taskName = `${stage}-demo-task`;

    const demoTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      `${taskName}-definition`,
      {
        taskRole,
        cpu: 256,
        memoryLimitMiB: 512,
      }
    );

    demoTaskDefinition.addContainer("xray-daemon", {
      image: ecs.ContainerImage.fromRegistry(
        "public.ecr.aws/xray/aws-xray-daemon:latest"
      ),
      containerName: "xray-daemon",
      memoryLimitMiB: 256,
      cpu: 32,
      logging: ecs.LogDrivers.awsLogs({
        logRetention: RetentionDays.ONE_DAY,
        streamPrefix: `${taskName}-xray`,
      }),
      portMappings: [{ containerPort: 2000 }],
    });

    demoTaskDefinition.addContainer("DemoContainer", {
      image: ecs.ContainerImage.fromRegistry(
        `${this.account}.dkr.ecr.${this.region}.amazonaws.com/prometheus-nodejs:latest`
      ),
      memoryLimitMiB: 512,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: taskName,
        logRetention: RetentionDays.ONE_DAY,
      }),
      environment: {
        PORT: "80",
      },
      portMappings: [{ containerPort: 80 }],
    });

    new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      `${stage}-demo-service-with-lb`,
      {
        cluster,
        cpu: 512,
        desiredCount: 1,
        memoryLimitMiB: 512,
        publicLoadBalancer: true,
        taskDefinition: demoTaskDefinition,
        listenerPort: 80,
      }
    );
  }
}
