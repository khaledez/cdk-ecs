import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "@aws-cdk/aws-ecs-patterns";
import * as elbv2 from "@aws-cdk/aws-elasticloadbalancingv2";
import * as iam from "@aws-cdk/aws-iam";
import { LogGroup, RetentionDays } from "@aws-cdk/aws-logs";
import * as ssm from "@aws-cdk/aws-ssm";
import * as cdk from "@aws-cdk/core";
import { RemovalPolicy } from "@aws-cdk/core";

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
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "CloudWatchAgentServerPolicy"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess"),
      ],
    });

    const taskName = `${stage}-demo-task`;

    const demoTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      `${taskName}-definition`,
      {
        taskRole,
        cpu: 1024,
        memoryLimitMiB: 2048,
      }
    );

    const logGroup = new LogGroup(this, "container log group", {
      logGroupName: `/ecs/${stage}/DemoTask/container`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    demoTaskDefinition.addContainer("DemoContainer", {
      containerName: "DemoContainer",
      image: ecs.ContainerImage.fromRegistry(
        `khaledez/prometheus-nodejs-sample:latest`
      ),
      memoryLimitMiB: 512,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: taskName,
        logGroup,
      }),
      environment: {
        PORT: "3000",
      },
      portMappings: [{ containerPort: 3000 }],
    });

    demoTaskDefinition.addContainer("xray-daemon", {
      containerName: "xray-daemon",
      image: ecs.ContainerImage.fromRegistry(
        "public.ecr.aws/xray/aws-xray-daemon:latest"
      ),
      cpu: 32,
      memoryLimitMiB: 256,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "X-Ray",
        logGroup,
      }),
      portMappings: [{ protocol: ecs.Protocol.UDP, containerPort: 2000 }],
    });

    const prometheusConfig = new ssm.StringParameter(
      this,
      "prometheus-config",
      {
        parameterName: "/DemoService/cwagent/prometheus",
        type: ssm.ParameterType.STRING,
        stringValue: JSON.stringify({}),
      }
    );

    const cwagentConfig = new ssm.StringParameter(this, "cwagent-config", {
      parameterName: "/DemoService/cwagent/config",
      type: ssm.ParameterType.STRING,
      stringValue: JSON.stringify({
        logs: {
          metrics_collected: {
            emf: {},
          },
        },
      }),
    });

    demoTaskDefinition.addContainer("cloudwatch-agent", {
      containerName: "cloudwatch-agent",
      image: ecs.ContainerImage.fromRegistry(
        "public.ecr.aws/cloudwatch-agent/cloudwatch-agent:latest"
      ),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "cloudwatch-agent",
        logGroup,
      }),
      secrets: {
        CW_CONFIG_CONTENT: ecs.Secret.fromSsmParameter(cwagentConfig),
        PROMETHEUS_CONFIG_CONTENT:
          ecs.Secret.fromSsmParameter(prometheusConfig),
      },
    });

    new ApplicationLoadBalancedFargateService(this, "Main-Entrypoint", {
      cluster,
      taskDefinition: demoTaskDefinition,
      serviceName: `${taskName}`,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetProtocol: elbv2.ApplicationProtocol.HTTP,
    });
  }
}
