import * as aws from '@pulumi/aws';
import { Role } from '@pulumi/aws/iam';
import { Bucket } from '@pulumi/aws/s3';
import * as pulumi from '@pulumi/pulumi';
import { getLambdaCodeArchive, getLambdaRole } from '../utils/pulumi-utils';
import { ArticleGenerationFunctions } from '../utils/pulumi-utils';
import { Function } from '@pulumi/aws/lambda';
import { getFunction } from '@pulumi/aws/lambda/getFunction';

export function setupStepFunctionLambdas(lambdaRole: Role): Record<ArticleGenerationFunctions, Function> {
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
  const postRunHookMakeEndpoint = config.requireSecret('postRunHookMakeEndpoint');
  const proxyNetworkServer = config.requireSecret('proxyNetworkServer');
  const proxyNetworkUsername = config.requireSecret('proxyNetworkUsername');
  const proxyNetworkPassword = config.requireSecret('proxyNetworkPassword');
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
        cognitoUserPoolId,
        promptSheetId,
        analyticsSheetId,
        googleServiceAccountEmail,
        googleServiceAccountPrivateKey,
        postRunHookMakeEndpoint,
        mixpanelToken,
        proxyNetworkServer,
        proxyNetworkUsername,
        proxyNetworkPassword,
      },
    },
  };

  const functions: any = {};

  for (let i = 0; i < Object.keys(ArticleGenerationFunctions).length; i++) {
    const functionName = Object.keys(ArticleGenerationFunctions)[i];
    functions[functionName] = new aws.lambda.Function(functionName + '-' + env, {
      name: functionName + '-' + env,
      code: codeArchive,
      handler: 'index.articleGenerationLambdas.' + functionName,
      ...lambdaSettings,
    });
  }

  return functions;
}

export async function setupStepFunctionResources() {
  const config = new pulumi.Config();
  const env = config.require('env');
  const lambdaRole = getLambdaRole();

  const lambdas = setupStepFunctionLambdas(lambdaRole);

  const lambdaArns: Record<ArticleGenerationFunctions, string> = {} as any;

  for (let i = 0; i < Object.keys(ArticleGenerationFunctions).length; i++) {
    const functionName = Object.keys(ArticleGenerationFunctions)[i] + `-${env}`;
    const lambda = await getFunction({ functionName: functionName });
    lambdaArns[Object.keys(ArticleGenerationFunctions)[i]] = lambda.arn + `:$LATEST`;
  }

  // Step Function State S3 Bucket
  new Bucket(`step-function-state-${env}`, {
    bucket: `step-function-state-${env}`,
    acl: 'private',
    serverSideEncryptionConfiguration: {
      rule: {
        bucketKeyEnabled: true,
        applyServerSideEncryptionByDefault: {
          sseAlgorithm: 'aws:kms',
        },
      },
    },
    versioning: {
      enabled: true,
    },
  });

  // Prompts CSVs S3 Bucket
  new Bucket(`prompt-csv-${env}`, {
    bucket: `prompt-csv-${env}`,
    acl: 'private',
    serverSideEncryptionConfiguration: {
      rule: {
        bucketKeyEnabled: true,
        applyServerSideEncryptionByDefault: {
          sseAlgorithm: 'aws:kms',
        },
      },
    },
    versioning: {
      enabled: true,
    },
  });

  // common Retry configuration
  const Retry = [
    {
      ErrorEquals: ['States.TaskFailed'],
      IntervalSeconds: 1,
      MaxAttempts: 10,
      MaxDelaySeconds: 30,
      BackoffRate: 2,
    },
  ];

  // TODO - with state machines as straight forward like these, we can generate the difiniton programatically as well
  const articleStateMachineDefinition = {
    Comment: 'Article state machine',
    StartAt: 'createInitialSourcesArray',
    States: {
      createInitialSourcesArray: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.createInitialSourcesArray,
        },
        Retry,
        Next: 'factsBitsAggregator',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      factsBitsAggregator: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.factsBitsAggregator,
        },
        Retry,
        Next: 'factsBitsAggregator2',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      factsBitsAggregator2: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.factsBitsAggregator2,
        },
        Retry,
        Next: 'cleanUpFactsAggregator',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      cleanUpFactsAggregator: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.cleanUpFactsAggregator,
        },
        Retry,
        Next: 'articlePreparationOne',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      articlePreparationOne: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.articlePreparationOne,
        },
        Retry,
        Next: 'headlinesAndBlobs',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      headlinesAndBlobs: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.headlinesBlobs,
        },
        Retry,
        Next: 'articlePreparationTwo',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      articlePreparationTwo: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.articlePreparationTwo,
        },
        Retry,
        Next: 'quotePicking',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      quotePicking: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.quotePicking,
        },
        Retry,
        Next: 'articleWriting',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      articleWriting: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.articleWriting,
        },
        Retry,
        Next: 'rewritingPrompt',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      rewritingPrompt: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.rewritingArticle,
        },
        Retry,
        Next: 'finalizationOne',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      finalizationOne: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.finalizationOne,
        },
        Retry,
        Next: 'finalizationTwo',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      finalizationTwo: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.finalizationTwo,
        },
        Retry,
        Next: 'aggregatorArticleAttribution',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      aggregatorArticleAttribution: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.aggregatorArticleAttribution,
        },
        Retry,
        Next: 'analyticsStep',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      analyticsStep: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.analyticsStep,
        },
        Retry,
        Next: 'postRunHook',
      },
      postRunHook: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.postRunHook,
        },
        Retry,
        End: true,
      },
    },
  };
  const digestStateMachineDefinition = {
    Comment: 'digest generation state machine',
    StartAt: 'createInitialSourcesArray',
    States: {
      createInitialSourcesArray: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.createInitialSourcesArray,
        },
        Retry,
        Next: 'factsBitsDigest',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      factsBitsDigest: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.factsBitsDigest,
        },
        Retry,
        Next: 'cleanupFactsVerbatimChoice',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      cleanupFactsVerbatimChoice: {
        Type: 'Choice',
        Choices: [
          {
            Variable: '$.source.useVerbatim',
            BooleanEquals: true,
            Next: 'articlePreparationOne',
          },
          {
            Variable: '$.source.useVerbatim',
            BooleanEquals: false,
            Next: 'cleanUpFactsDigest',
          },
        ],
        Default: 'cleanUpFactsDigest',
      },
      cleanUpFactsDigest: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.cleanUpFactsDigest,
        },
        Retry,
        Next: 'articlePreparationOne',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      articlePreparationOne: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.articlePreparationOne,
        },
        Retry,
        Next: 'headlinesBlobs',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      headlinesBlobs: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.headlinesBlobs,
        },
        Retry,
        Next: 'articlePreparationTwoVerbatimChoice',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      articlePreparationTwoVerbatimChoice: {
        Type: 'Choice',
        Choices: [
          {
            Variable: '$.source.useVerbatim',
            BooleanEquals: true,
            Next: 'articleWriting',
          },
          {
            Variable: '$.source.useVerbatim',
            BooleanEquals: false,
            Next: 'articlePreparationTwo',
          },
        ],
        Default: 'articlePreparationTwo',
      },
      articlePreparationTwo: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.articlePreparationTwo,
        },
        Retry,
        Next: 'quotePicking',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      quotePicking: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.quotePicking,
        },
        Retry,
        Next: 'articleWriting',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      articleWriting: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.articleWriting,
        },
        Retry,
        Next: 'rewritingArticle',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      rewritingArticle: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.rewritingArticle,
        },
        Retry,
        Next: 'finalizationOne',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      finalizationOne: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.finalizationOne,
        },
        Retry,
        Next: 'finalizationTwo',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      finalizationTwo: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.finalizationTwo,
        },
        Retry,
        Next: 'digestArticleAttribution',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      digestArticleAttribution: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.digestArticleAttribution,
        },
        Retry,
        Next: 'analyticsStep',
        Catch: [
          {
            ErrorEquals: ['States.ALL'],
            Next: 'analyticsStep',
            ResultPath: '$.errorInfo',
          },
        ],
      },
      analyticsStep: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.analyticsStep,
        },
        Retry,
        Next: 'postRunHook',
      },
      postRunHook: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        OutputPath: '$.Payload',
        Parameters: {
          'Payload.$': '$',
          FunctionName: lambdaArns.postRunHook,
        },
        Retry,
        End: true,
      },
    },
  };

  // role
  const stepFuncionRole = new aws.iam.Role('step-function-role-' + env, {
    name: 'step-function-role-' + env,
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: ['sts:AssumeRole'],
          Effect: 'Allow',
          Principal: {
            Service: 'states.amazonaws.com',
          },
        },
      ],
    }),
  });

  // resources full Access Policy
  const resourcesFullAccessPolicy = new aws.iam.Policy('resources-full-access-policy-' + env, {
    name: 'resources-full-access-policy-' + env,
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: 'lambda:*',
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: 'xray:*',
          Resource: '*',
        },
      ],
    }),
  });

  new aws.iam.RolePolicyAttachment('resources-full-access-policy-attachment-' + env, {
    role: stepFuncionRole.name,
    policyArn: resourcesFullAccessPolicy.arn,
  });

  //state machines
  const articleStateMachine = new aws.sfn.StateMachine(
    'article-state-machine-' + env,
    {
      name: 'article-state-machine-' + env,
      roleArn: stepFuncionRole.arn,
      definition: JSON.stringify(articleStateMachineDefinition),
    },
    { dependsOn: Object.values(lambdas) },
  );

  const digestStateMachine = new aws.sfn.StateMachine(
    'digest-state-machine-' + env,
    {
      name: 'digest-state-machine-' + env,
      roleArn: stepFuncionRole.arn,
      definition: JSON.stringify(digestStateMachineDefinition),
    },
    { dependsOn: Object.values(lambdas) },
  );
}
