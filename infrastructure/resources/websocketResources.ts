import * as aws from '@pulumi/aws';
import { Role } from '@pulumi/aws/iam';
import * as pulumi from '@pulumi/pulumi';
import { getLambdaCodeArchive } from '../utils/pulumi-utils';

export const setupWebsocketLambdas = (lambdaRole: Role) => {
  const config = new pulumi.Config();
  const env = config.require('env');
  const region = config.require('region');
  const accountId = config.requireSecret('accountId');
  const openAIKey = config.requireSecret('openAIKey');
  const anthropicKey = config.requireSecret('anthropicKey');
  const cognitoClientId = config.requireSecret('cognitoClientId');
  const promptSheetId = config.requireSecret('promptSheetId');
  const googleServiceAccountEmail = config.requireSecret('googleServiceAccountEmail');
  const googleServiceAccountPrivateKey = config.requireSecret('googleServiceAccountPrivateKey');
  const mixpanelToken = config.requireSecret('mixpanelToken');

  const codeArchive = getLambdaCodeArchive();

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
        promptSheetId,
        googleServiceAccountEmail,
        googleServiceAccountPrivateKey,
        mixpanelToken,
      },
    },
  };

  new aws.iam.RolePolicyAttachment('lambda-apigateway-invoke', {
    role: lambdaRole.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
  });

  const WSconnect = new aws.lambda.Function('ws-connect-' + env, {
    name: 'ws-connect-' + env,
    code: codeArchive,
    handler: 'index.connectHandler',
    ...lambdaSettings,
  });
  const WSdisconnect = new aws.lambda.Function('ws-disconnect-' + env, {
    name: 'ws-disconnet-' + env,
    code: codeArchive,
    handler: 'index.disconnectHandler',
    ...lambdaSettings,
  });
  const WSsendMessage = new aws.lambda.Function('ws-send-message' + env, {
    name: 'ws-send-message' + env,
    code: codeArchive,
    handler: 'index.sendMessageHandler',
    ...lambdaSettings,
  });

  return { WSconnect, WSdisconnect, WSsendMessage };
};

export const setupWebsocketResources = () => {
  const config = new pulumi.Config();
  const env = config.require('env');

  const wsLambdaRole = new aws.iam.Role('ws-lambda-role-' + env, {
    name: 'ws-lambda-role-' + env,
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'lambda.amazonaws.com',
          },
        },
      ],
    }),
  });
  // DynamoDB Full Access Policy
  const dynamoDbFullAccessPolicy = new aws.iam.Policy('ws-dynamodb-full-access-policy-' + env, {
    name: 'ws-dynamodb-full-access-policy-' + env,
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: 'dynamodb:*',
          Resource: '*',
        },
      ],
    }),
  });
  // Websocket Full Access Policy
  const websocketFullAccessPolicy = new aws.iam.Policy('ws-websocket-full-access-policy-' + env, {
    name: 'ws-websocket-full-access-policy-' + env,
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: 'execute-api:*',
          Resource: '*',
        },
      ],
    }),
  });

  new aws.iam.RolePolicyAttachment('ws-lambda-execution-role-attachment-' + env, {
    role: wsLambdaRole.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
  });
  // Attach the DynamoDB Full Access Policy to the Lambda Role
  new aws.iam.RolePolicyAttachment('ws-lambda-dynamodb-full-access-attachment-' + env, {
    role: wsLambdaRole.name,
    policyArn: dynamoDbFullAccessPolicy.arn,
  });
  // Attach the websocket Full Access Policy to the Lambda Role
  new aws.iam.RolePolicyAttachment('ws-lambda-websocket-full-access-attachment-' + env, {
    role: wsLambdaRole.name,
    policyArn: websocketFullAccessPolicy.arn,
  });

  // policy for logging
  new aws.iam.RolePolicyAttachment('ws-lambda-fullAccess-role-attachment-' + env, {
    role: wsLambdaRole.name,
    policyArn: 'arn:aws:iam::aws:policy/AWSLambda_FullAccess',
  });
  const { WSconnect, WSdisconnect, WSsendMessage } = setupWebsocketLambdas(wsLambdaRole);

  new aws.lambda.Permission('connectLambdaPermission', {
    action: 'lambda:InvokeFunction',
    function: WSconnect.arn,
    principal: 'apigateway.amazonaws.com',
  });
  new aws.lambda.Permission('disconnectLambdaPermission', {
    action: 'lambda:InvokeFunction',
    function: WSdisconnect.arn,
    principal: 'apigateway.amazonaws.com',
  });
  new aws.lambda.Permission('sendMessageLambdaPermission', {
    action: 'lambda:InvokeFunction',
    function: WSsendMessage.arn,
    principal: 'apigateway.amazonaws.com',
  });

  const websocketApi = new aws.apigatewayv2.Api('websocket-api-' + env, {
    name: 'websocket-api-' + env,
    protocolType: 'WEBSOCKET',
    routeSelectionExpression: '$request.body.action',
  });

  //integrations
  const connectIntegration = new aws.apigatewayv2.Integration(
    'ws-connect-integration-' + env,
    {
      apiId: websocketApi.id,
      integrationType: 'AWS_PROXY',
      integrationUri: WSconnect.arn,
    },
    { dependsOn: [websocketApi] },
  );
  const disconnectIntegration = new aws.apigatewayv2.Integration(
    'ws-disconnect-integration-' + env,
    {
      apiId: websocketApi.id,
      integrationType: 'AWS_PROXY',
      integrationUri: WSdisconnect.arn,
    },
    { dependsOn: [websocketApi] },
  );
  const sendMessageIntegration = new aws.apigatewayv2.Integration(
    'ws-send-message-integration-' + env,
    {
      apiId: websocketApi.id,
      integrationType: 'AWS_PROXY',
      integrationUri: WSsendMessage.arn,
    },
    { dependsOn: [websocketApi] },
  );

  // Add WebSocket routes
  const connectRoute = new aws.apigatewayv2.Route('ws-connect-route', {
    apiId: websocketApi.id,
    routeKey: '$connect',
    target: pulumi.interpolate`integrations/${connectIntegration.id}`,
  });

  const disconnectRoute = new aws.apigatewayv2.Route('ws-disconnect-route', {
    apiId: websocketApi.id,
    routeKey: '$disconnect',
    target: pulumi.interpolate`integrations/${disconnectIntegration.id}`,
  });

  const sendMessageRoute = new aws.apigatewayv2.Route('ws-send-message-route', {
    apiId: websocketApi.id,
    routeKey: 'sendMessage',
    target: pulumi.interpolate`integrations/${sendMessageIntegration.id}`,
  });

  const deployment = new aws.apigatewayv2.Deployment(
    'ws-api-deployment-' + env,
    {
      apiId: websocketApi.id,
    },
    {
      dependsOn: [websocketApi, connectIntegration, disconnectIntegration, sendMessageIntegration],
    },
  );

  const stage = new aws.apigatewayv2.Stage(
    'ws-api-gateway-stage-' + env,
    {
      apiId: websocketApi.id,
      name: env,
      // deploymentId: deployment.id,
      autoDeploy: true,
    },
    { dependsOn: [websocketApi] },
  );
};
