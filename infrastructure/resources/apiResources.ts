import * as aws from '@pulumi/aws';
import { Role } from '@pulumi/aws/iam';
import * as pulumi from '@pulumi/pulumi';
import {
  getLambdaCodeArchive,
  getPuppeteerProxyLambdaCodeArchive,
  getLambdaRole,
  getPuppeteerProxyLambdaRole,
  getSearchCodeArchive,
  getAnthropicHandlerCodeArchive,
} from '../utils/pulumi-utils';
import { VpcInfo } from '..';

// TODO simplify lambda creation as a loop
// TODO get cognitoClientId and cognitoUserPoolId from exported auth resources

export function setupApiLambdas(lambdaRole: Role, lambdaRolePuppeteerProxy: Role, vpcInfo: VpcInfo) {
  const config = new pulumi.Config();
  const env = config.require('env');
  const region = config.require('region');
  const accountId = config.requireSecret('accountId');
  const openAIKey = config.requireSecret('openAIKey');
  const anthropicKey = config.requireSecret('anthropicKey');
  const cognitoClientId = config.requireSecret('cognitoClientId');
  const cognitoUserPoolId = config.requireSecret('cognitoUserPoolId');
  const promptSheetId = config.requireSecret('promptSheetId');
  const analyticsSheetId = config.requireSecret('analyticsSheetId');
  const googleServiceAccountEmail = config.requireSecret('googleServiceAccountEmail');
  const googleServiceAccountPrivateKey = config.requireSecret('googleServiceAccountPrivateKey');
  const proxyNetworkServer = config.requireSecret('proxyNetworkServer');
  const proxyNetworkUsername = config.requireSecret('proxyNetworkUsername');
  const proxyNetworkPassword = config.requireSecret('proxyNetworkPassword');
  const featureStepFunctionS3Enabled = config.require('featureStepFunctionS3Enabled');
  const webUnblockerServer = config.requireSecret('webUnblockerServer');
  const webUnblockerUsername = config.requireSecret('webUnblockerUsername');
  const webUnblockerPassword = config.requireSecret('webUnblockerPassword');
  const docConverterUsername = config.requireSecret('docConverterUsername');
  const docConverterPassword = config.requireSecret('docConverterPassword');
  const mixpanelToken = config.requireSecret('mixpanelToken');

  const codeArchive = getLambdaCodeArchive();
  const puppeteerProxyArchive = getPuppeteerProxyLambdaCodeArchive();
  const searchCodeArchive = getSearchCodeArchive();
  const anthropicHandlerCodeArcive = getAnthropicHandlerCodeArchive();

  const lambdaPuppeteerProxySettings = {
    role: lambdaRolePuppeteerProxy.arn,
    runtime: 'nodejs18.x',
    memorySize: 3000,
    timeout: 180,
    environment: {
      variables: {
        env: env,
        region: region,
        accountId: accountId,
        proxyNetworkServer,
        proxyNetworkUsername,
        proxyNetworkPassword,
      },
    },
  };

  // Lambda Layer for Chromium Browser
  const lambdaLayer = new aws.lambda.LayerVersion(`lambda-layer-chromium-v121-0-0-${env}`, {
    layerName: `lambda-layer-chromium-v121-0-0-${env}`,
    compatibleRuntimes: ['nodejs'],
    compatibleArchitectures: ['x86_64'],
    s3Bucket: `sesha-backend-chromium-browser-${env}`,
    s3Key: `v121.0.0/chromium-v121.0.0-layer.zip`,
    description: 'Chromium v121.0.0',
  });

  new aws.lambda.Function('lambda-handler-puppeteer-proxy-' + env, {
    name: 'lambda-handler-puppeteer-proxy-' + env,
    code: puppeteerProxyArchive,
    handler: 'index.handler',
    ...lambdaPuppeteerProxySettings,
    layers: [lambdaLayer.arn],
  });

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
        analyticsSheetId,
        googleServiceAccountEmail,
        googleServiceAccountPrivateKey,
        featureStepFunctionS3Enabled,
        webUnblockerServer,
        webUnblockerUsername,
        webUnblockerPassword,
        docConverterUsername,
        docConverterPassword,
        proxyNetworkServer,
        proxyNetworkUsername,
        proxyNetworkPassword,
        mixpanelToken,
      },
    },
  };
  const lambdaHandler = new aws.lambda.Function('lambda-handler-' + env, {
    name: 'lambda-handler-' + env,
    code: codeArchive,
    handler: 'index.handler',
    ...lambdaSettings,
  });

  const websocketHeartbeatLambda = new aws.lambda.Function('websocket-heartbeat-' + env, {
    name: 'websocket-heartbeat-' + env,
    code: codeArchive,
    handler: 'index.websocketHeartbeat',
    ...lambdaSettings,
  });

  // Define a custom AWS provider for the us-east-1 region
  const usEast1Provider = new aws.Provider('us-east-1-provider', {
    region: 'us-east-1',
  });

  const anthropicHandler = new aws.lambda.Function(
    'anthropic-handler-' + env,
    {
      name: 'anthropic-handler-' + env,
      code: anthropicHandlerCodeArcive,
      handler: 'index.handler',
      ...{
        ...lambdaSettings,
        environment: { variables: { ...lambdaSettings.environment.variables, region: 'us-east-1' } },
      },
    },
    { provider: usEast1Provider },
  );

  const searchHandler = new aws.lambda.Function('search-handler-' + env, {
    name: 'search-handler-' + env,
    code: searchCodeArchive,
    handler: 'index.handler',
    vpcConfig: {
      securityGroupIds: [vpcInfo.securityGroupId],
      subnetIds: vpcInfo.subnetIds,
    },
    ...lambdaSettings,
  });

  // Event rule to trigger every 5 minutes
  const scheduleRule = new aws.cloudwatch.EventRule('websocket-heartbeat-five-minutes-' + env, {
    scheduleExpression: 'cron(0/5 * * * ? *)',
  });

  // Set the Lambda function as the target for the event rule
  const lambdaTarget = new aws.cloudwatch.EventTarget('websocket-heartbeat-target-' + env, {
    rule: scheduleRule.name,
    arn: websocketHeartbeatLambda.arn,
  });

  // Grant necessary permissions for the event rule to invoke the Lambda function
  const permission = new aws.lambda.Permission('websocket-heartbeat-permission-' + env, {
    action: 'lambda:InvokeFunction',
    function: websocketHeartbeatLambda.name,
    principal: 'events.amazonaws.com',
    sourceArn: scheduleRule.arn,
  });

  return { lambdaHandler };
}

export function setupApiResources(vpcInfo: VpcInfo) {
  const config = new pulumi.Config();
  const env = config.require('env');
  const lambdaRole = getLambdaRole();
  const lambdaRolePuppeteerProxy = getPuppeteerProxyLambdaRole();

  const { lambdaHandler } = setupApiLambdas(lambdaRole, lambdaRolePuppeteerProxy, vpcInfo);

  // api gateway ------------------------------------------------
  const api = new aws.apigatewayv2.Api('sesha-http-api-' + env, {
    name: 'sesha-http-api-' + env,
    protocolType: 'HTTP',
    corsConfiguration: {
      allowOrigins: ['*'],
      allowMethods: ['*'],
      allowHeaders: ['*'],
    },
  });

  // lambda integrations
  const integration = new aws.apigatewayv2.Integration('lambda-integration' + env, {
    apiId: api.id,
    integrationType: 'AWS_PROXY',
    integrationUri: lambdaHandler.invokeArn,
    payloadFormatVersion: '2.0',
  });

  // Create a catch-all proxy route
  const route = new aws.apigatewayv2.Route('any-route-' + env, {
    apiId: api.id,
    routeKey: '$default',
    target: pulumi.interpolate`integrations/${integration.id}`,
  });

  // Deploy the API
  const deployment = new aws.apigatewayv2.Deployment(
    'api-deployment-' + env,
    {
      apiId: api.id,
    },
    { dependsOn: [route] },
  );

  const stage = new aws.apigatewayv2.Stage('api-stage-' + env, {
    apiId: api.id,
    name: env,
    deploymentId: deployment.id,
    // autoDeploy: true,
  });

  // Grant API Gateway permissions to invoke the Lambda function
  new aws.lambda.Permission('apiGatewayLambdaPermission', {
    action: 'lambda:InvokeFunction',
    function: lambdaHandler.name,
    principal: 'apigateway.amazonaws.com',
    // Depending on your setup, you may need to add the source ARN of the API Gateway or its stage
    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
  });
}
