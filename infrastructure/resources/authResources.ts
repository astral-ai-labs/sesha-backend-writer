import * as aws from '@pulumi/aws';
import { Role } from '@pulumi/aws/iam';
import * as pulumi from '@pulumi/pulumi';
import { VpcInfo } from '..';
import { getLambdaCodeArchive, getLambdaRole } from '../utils/pulumi-utils';

export function setupCognitoLambdas(lambdaRole: Role) {
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
  const verificationCodeLambda = new aws.lambda.Function('verification-code-' + env, {
    name: 'verification-code-' + env,
    code: codeArchive,
    handler: 'index.verificationCodeLambda',
    ...lambdaSettings,
  });
  const forgotPasswordLambda = new aws.lambda.Function('forgot-password-' + env, {
    name: 'forgot-password-' + env,
    code: codeArchive,
    handler: 'index.forgotPasswordLambda',
    ...lambdaSettings,
  });

  return { verificationCodeLambda, forgotPasswordLambda };
}

export function setupAuthResources() {
  const config = new pulumi.Config();
  const env = config.require('env');
  const lambdaRole = getLambdaRole();

  // const { verificationCodeLambda, forgotPasswordLambda } = setupCognitoLambdas(lambdaRole);

  // Create a new KMS Key
  // const emailKmsKey = new aws.kms.Key('email-kms-key-' + env, {
  //   description: 'KMS key for encrypting Cognito emails',
  //   enableKeyRotation: true,
  // });

  // cognito - authentication -------------------------------------------
  const userPool = new aws.cognito.UserPool('sesha-users-' + env, {
    name: 'sesha-users-' + env,
    autoVerifiedAttributes: ['email'],
    usernameAttributes: ['email'],
    mfaConfiguration: 'OFF',
    verificationMessageTemplate: {
      defaultEmailOption: 'CONFIRM_WITH_CODE',
      emailSubject: 'Sesha Systems - Verification Code',
      emailMessage: `<!DOCTYPE html>
      <html lang="en">
      <head>
      <title>Verification Code</title>
      </head>
      <body>
        <div style="font-family: 'Arial', sans-serif; color: #333333; text-align: center; padding: 40px;">
          <h1 style="color: #333333;">Sesha Systems</h1>
          <p>Thank you for signing up. Here is your verification code:</p>
          <div style="margin: 20px auto; padding: 20px; border-radius: 5px; background-color: #f2f2f2; display: inline-block;">
            <code style="font-size: 2em; color: #2F4F4F;">{####}</code>
          </div>
          <p style="font-size: 0.9em;">If you did not request this code, please ignore this email.</p>
        </div>
        <div style="text-align: center; padding: 20px; font-size: 0.8em; color: #777777;">
          <p>&copy; <span id="year"></span> Sesha Systems. All rights reserved.</p>
        </div>
        <script>
          document.getElementById('year').textContent = new Date().getFullYear();
        </script>
      </body>
      </html>
      `,
    },
    passwordPolicy: {
      minimumLength: 8,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: false,
      requireUppercase: true,
    },
  });

  new aws.cognito.UserPoolClient('sesha-users-client-' + env, {
    name: 'sesha-users-client-' + env,
    userPoolId: userPool.id,
    explicitAuthFlows: [
      'ALLOW_USER_PASSWORD_AUTH',
      'ALLOW_CUSTOM_AUTH',
      'ALLOW_USER_SRP_AUTH',
      'ALLOW_REFRESH_TOKEN_AUTH',
    ],
    refreshTokenValidity: 365, //days
  });

  // Grant Cognito service to invoke the Lambda function
  // new aws.lambda.Permission('allow-cognito-to-invoke-verification-email-lambda-' + env, {
  //   action: 'lambda:*',
  //   function: verificationCodeLambda.name,
  //   principal: 'cognito-idp.amazonaws.com',
  //   sourceArn: userPool.arn,
  // });
  // new aws.lambda.Permission('allow-cognito-to-invoke-forgot-password-lambda-' + env, {
  //   action: 'lambda:*',
  //   function: forgotPasswordLambda.name,
  //   principal: 'cognito-idp.amazonaws.com',
  //   sourceArn: userPool.arn,
  // });
}
