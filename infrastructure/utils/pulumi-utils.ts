import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as path from 'path';
import { Role } from '@pulumi/aws/iam';
import { LayerVersion } from '@pulumi/aws/lambda';

let lambdaRole: Role | null = null;
let lambdaRolePuppeteerProxy: Role | null = null;
let nodeModuleLayer: LayerVersion | null = null;

export enum ArticleGenerationFunctions {
  createInitialSourcesArray = 'createInitialSourcesArray',
  summarizeDigest = 'summarizeDigest',
  summarizeAggregator = 'summarizeAggregator',
  factsBitsDigest = 'factsBitsDigest',
  factsBitsAggregator = 'factsBitsAggregator',
  factsBitsAggregator2 = 'factsBitsAggregator2',
  cleanUpFactsAggregator = 'cleanUpFactsAggregator',
  cleanUpFactsDigest = 'cleanUpFactsDigest',
  articlePreparationOne = 'articlePreparationOne',
  headlinesBlobs = 'headlinesBlobs',
  articlePreparationTwo = 'articlePreparationTwo',
  quotePicking = 'quotePicking',
  articleWriting = 'articleWriting',
  rewritingArticle = 'rewritingArticle',
  finalizationOne = 'finalizationOne',
  finalizationTwo = 'finalizationTwo',
  digestArticleAttribution = 'digestArticleAttribution',
  aggregatorArticleAttribution = 'aggregatorArticleAttribution',
  analyticsStep = 'analyticsStep',
  postRunHook = 'postRunHook',
}

export function getContentType(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypeMapping: { [key: string]: string } = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return contentTypeMapping[ext];
}
export function getLambdaCodeArchive() {
  const codeArchive = new pulumi.asset.AssetArchive({
    'index.js': new pulumi.asset.FileAsset(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/lambda-handler/dist/index.js',
    ),
    'sheetHelpers.js': new pulumi.asset.FileAsset(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/lambda-handler/dist/sheetHelpers.js',
    ),
    'gptHelpers.js': new pulumi.asset.FileAsset(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/lambda-handler/dist/gptHelpers.js',
    ),
    'types.js': new pulumi.asset.FileAsset(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/lambda-handler/dist/types.js',
    ),
    'enums.js': new pulumi.asset.FileAsset(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/lambda-handler/dist/enums.js',
    ),
    node_modules: new pulumi.asset.FileArchive(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/lambda-handler/node_modules',
    ),
  });

  return codeArchive;
}

export function getPuppeteerProxyLambdaCodeArchive() {
  const codeArchive = new pulumi.asset.AssetArchive({
    'index.js': new pulumi.asset.FileAsset(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/puppeteerproxy/dist/index.js',
    ),
    node_modules: new pulumi.asset.FileArchive(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/puppeteerproxy/node_modules',
    ),
  });

  return codeArchive;
}
export function getSearchCodeArchive() {
  const codeArchive = new pulumi.asset.AssetArchive({
    'index.js': new pulumi.asset.FileAsset(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/search-handler/dist/index.js',
    ),
    node_modules: new pulumi.asset.FileArchive(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/search-handler/node_modules',
    ),
  });

  return codeArchive;
}
export function getDynamodbToOpensearchCodeArchive() {
  const codeArchive = new pulumi.asset.AssetArchive({
    'index.js': new pulumi.asset.FileAsset(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/dynamodb-to-opensearch/dist/index.js',
    ),
    node_modules: new pulumi.asset.FileArchive(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/dynamodb-to-opensearch/node_modules',
    ),
  });

  return codeArchive;
}
export function getAnthropicHandlerCodeArchive() {
  const codeArchive = new pulumi.asset.AssetArchive({
    'index.js': new pulumi.asset.FileAsset(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/anthropic-handler/dist/index.js',
    ),
    node_modules: new pulumi.asset.FileArchive(
      '/home/runner/work/sesha-backend/sesha-backend/lambdas/anthropic-handler/node_modules',
    ),
  });

  return codeArchive;
}
function createLambdaRole() {
  const config = new pulumi.Config();
  const env = config.require('env');

  const lambdaRole = new aws.iam.Role('lambda-role-' + env, {
    name: 'lambda-role-' + env,
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: ['sts:AssumeRole'],
          Effect: 'Allow',
          Principal: {
            Service: 'lambda.amazonaws.com',
          },
        },
      ],
    }),
  });
  const cognitoAdminPolicy = new aws.iam.Policy('cognito-admin-policy-' + env, {
    name: 'cognito-admin-policy-' + env,
    description: 'Cognito admin permissions',
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'cognito-idp:AdminUserGlobalSignOut', // Grants all Cognito actions, adjust as necessary
          ],
          Resource: '*', // Adjust this to limit to specific resources if needed
        },
      ],
    }),
  });
  // Policy granting full access to OpenSearch, Step Functions, Websockets, DynamoDB and S3
  const fullAccessPolicy = new aws.iam.Policy('openseach-states-websockets-dynamodb-s3-ses-full-access-' + env, {
    name: 'openseach-states-websockets-dynamodb-s3-ses-full-access-' + env,
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: 'es:*',
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: 'states:*',
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: 'execute-api:*',
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: 'dynamodb:*',
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: 's3:*',
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: 'ses:*',
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: 'cognito-idp:*',
          Resource: '*',
        },
      ],
    }),
  });

  // basic lambda execution policy
  new aws.iam.RolePolicyAttachment('lambda-execution-role-attachment-' + env, {
    role: lambdaRole.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
  });

  // vpc execution attachment
  new aws.iam.RolePolicyAttachment('lambda-vpc-execution-role-attachment-' + env, {
    role: lambdaRole.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaVPCAccessExecutionRole,
  });

  new aws.iam.RolePolicyAttachment('lambda-cognito-admin-access-attachment-' + env, {
    role: lambdaRole.name,
    policyArn: cognitoAdminPolicy.arn,
  });
  // Attach Full Access Policy
  new aws.iam.RolePolicyAttachment(`full-access-poliy-attachment-${env}`, {
    role: lambdaRole,
    policyArn: fullAccessPolicy.arn,
  });

  // policy for logging
  new aws.iam.RolePolicyAttachment('lambda-fullAccess-role-attachment-' + env, {
    role: lambdaRole.name,
    policyArn: 'arn:aws:iam::aws:policy/AWSLambda_FullAccess',
  });

  return lambdaRole;
}

function createPuppeteerProxyLambdaRole() {
  const config = new pulumi.Config();
  const env = config.require('env');

  const lambdaRole = new aws.iam.Role('lambda-role-puppeteer-proxy-' + env, {
    name: 'lambda-role-puppeteer-proxy-' + env,
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: ['sts:AssumeRole'],
          Effect: 'Allow',
          Principal: {
            Service: 'lambda.amazonaws.com',
          },
        },
      ],
    }),
  });

  new aws.iam.RolePolicyAttachment('lambda-execution-role-puppeteer-proxy-attachment-' + env, {
    role: lambdaRole.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
  });

  // policy for logging
  new aws.iam.RolePolicyAttachment('lambda-fullAccess-role-puppeteer-proxy-attachment-' + env, {
    role: lambdaRole.name,
    policyArn: 'arn:aws:iam::aws:policy/AWSLambda_FullAccess',
  });

  return lambdaRole;
}

export function getLambdaRole() {
  if (!lambdaRole) {
    lambdaRole = createLambdaRole();
    return lambdaRole;
  } else {
    return lambdaRole;
  }
}

export function getPuppeteerProxyLambdaRole() {
  if (!lambdaRolePuppeteerProxy) {
    lambdaRolePuppeteerProxy = createPuppeteerProxyLambdaRole();
    return lambdaRolePuppeteerProxy;
  } else {
    return lambdaRolePuppeteerProxy;
  }
}
