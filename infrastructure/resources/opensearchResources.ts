import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import { getLambdaRole, getSearchCodeArchive } from '../utils/pulumi-utils';
import { VpcInfo } from '..';
import { Role } from '@pulumi/aws/iam';

export async function ensureServiceLinkedRole() {
  const roleName = 'AWSServiceRoleForAmazonOpenSearchService';

  // Check if the service-linked role already exists
  try {
    const existingRole = await aws.iam.getRole({ name: roleName });
    console.log(`Service-linked role already exists: ${existingRole.name}`);
  } catch (error) {
    console.log('Service-linked role does not exist. Creating...');

    // If the role does not exist, create it
    const serviceLinkedRole = new aws.iam.ServiceLinkedRole('opensearch-service-linked-role', {
      awsServiceName: 'opensearchservice.amazonaws.com',
      description: 'Role to enable AWS services to manage OpenSearch resources',
    });
  }
}

export function setupOpensearchLambdas(lambdaRole: Role, vpcInfo: VpcInfo, opensearchEndpoint: pulumi.Output<string>) {
  const config = new pulumi.Config();
  const env = config.require('env');
  const region = config.require('region');
  const accountId = config.requireSecret('accountId');
  const openAIKey = config.requireSecret('openAIKey');
  const anthropicKey = config.requireSecret('anthropicKey');
  const cognitoClientId = config.requireSecret('cognitoClientId');
  const cognitoUserPoolId = config.requireSecret('cognitoUserPoolId');
  const promptSheetId = config.requireSecret('promptSheetId');
  const googleServiceAccountEmail = config.requireSecret('googleServiceAccountEmail');
  const googleServiceAccountPrivateKey = config.requireSecret('googleServiceAccountPrivateKey');
  const mixpanelToken = config.requireSecret('mixpanelToken');

  const searchCodeArchive = getSearchCodeArchive();

  const lambdaSettings = {
    role: lambdaRole.arn,
    runtime: 'nodejs18.x',
    memorySize: 1024,
    timeout: 900,
    environment: {
      variables: {
        env,
        region,
        accountId,
        openAIKey,
        anthropicKey,
        cognitoClientId,
        cognitoUserPoolId,
        promptSheetId,
        googleServiceAccountEmail,
        googleServiceAccountPrivateKey,
        opensearchEndpoint,
        mixpanelToken,
      },
    },
  };

  const searchHandler = new aws.lambda.Function('opensearch-handler-' + env, {
    name: 'opensearch-handler-' + env,
    code: searchCodeArchive,
    handler: 'index.handler',
    vpcConfig: {
      securityGroupIds: [vpcInfo.securityGroupId],
      subnetIds: vpcInfo.subnetIds,
    },
    ...lambdaSettings,
  });
}
export async function setupOpensearchResources(vpcInfo: VpcInfo) {
  await ensureServiceLinkedRole();
  const config = new pulumi.Config();
  const env = config.require('env');
  const lambdaRole = getLambdaRole();

  // Define the access policy
  const accessPolicy = pulumi.output({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: '*' },
        Action: 'es:*',
        Resource: '*',
      },
    ],
  });

  const domain = new aws.opensearch.Domain('search-domain-' + env, {
    domainName: 'search-domain-' + env,
    engineVersion: 'OpenSearch_2.11',
    clusterConfig: {
      instanceType: 't3.medium.search',
      instanceCount: 1,
    },
    domainEndpointOptions: {
      enforceHttps: true,
      tlsSecurityPolicy: 'Policy-Min-TLS-1-2-2019-07',
    },
    ebsOptions: {
      ebsEnabled: true,
      volumeSize: 10,
      volumeType: 'gp3',
      iops: 3000,
    },
    nodeToNodeEncryption: { enabled: true },
    encryptAtRest: {
      enabled: true,
    },
    vpcOptions: {
      securityGroupIds: [vpcInfo.securityGroupId],
      subnetIds: [vpcInfo.subnetIds[0]],
    },
    snapshotOptions: {
      automatedSnapshotStartHour: 0, // Set the hour at which the service takes a daily automated snapshot of the indices in the domain
    },
    advancedSecurityOptions: {
      enabled: true,
      anonymousAuthEnabled: true,
    },
    // Include the access policy in the domain configuration
    accessPolicies: accessPolicy.apply(JSON.stringify),
  });

  setupOpensearchLambdas(lambdaRole, vpcInfo, domain.endpoint);
}
