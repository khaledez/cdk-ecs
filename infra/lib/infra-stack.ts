import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as elbv2 from "@aws-cdk/aws-elasticloadbalancingv2";
import * as iam from "@aws-cdk/aws-iam";
import { LogGroup, RetentionDays } from "@aws-cdk/aws-logs";
import * as cdk from "@aws-cdk/core";
import { Construct, RemovalPolicy } from "@aws-cdk/core";

export class InfraStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = props?.tags?.stage ?? "dev";

    // The code that defines your stack goes here
    const vpc = new ec2.Vpc(this, "VPC", {
      maxAzs: 3,
      natGateways: 1,
    });

    const lbListener = loadBalancer(this, vpc);

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

    // demoTaskDefinition.addContainer("xray-daemon", {
    //   containerName: "xray-daemon",
    //   image: ecs.ContainerImage.fromRegistry(
    //     "public.ecr.aws/xray/aws-xray-daemon:latest"
    //   ),
    //   portMappings: [{ protocol: ecs.Protocol.UDP, containerPort: 2000 }],
    // });

    const demoService = new ecs.FargateService(this, "DemoService", {
      cluster,
      taskDefinition: demoTaskDefinition,
      serviceName: `${taskName}-ervice`,
      desiredCount: 1,
      assignPublicIp: false,
    });

    new elbv2.ApplicationListenerRule(this, "LBRuleDemoTask", {
      listener: lbListener,
      priority: 1,
      conditions: [elbv2.ListenerCondition.pathPatterns(["/*"])],
      targetGroups: [
        lbListener.addTargets("DemoTaskTarget", {
          targetGroupName: `${stage}-demo-task-http-target`,
          protocol: elbv2.ApplicationProtocol.HTTP,
          port: 3000,
          healthCheck: {
            path: "/",
            port: "3000",
            interval: cdk.Duration.minutes(1),
          },
          targets: [demoService],
        }),
      ],
    });
  }
}

function loadBalancer(
  contruct: Construct,
  vpc: ec2.Vpc
): elbv2.ApplicationListener {
  const lb = new elbv2.ApplicationLoadBalancer(contruct, `LoadBalancer`, {
    vpc,
    internetFacing: true,
  });

  return lb.addListener("HTTP Listener", {
    protocol: elbv2.ApplicationProtocol.HTTP,
    port: 80,
  });
}
