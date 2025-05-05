import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

export function setupVpcResources() {
  const config = new pulumi.Config();
  const env = config.require('env');

  // Create a new VPC
  const vpc = new aws.ec2.Vpc('vpc-' + env, {
    cidrBlock: '10.0.0.0/16',
    enableDnsSupport: true,
    enableDnsHostnames: true,
    tags: {
      Name: 'vpc-' + env,
    },
  });

  // Create an Internet Gateway
  const igw = new aws.ec2.InternetGateway('vpc-internet-gateway-' + env, {
    vpcId: vpc.id,
    tags: {
      Name: 'vpc-internet-gateway-' + env,
    },
  });

  // Create a Route Table
  const routeTable = new aws.ec2.RouteTable('route-table-' + env, {
    vpcId: vpc.id,
    routes: [
      {
        cidrBlock: '0.0.0.0/0',
        gatewayId: igw.id,
      },
    ],
    tags: {
      Name: 'route-table-' + env,
    },
  });

  // Create three Subnets in different Availability Zones
  const azs = ['a', 'b', 'c'];
  const subnets = azs.map(
    (az, index) =>
      new aws.ec2.Subnet(`subnet${index}`, {
        vpcId: vpc.id,
        cidrBlock: `10.0.${index + 1}.0/24`,
        availabilityZone: `${aws.config.region}${az}`,
        mapPublicIpOnLaunch: true,
        tags: {
          Name: `vpc-subnet-${env}-${az}`,
        },
      }),
  );

  // Associate each Subnet with the Route Table
  const routeTableAssociations = subnets.map(
    (subnet, index) =>
      new aws.ec2.RouteTableAssociation(`rta${index}`, {
        subnetId: subnet.id,
        routeTableId: routeTable.id,
      }),
  );

  // Create a Security Group that allows all inbound and outbound traffic
  const securityGroup = new aws.ec2.SecurityGroup('security-group-' + env, {
    name: 'security-group-' + env,
    vpcId: vpc.id,
    description: 'Allow all inbound and outbound traffic',
    ingress: [
      {
        protocol: '-1',
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ['0.0.0.0/0'],
      },
    ],
    egress: [
      {
        protocol: '-1',
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ['0.0.0.0/0'],
      },
    ],
    tags: {
      Name: 'security-group-' + env,
    },
  });

  const vpcId = vpc.id;
  const subnetIds = subnets.map((subnet) => subnet.id);
  const securityGroupId = securityGroup.id;
  return { vpcId, subnetIds, securityGroupId };
}
