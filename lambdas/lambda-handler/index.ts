import {
  APIGatewayProxyHandlerV2,
  CustomMessageForgotPasswordTriggerEvent,
  CustomMessageTriggerEvent,
} from 'aws-lambda';
import { processPipelineInput, summarizeSource } from './gptHelpers';
import axios, { AxiosProxyConfig } from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { v4 as uuidv4 } from 'uuid';
import AWS, { SES } from 'aws-sdk';
// import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  AdminConfirmSignUpCommand,
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  AdminUserGlobalSignOutCommand,
  AuthFlowType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  MessageActionType,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import HTMLtoDOCX from 'html-to-docx';
import { getRawPrompts, insertArticleAnalyticsData } from './sheetHelpers';
import {
  AnalyticsInfo,
  GenerateAggregratorBody as GenerateAggregatorBody,
  GenerateDigestBody,
  MultiSourceInput,
  ParsedPrompt,
  SingleSourceInput,
  SourceType,
  searchPaths,
} from './types';
import { AiCSVs, AiSheets, Tables, TablesIndexes } from './enums';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import Mixpanel from 'mixpanel';
import { GetObjectOutput } from 'aws-sdk/clients/s3';
import { JSONPath } from 'jsonpath-plus';

// aws sdk
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const stepFunctions = new AWS.StepFunctions();
// TODO change token to proper sesha mixpanel projects
const mixpanel = Mixpanel.init(process.env.mixpanelToken as string);

// ANCHOR router
export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  console.log(`----- Received event -----\n${JSON.stringify(event)}`);

  let path = event.rawPath;
  let method = event.requestContext.http.method;
  let body: any = {};
  let queryStringParameters = {};

  //handle preflight - cors issue
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*',
      },
    };
  }

  if (event.body) {
    body = JSON.parse(event.body);
  }

  if (event.queryStringParameters) {
    queryStringParameters = event.queryStringParameters;
  }

  // Define the handlers for different paths
  switch (path) {
    case `/${process.env.env}/test-email`:
    case `/${process.env.env}/test-email/`:
      return await sesFunctions.sendArticleCompletionEmail({
        articleSlug: 'hello.com',
        articleUrl: 'hello.com',
        userEmail: 'muhammadpen@gmail.com',
        username: 'muhammadpen',
      });
    // if a request fails on UI, it will be responsible to run the second, third etc
    case `/${process.env.env}/fetch-source`:
    case `/${process.env.env}/fetch-source/`:
      return await fetchSiteText1(body, queryStringParameters);
    case `/${process.env.env}/fetch-source-2`:
    case `/${process.env.env}/fetch-source-2/`:
      return await fetchSiteText2(body, queryStringParameters);
    case `/${process.env.env}/fetch-source-3`:
    case `/${process.env.env}/fetch-source-3/`:
      return await fetchSiteText3(body, queryStringParameters);

    //ANCHOR - search
    case `/${process.env.env}/search-term`:
    case `/${process.env.env}/search-term/`:
      return await searchFunctions.searchTerm(body);
    case `/${process.env.env}/filter-articles`:
    case `/${process.env.env}/filter-articles/`:
      return await searchFunctions.filterArticles(body);
    case `/${process.env.env}/add-item-to-search-index`:
    case `/${process.env.env}/add-item-to-search-index/`:
      return await searchFunctions.addItemToSearchIndex(body);
    case `/${process.env.env}/add-bulk-items-to-search-index`:
    case `/${process.env.env}/add-bulk-items-to-search-index/`:
      return await searchFunctions.addBulkItemsToSearchIndex(body);
    case `/${process.env.env}/test-search`:
    case `/${process.env.env}/test-search/`:
      return await searchFunctions.testSearch();
    case `/${process.env.env}/get-search-item`:
    case `/${process.env.env}/get-search-item/`:
      return await searchFunctions.getSearchItem(body);
    case `/${process.env.env}/create-index`:
    case `/${process.env.env}/create-index/`:
      return await searchFunctions.createIndex(body);
    case `/${process.env.env}/delete-index`:
    case `/${process.env.env}/delete-index/`:
      return await searchFunctions.deleteIndex(body);

    //ANCHOR - article
    case `/${process.env.env}/generate-digest`:
    case `/${process.env.env}/generate-digest/`:
      return await articleFunctions.generateDigest(body, queryStringParameters);
    case `/${process.env.env}/generate-article`:
    case `/${process.env.env}/generate-article/`:
      return await articleFunctions.generateArticle(body, queryStringParameters);
    case `/${process.env.env}/cancel-articles`:
    case `/${process.env.env}/cancel-articles/`:
      return await articleFunctions.cancelArticles(body);
    case `/${process.env.env}/fetch-articles-by-slug`:
    case `/${process.env.env}/fetch-articles-by-slug/`:
      return await articleFunctions.fetchArticlesBySlug(body);
    case `/${process.env.env}/get-article-by-id`:
    case `/${process.env.env}/get-article-by-id/`:
      return await articleFunctions.getArticleById(body);
    case `/${process.env.env}/get-article-by-params`:
    case `/${process.env.env}/get-article-by-params/`:
      return await articleFunctions.getArticle(body);
    case `/${process.env.env}/archive-articles`:
    case `/${process.env.env}/archive-articles/`:
      return await articleFunctions.archiveArticles(body);
    case `/${process.env.env}/unarchive-articles`:
    case `/${process.env.env}/unarchive-articles/`:
      return await articleFunctions.unarchiveArticles(body);
    case `/${process.env.env}/article-to-docx`:
    case `/${process.env.env}/article-to-docx/`:
      return await articleFunctions.articleToDocx(body);
    case `/${process.env.env}/article-to-pdf`:
    case `/${process.env.env}/article-to-pdf/`:
      return await articleFunctions.articleToPdf(body);
    case `/${process.env.env}/send-article-as-email`:
    case `/${process.env.env}/send-article-as-email/`:
      return await articleFunctions.sendArticleAsEmail(body);

    //ANCHOR - auth
    case `/${process.env.env}/user-sign-in`:
    case `/${process.env.env}/user-sign-in/`:
      return await authFunctions.userSignIn(body);
    case `/${process.env.env}/forgot-password`:
    case `/${process.env.env}/forgot-password/`:
      return await authFunctions.forgotPassword(body);
    case `/${process.env.env}/confirm-forgot-password`:
    case `/${process.env.env}/confirm-forgot-password/`:
      return await authFunctions.confirmForgotPassword(body);
    case `/${process.env.env}/user-signup`:
    case `/${process.env.env}/user-signup/`:
      return await authFunctions.userSignup(body);
    case `/${process.env.env}/create-organization`:
    case `/${process.env.env}/create-organization/`:
      return await authFunctions.createOrganization(body);
    case `/${process.env.env}/confirm-signup`:
    case `/${process.env.env}/confirm-signup/`:
      return await authFunctions.confirmUserSignUp(body);
    case `/${process.env.env}/validate-organization-id`:
    case `/${process.env.env}/validate-organization-id/`:
      return await authFunctions.validateOrgId(body);
    case `/${process.env.env}/resend-verification-code`:
    case `/${process.env.env}/resend-verification-code/`:
      return await authFunctions.resendVerificationCode(body);
    case `/${process.env.env}/user-sign-out`:
    case `/${process.env.env}/user-sign-out/`:
      return await authFunctions.userSignOut(body);
    case `/${process.env.env}/validate-access-token`:
    case `/${process.env.env}/validate-access-token/`:
      return await authFunctions.validateAccessToken(body);
    case `/${process.env.env}/refresh-access-token`:
    case `/${process.env.env}/refresh-access-token/`:
      return await authFunctions.refreshAccessToken(body);
    case `/${process.env.env}/get-user-info`:
    case `/${process.env.env}/get-user-info/`:
      return await authFunctions.getUserInfo(body);

    //ANCHOR - database
    case `/${process.env.env}/list-table`:
    case `/${process.env.env}/list-table/`:
      return await databaseFunctions.listDBTable({ tableName: body.tableName });
    case `/${process.env.env}/read-database-entry`:
    case `/${process.env.env}/read-database-entry/`:
      return await databaseFunctions.readDBEntry(body.tableName, { id: body.id });
    case `/${process.env.env}/create-library-entry`:
    case `/${process.env.env}/create-library-entry/`:
      return await databaseFunctions.createLibraryEntry(body);
    case `/${process.env.env}/list-presets`:
    case `/${process.env.env}/list-presets/`:
      return await databaseFunctions.listPresets({ orgId: body.orgId });
    case `/${process.env.env}/save-preset`:
    case `/${process.env.env}/save-preset/`:
      return await databaseFunctions.createDBEntry(Tables.settingsPresets, body);
    case `/${process.env.env}/query-library`:
    case `/${process.env.env}/query-library/`:
      return await databaseFunctions.queryLibrary(body);
    case `/${process.env.env}/slug-exists`:
    case `/${process.env.env}/slug-exists/`:
      return await databaseFunctions.doesSlugExist(body);
    case `/${process.env.env}/orgName-exists`:
    case `/${process.env.env}/orgName-exists/`:
      return await databaseFunctions.doesOrgNameExist(body);
    case `/${process.env.env}/query-analytics`:
    case `/${process.env.env}/query-analytics/`:
      return await databaseFunctions.queryAnalytics(body);
    case `/${process.env.env}/fetch-users-by-org-id`:
    case `/${process.env.env}/fetch-users-by-org-id/`:
      return await databaseFunctions.fetchUsersByOrgid(body);

    default:
      return helperFunctions.createResponse(404, JSON.stringify({ error: path + ' Not Found' }));
  }
};

export const verificationCodeLambda = async (event: CustomMessageTriggerEvent, context: any, callback: any) => {
  console.log('👤 verification request', event);

  const email = event.request.userAttributes.email;
  const verificationCode = event.request.codeParameter;

  // let customEmailContent = emailHtml.verificationCode;
  // customEmailContent = customEmailContent
  //   .replace('{{first_name}}', email.split('@')[0])
  //   .replace('{{ Verification_code }}', verificationCode);

  let customEmailContent = `This is your verification code 🔑🔑🔑🔑: ${verificationCode}`;
  if (event.triggerSource === 'CustomMessage_SignUp') {
    event.response = {
      emailSubject: 'Your Verification Code',
      emailMessage: customEmailContent,
      smsMessage: customEmailContent,
    };
  }

  // Return the event object back to Cognito
  callback(null, event);
};

export const forgotPasswordLambda = async (event: CustomMessageForgotPasswordTriggerEvent, context: any) => {
  console.log('🔒 forgot password event', event);

  const email = event.request.userAttributes.email; // User's email address
  const recoveryCode = event.request.codeParameter; // The verification code or the reset code
  const triggerSource = event.triggerSource; // Identifies the trigger source

  console.log('🔒🔒🔒 code parameter', event);

  // Ensure this Lambda function only responds to the forgot password trigger
  if (triggerSource !== 'CustomMessage_ForgotPassword') {
    return event;
  }

  await sesFunctions.sendForgotPasswordEmail({
    userEmail: email,
    username: email.split('@')[0],
    recoveryCode: recoveryCode,
  });

  // Return the event object back to Cognito
  return event;
};

interface S3FileUpload {
  region: string;
  key: string;
  bucket: string;
  data: string;
  retry: number;
}

interface S3FileDownload {
  region: string;
  key: string;
  bucket: string;
  retry: number;
}

// max number of times to retry an S3 upload or download step
const intMaxS3Retries = 5;

// uploads a given S3 Object with built-in retry every 2 seconds for any catch state
const runS3FileUpload = async ({
  region,
  key,
  bucket,
  data,
  retry,
}: S3FileUpload): Promise<AWS.S3.ManagedUpload.SendData> =>
  await new Promise(async (resolve, reject) => {
    if (retry > intMaxS3Retries)
      reject(`failed s3 upload after : ${intMaxS3Retries} retries : region=${region}, bucket=${bucket}, key=${key}`);
    if (retry <= intMaxS3Retries) {
      console.log(`⬆️ begin upload of s3 object : region=${region}, bucket=${bucket}, key=${key}`);
      if (retry > 0) console.log(`....retry ${retry}`);
      try {
        const s3 = new AWS.S3({ region });
        const uploadResult: AWS.S3.ManagedUpload.SendData = await new Promise((resolve_2, reject_2) =>
          s3.upload({ Key: key, Bucket: bucket, Body: data }, (err, data) => (err ? reject_2(err) : resolve_2(data))),
        );
        console.log(`⬆️ s3 object upload complete : region=${region}, bucket=${bucket}, key=${key}`);
        resolve(uploadResult);
      } catch (e) {
        console.error('⬆️ unknown error in runS3FileUpload');
        console.trace(e);
        setTimeout(async () => resolve(await runS3FileUpload({ region, key, bucket, data, retry: retry + 1 })), 2000);
      }
    }
  });

// downloads a given S3 Object with built-in retry every 2 seconds for any catch state
export const runS3FileDownload = async ({
  region,
  key,
  bucket,
  retry,
}: S3FileDownload): Promise<AWS.S3.GetObjectOutput> =>
  await new Promise(async (resolve, reject) => {
    if (retry > intMaxS3Retries)
      reject(`failed s3 download after : ${intMaxS3Retries} retries : region=${region}, bucket=${bucket}, key=${key}`);
    if (retry <= intMaxS3Retries) {
      console.log(`⬇️ begin download of s3 object : region=${region}, bucket=${bucket}, key=${key}`);
      if (retry > 0) console.log(`....retry ${retry}`);
      try {
        const s3 = new AWS.S3({ region });
        const downloadResult: AWS.S3.GetObjectOutput = await new Promise((resolve_2, reject_2) =>
          s3.getObject({ Key: key, Bucket: bucket }, (err, data) => (err ? reject_2(err) : resolve_2(data))),
        );
        console.log(`⬇️ s3 object download complete : region=${region}, bucket=${bucket}, key=${key}`);
        resolve(downloadResult);
      } catch (e) {
        console.error('⬇️ unknown error in runS3FileDownload');
        console.trace(e);
        setTimeout(async () => resolve(await runS3FileDownload({ region, key, bucket, retry: retry + 1 })), 2000);
      }
    }
  });

// this function takes an arbitrary JSON input and extracts certain fields
// that should always be included in the output for S3 State
const extractFieldsToAlwaysInclude = (input: any) => {
  const fieldsToAlwaysInclude = ['$.source.useVerbatim'];
  try {
    if (fieldsToAlwaysInclude.length) {
      let outputIncludingAlwaysFields: any = {};
      fieldsToAlwaysInclude.forEach((field: string) => {
        const fieldSplit = field.split('.');
        if (fieldSplit.length > 3) console.error('only fields up to 2 levels are enabled');
        if (fieldSplit.length < 2) console.error('at least one field level is required');
        if (fieldSplit.length > 1 && fieldSplit.length < 4) {
          const currentFieldResult = JSONPath({
            path: field,
            resultType: 'parent',
            wrap: false,
            json: typeof input === 'object' ? input : JSON.parse(input),
          });
          if (currentFieldResult) console.log(`no output found for field : ${field}`);
          if (currentFieldResult) {
            console.log(`output extracted for field : ${field}`);

            // FOR ONE Layer fields (eg, "$.source")
            if (fieldSplit.length === 2) {
              // append the result to the output
              outputIncludingAlwaysFields = {
                ...outputIncludingAlwaysFields,
                [fieldSplit[1]]: currentFieldResult[fieldSplit[1]],
              };
            }

            // FOR TWO Layer fields (eg, "$.source.useVerbatim")
            if (fieldSplit.length === 3) {
              let updatedField = outputIncludingAlwaysFields[fieldSplit[1]]
                ? outputIncludingAlwaysFields[fieldSplit[1]]
                : {};
              updatedField[fieldSplit[2]] = currentFieldResult[fieldSplit[2]];

              // append the result to the output
              outputIncludingAlwaysFields = {
                ...outputIncludingAlwaysFields,
                [fieldSplit[1]]: updatedField,
              };
            }
          }
        }
      });
      if (outputIncludingAlwaysFields && Object.keys(outputIncludingAlwaysFields).length) {
        console.log('returning output that contains always include fields');
        return outputIncludingAlwaysFields;
      }
    }
  } catch (e) {
    console.error('unexpected error in extractFieldsToAlwaysInclude');
    console.trace(e);
  }

  // default return empty object
  console.log('returning output with no fields');
  return {};
};

// TODO once confirmed behaivor, remove feature flag logic for initial state
// depending
const generateStepFunctionInput = async (stateMachineArn: string, inputData: SingleSourceInput | MultiSourceInput) => {
  const stringifiedData = JSON.stringify(inputData);
  try {
    const blEnableS3 = process.env.featureStepFunctionS3Enabled === 'true';

    // UPDATED behavior (true) - write input data to S3 and pass the object URI
    if (blEnableS3) {
      console.log(`step function input behavior : updated s3`);
      const timeStamp = new Date(new Date().toISOString()).valueOf();
      const stepFunctionName = stateMachineArn.split(':').slice(-1);
      const bucketName = `step-function-state-${process.env.env}`;
      const fileName = '00.json';
      const uniqueId = uuidv4().replace(/-/g, '');
      const key = `${stepFunctionName}/${timeStamp}_${uniqueId}/${fileName}`;
      const s3URI = `s3://${bucketName}/${key}`;
      const uploadResult = await runS3FileUpload({
        region: `${process.env.region}`,
        key,
        bucket: bucketName,
        data: stringifiedData,
        retry: 0,
      });
      console.log(`S3 Upload Result : `, uploadResult);
      const jsonContentToWrite = {
        s3URI: `${s3URI}`,
        ...extractFieldsToAlwaysInclude(inputData),
      };
      const s3StringifiedInputData = JSON.stringify(jsonContentToWrite);
      return s3StringifiedInputData;
    }
  } catch (e) {
    console.error('unexpected error in generateStepFunctionInput');
    console.trace(e);
  }

  // LEGACY behavior (false) - pass input data for all other cases (feature disabled, upload errors, other issues)
  console.log(`step function input behavior : legacy`);
  return stringifiedData;
};

// ANCHOR article
const articleFunctions = {
  articleToHtml: async (options: { articleId: string; articleData?: any; date: any }) => {
    const articleId = options.articleId;
    const date = options.date;
    let articleHeadline: undefined | string = undefined;
    let articleBlobs = [''];
    let articleContent = '';
    let articleData: any;

    if (options.articleData) {
      articleData = options.articleData;
    } else {
      articleData = await articleFunctions.getArticleById({ id: articleId });
      articleData = helperFunctions.deepJSONParse(articleData.body);
      articleData = articleData.response.Items[0];
    }

    // this is for old articles whose headlinesAndBlobs were just text
    if (articleData?.headlinesAndBlobs.text) {
      const headlinesAndBlobs = helperFunctions.deepJSONParse(articleData.headlinesAndBlobs.text);
      articleHeadline = headlinesAndBlobs.headline;
      articleBlobs = headlinesAndBlobs.blobs;
    } else {
      const headlinesAndBlobs = helperFunctions.deepJSONParse(articleData.headlinesAndBlobs as unknown as string);
      articleHeadline = headlinesAndBlobs.headline;
      articleBlobs = headlinesAndBlobs.blobs;
    }
    articleContent = articleData.digest.result;
    articleContent = helperFunctions.replaceNewlinesWithBrTags(articleContent);
    articleContent = helperFunctions.removeBackslashes(articleContent);
    articleContent = helperFunctions.replaceConsecutiveDoubleQuotes(articleContent);
    articleContent = helperFunctions.removeQuotes(articleContent);

    articleHeadline = helperFunctions.removeBackslashes(articleHeadline as string);
    articleHeadline = helperFunctions.removeQuotes(articleHeadline);

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <p> <b> Slug: ${articleData.slug} </b>  <b>Version: ${
      articleData.version
    } </b> Export by: ${articleData?.authorName} on: ${date}</p>
    
    <hr/>

      <h2>${articleHeadline}</h2>

      <ul>
        ${articleBlobs.map((blob) => `<li> <b>${blob}</b> </li>`).join('')}
      </ul>

      ${articleContent}
      </html>
    `;

    // Remove all <br> tags from the final HTML string
    const finalHtml = html.replace(/<br\s*\/?>/gi, '');

    if (articleData.sourceType === 'multi') {
      return finalHtml;
    } else {
      return html;
    }
  },
  articleToDocx: async (body: { articleId: string; date: any }) => {
    const html = await articleFunctions.articleToHtml(body);
    const docxFileUrl = await helperFunctions.convertHtmlToDocx(html);
    return helperFunctions.createResponse(200, JSON.stringify({ response: docxFileUrl }));
  },
  articleToPdf: async (body: { articleId: string; date: any }) => {
    const html = await articleFunctions.articleToHtml(body);
    const docxFileUrl = await helperFunctions.convertHtmlToPdf(html);
    return helperFunctions.createResponse(200, JSON.stringify({ response: docxFileUrl }));
  },
  sendArticleAsEmail: async (body: {
    recipientEmails: string[];
    customContent?: string;
    articleId: string;
    senderEmail: string;
  }) => {
    try {
      const articleId = body.articleId;
      let articleData: any = await articleFunctions.getArticleById({ id: articleId });
      articleData = helperFunctions.deepJSONParse(articleData.body);
      articleData = articleData.response.Items[0];

      // const articleUrl =
      //   process.env.env === 'prod'
      //     ? 'app.seshasystems.com'
      //     : 'app.dev.seshasystems.com' +
      //       `/article?slug=${encodeURIComponent(articleData.slug)}&version=${articleData.version}`;

      let articleHtml = await articleFunctions.articleToHtml({
        articleId,
        articleData,
        date: new Date().toDateString(),
      });

      articleHtml = `
      ${body.customContent} \n\n

      <hr/>

      ${articleHtml}`;

      // Function to split array into chunks
      const chunkArray = (arr: any[], chunkSize: number) => {
        let result = [];
        for (let i = 0; i < arr.length; i += chunkSize) {
          result.push(arr.slice(i, i + chunkSize));
        }
        return result;
      };

      // Check if recipientEmails length is greater than 50
      if (body.recipientEmails.length > 50) {
        // Split recipientEmails into chunks of 50
        const emailChunks = chunkArray(body.recipientEmails, 50);
        // Loop through each chunk and send emails
        for (const chunk of emailChunks) {
          await sesFunctions.sendEmailWithContent(
            chunk,
            articleHtml,
            `"${articleData.slug}" Version: ${articleData.version}`,
            [body.senderEmail],
          );
        }
      } else {
        // If 50 or less, send all emails at once
        await sesFunctions.sendEmailWithContent(
          body.recipientEmails,
          articleHtml,
          `${articleData.slug}-${articleData.version}`,
          [body.senderEmail],
        );
      }

      return helperFunctions.createResponse(200, JSON.stringify({ response: 'emails sent' }));
    } catch (e) {
      return helperFunctions.createResponse(500, JSON.stringify({ response: e }));
    }
  },
  getArticleById: async (body: any) => {
    const params = {
      TableName: Tables.library,
      IndexName: TablesIndexes.articleId,
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': body.id,
      },
    };
    try {
      const data = await dynamoDB.query(params).promise();
      return helperFunctions.createResponse(200, JSON.stringify({ response: data }));
    } catch (err) {
      return helperFunctions.createResponse(500, JSON.stringify({ error: err }));
    }
  },
  getArticle: async (body: { slug: string; orgId: string; version: string }) => {
    const params = {
      TableName: Tables.library,
      IndexName: TablesIndexes.slugVersion,
      KeyConditionExpression: 'slug = :slug and version = :version',
      FilterExpression: 'orgId=:orgId',
      ExpressionAttributeValues: {
        ':slug': body.slug,
        ':orgId': body.orgId,
        ':version': body.version,
      },
    };
    try {
      const data = await dynamoDB.query(params).promise();
      return helperFunctions.createResponse(200, JSON.stringify({ response: data }));
    } catch (err) {
      return helperFunctions.createResponse(500, JSON.stringify({ error: err }));
    }
  },
  fetchArticlesBySlug: async (body: { slug: string }) => {
    const params = {
      TableName: Tables.library,
      IndexName: TablesIndexes.slugTimestamp,
      KeyConditionExpression: 'slug = :slug',
      ExpressionAttributeValues: {
        ':slug': body.slug,
      },
    };
    try {
      const data = await dynamoDB.query(params).promise();
      return helperFunctions.createResponse(200, JSON.stringify({ response: data }));
    } catch (err) {
      return helperFunctions.createResponse(500, JSON.stringify({ error: err }));
    }
  },
  generateArticle: async (body: GenerateAggregatorBody | any, queryStringParameters?: any) => {
    console.log('🗞️', 'ARTICLE STARTED');

    const settings = body.settings;
    const instructions = body.instructions;
    const articleId = uuidv4();

    const orgInfo = await databaseFunctions.readDBEntry(Tables.organizations, { id: body.orgId });

    const dynamodbData: any = {
      id: articleId, // Make sure this matches the primary key structure of your table
      tableName: Tables.library,
      slug: body.slug,
      sources: body.sources,
      timestamp: new Date().valueOf(),
      orgId: body.orgId,
      orgName: orgInfo.name ? orgInfo.name : 'not provided!',
      authorId: body.authorId ? body.authorId : 'a',
      authorName: body.authorName ? body.authorName : 'not provided!',
      authorEmail: body.authorEmail
        ? body.authorEmail
        : process.env.env === 'PROD'
          ? 'no-reply@app.seshasystems.com'
          : 'no-reply@app.dev.seshasystems.com',
      version: body.version ? body.version : '1-00',
      isRerun: body.isRerun,
      sourceType: 'multi',
      progress: '0%',
      errorMessage: '',
      originalInstructions: {
        source: body.sources,
        slug: body.slug,
        settings: {
          tone: settings.tone,
          blobs: settings.blobs,
          length: settings.length,
        },
        instructions: {
          description: instructions.description,
          headlineSuggestion: instructions.headlineSuggestion,
          instructions: instructions.instructions,
        },
      },
    };

    const analyticsData = {
      id: articleId,
      storyId: articleId,
      timeOfCreation: new Date().valueOf(),
      slug: body.slug,
      version: body.version ? body.version : '1-00',
      org: orgInfo.name ? orgInfo.name : 'not provided!',
      username: body.authorName ? body.authorName : 'not provided!',
      userId: body.authorId ? body.authorId : 'not provided!',
      sourceType: 'multi',
      numberOfInputs: body.sources.length,
      totalInputWordLength: body.sources.reduce((acc: number, source: any) => acc + source.words, 0),
      requestedLength: settings.length,
      rerun: body.isRerun,
    };

    const promptsAggregator = await getRawPrompts(
      process.env.env === 'prod' ? AiCSVs.aggregator_prompts : AiCSVs.aggregator_prompts_dev,
      true,
    );
    const stateMachineName = process.env.env === 'prod' ? 'article-state-machine-prod' : 'article-state-machine-dev';

    console.log('🚃 Prompts from CSV: ', promptsAggregator);

    try {
      // pass input and dynamodb entry to digest step function
      const executionArn = await articleFunctions.startArticleStepFunctionExecution(
        `arn:aws:states:${process.env.region}:${process.env.accountId}:stateMachine:${stateMachineName}`,
        {
          prompts: promptsAggregator,
          slug: body.slug,
          dynamodbData: { tableName: Tables.library, ...dynamodbData },
          instructions: instructions,
          settings: settings,
          sources: body.sources,
          articleType: 'multi',
        },
      );

      dynamodbData['executionArn'] = executionArn;

      // create dynamodb entries
      await databaseFunctions.createDBEntry(Tables.library, dynamodbData);
      await databaseFunctions.createDBEntry(Tables.articleAnalytics, analyticsData);

      // return dynamodb id to user
      return helperFunctions.createResponse(
        200,
        JSON.stringify({ tableName: Tables.library, DBId: articleId, executionArn: executionArn }),
      );
    } catch (e) {
      console.log('🔴 error executing step function', e);
      return helperFunctions.createResponse(500, JSON.stringify(e));
    }
  },
  generateDigest: async (body: GenerateDigestBody | any, queryStringParameters?: any) => {
    console.log('📰', 'DIGEST STARTED');

    let source = body.source;
    const settings = body.settings;
    const instructions = body.instructions;

    const digestId = uuidv4();

    console.log('🏓 table name: ', Tables.library);

    const orgInfo = await databaseFunctions.readDBEntry(Tables.organizations, { id: body.orgId });

    const dynamodbData: any = {
      id: digestId, // Make sure this matches the primary key structure of your table
      tableName: Tables.library,
      slug: body.slug,
      source: source,
      timestamp: new Date().valueOf(),
      orgId: body.orgId,
      orgName: orgInfo.name ? orgInfo.name : 'sesha systems',
      authorId: body.authorId ? body.authorId : 'a',
      authorName: body.authorName ? body.authorName : 'sesha systems',
      authorEmail: body.authorEmail
        ? body.authorEmail
        : process.env.env === 'PROD'
          ? 'no-reply@app.seshasystems.com'
          : 'no-reply@app.dev.seshasystems.com',
      version: body.version ? body.version : '1-00',
      sourceType: 'single',
      progress: '0%',
      errorMessage: '',
      originalInstructions: {
        source: source,
        slug: body.slug,
        settings: {
          tone: settings.tone,
          blobs: settings.blobs,
          length: settings.length,
        },
        instructions: {
          description: instructions.description,
          headlineSuggestion: instructions.headlineSuggestion,
          instructions: instructions.instructions,
        },
      },
    };

    const analyticsData = {
      id: digestId,
      storyId: digestId,
      timeOfCreation: new Date().valueOf(),
      slug: body.slug,
      version: body.version ? body.version : '1-00',
      org: orgInfo.name ? orgInfo.name : 'not provided!',
      username: body.authorName ? body.authorName : 'not provided!',
      userId: body.authorId ? body.authorId : 'not provided!',
      sourceType: 'single',
      numberOfInputs: '1',
      totalInputWordLength: source.words,
      requestedLength: settings.length,
      rerun: body.isRerun,
    };

    // logic for source sheet considering useVerbatim and environment
    const { useVerbatim } = source;
    const promptsDigest = await getRawPrompts(
      process.env.env === 'prod'
        ? useVerbatim
          ? AiCSVs.digest_prompts_verbatim
          : AiCSVs.digest_prompts
        : useVerbatim
          ? AiCSVs.digest_prompts_verbatim_dev
          : AiCSVs.digest_prompts_dev,
      true,
    );

    console.log('🚃 Prompts from CSV: ', promptsDigest);

    const stateMachineName = process.env.env === 'prod' ? 'digest-state-machine-prod' : 'digest-state-machine-dev';

    try {
      // pass input and dynamodb entry to digest step function
      const executionArn = await articleFunctions.startDigestStepFunctionExecution(
        `arn:aws:states:${process.env.region}:${process.env.accountId}:stateMachine:${stateMachineName}`,
        {
          prompts: promptsDigest,
          slug: body.slug,
          dynamodbData: { tableName: Tables.library, ...dynamodbData },
          instructions: instructions,
          settings: settings,
          source: source,
          articleType: 'single',
        },
      );

      dynamodbData['executionArn'] = executionArn;

      // create dynamodb entries
      await databaseFunctions.createDBEntry(Tables.library, dynamodbData);
      await databaseFunctions.createDBEntry(Tables.articleAnalytics, analyticsData);

      // return dynamodb id to user
      return helperFunctions.createResponse(
        200,
        JSON.stringify({ tableName: Tables.library, DBId: digestId, executionArn: executionArn }),
      );
    } catch (e) {
      console.log('🔴 error executing step function', e);
      return helperFunctions.createResponse(500, JSON.stringify(e));
    }
  },
  cancelArticles: async (body: { articleIds: string[] }) => {
    try {
      const stepFunctions = new AWS.StepFunctions({ region: process.env.region });
      const updatePromises = body.articleIds.map(async (articleId) => {
        console.log('📰 cancelling article: ', articleId);
        let articleData: any = await articleFunctions.getArticleById({ id: articleId });
        articleData = helperFunctions.deepJSONParse(articleData.body);
        articleData = articleData.response.Items[0];

        const executionArn = articleData.executionArn ? articleData.executionArn : null;

        if (!executionArn) {
          console.log('execution arn does not exist for article: ', articleId, '. skipping...');
          return;
        }

        const params = {
          executionArn,
        };

        try {
          await stepFunctions.stopExecution(params).promise();
          await databaseFunctions.updateDBEntry(Tables.library, { id: articleId }, { cancelled: true });
        } catch (e) {
          console.log('🔴 failed to stop step function execution for article: ', articleId, e);
        }
      });

      await Promise.all(updatePromises);

      return helperFunctions.createResponse(200, JSON.stringify('article(s) cancelled'));
    } catch (e) {
      console.error('Error cancelling articles:', e);
      return helperFunctions.createResponse(500, JSON.stringify(e));
    }
  },
  archiveArticles: async (body: { articleIds: string[] }) => {
    const articleIds = body.articleIds;
    let updatePromises = [];

    for (const articleId of articleIds) {
      const params = {
        TableName: Tables.library,
        Key: {
          id: articleId,
        },
        UpdateExpression: 'set archived = :archived',
        ExpressionAttributeValues: {
          ':archived': true,
        },
        ReturnValues: 'UPDATED_NEW',
      };

      // Create a promise for the update operation but do not await it here
      const updatePromise = dynamoDB.update(params).promise();
      updatePromises.push(updatePromise);
    }

    try {
      // Await all update operations concurrently
      await Promise.all(updatePromises);
      // If all promises resolve successfully, return a success response
      return helperFunctions.createResponse(
        200,
        JSON.stringify({
          success: 'All articles have been archived successfully.',
          archivedArticles: articleIds,
        }),
      );
    } catch (error) {
      // If any of the promises reject, return an error response
      console.error(`Error archiving articles: `, error);
      return helperFunctions.createResponse(
        500,
        JSON.stringify({
          error: 'An error occurred while attempting to archive some articles.',
        }),
      );
    }
  },
  unarchiveArticles: async (body: { articleIds: string[] }) => {
    const articleIds = body.articleIds;
    let updatePromises = [];

    for (const articleId of articleIds) {
      const params = {
        TableName: Tables.library,
        Key: {
          id: articleId,
        },
        UpdateExpression: 'set archived = :archived',
        ExpressionAttributeValues: {
          ':archived': false,
        },
        ReturnValues: 'UPDATED_NEW',
      };

      // Create a promise for the update operation but do not await it here
      const updatePromise = dynamoDB.update(params).promise();
      updatePromises.push(updatePromise);
    }

    try {
      // Await all update operations concurrently
      await Promise.all(updatePromises);
      // If all promises resolve successfully, return a success response
      return helperFunctions.createResponse(
        200,
        JSON.stringify({
          success: 'All articles have been archived successfully.',
          archivedArticles: articleIds,
        }),
      );
    } catch (error) {
      // If any of the promises reject, return an error response
      console.error(`Error archiving articles: `, error);
      return helperFunctions.createResponse(
        500,
        JSON.stringify({
          error: 'An error occurred while attempting to archive some articles.',
        }),
      );
    }
  },
  startDigestStepFunctionExecution: async (stateMachineArn: string, inputData: SingleSourceInput) => {
    const input = await generateStepFunctionInput(stateMachineArn, inputData);
    const params = {
      stateMachineArn: stateMachineArn,
      input,
    };

    try {
      const execution = await stepFunctions.startExecution(params).promise();
      return execution.executionArn;
    } catch (error) {
      console.error('Error starting Step Function execution: ', error);
      throw error;
    }
  },
  startArticleStepFunctionExecution: async (stateMachineArn: string, inputData: MultiSourceInput) => {
    const input = await generateStepFunctionInput(stateMachineArn, inputData);
    const params = {
      stateMachineArn,
      input,
    };

    try {
      const execution = await stepFunctions.startExecution(params).promise();
      return execution.executionArn;
    } catch (error) {
      console.error('Error starting Step Function execution: ', error);
      throw error;
    }
  },
};

//ANCHOR - auth
const authFunctions = {
  refreshAccessToken: async (body: any) => {
    const client = new CognitoIdentityProviderClient();
    const input = {
      AuthFlow: 'REFRESH_TOKEN' as AuthFlowType,
      ClientId: process.env.cognitoClientId,
      AuthParameters: {
        REFRESH_TOKEN: body.refreshToken,
      },
    };
    console.log('🪟 refresh token: ', body.refreshToken);
    const command = new InitiateAuthCommand(input);
    let response;
    try {
      response = await client.send(command);
      if (response.$metadata.httpStatusCode === 200) {
        return helperFunctions.createResponse(
          200,
          JSON.stringify({
            success: 'New access token',
            accessToken: response.AuthenticationResult?.AccessToken,
          }),
        );
      }
    } catch (error: any) {
      console.log('🔴 error:', error);
      return helperFunctions.createResponse(500, JSON.stringify({ failed: 'access token not refreshed' }));
    }
  },
  validateAccessToken: async (body: any) => {
    console.log('🪙 validating token 🪙. body: ', body);
    console.log('token:::: ', body.accessToken);
    const token = body.accessToken;
    const cognitoUserPoolId = process.env.cognitoUserPoolId as string;
    const region = process.env.region;
    const cognitoClientId = process.env.cognitoClientId as string;
    let isValid = false;

    const verifier = CognitoJwtVerifier.create({
      userPoolId: cognitoUserPoolId,
      clientId: cognitoClientId,
      tokenUse: 'access',
    });

    try {
      const payload = await verifier.verify(token);
      console.log('token validation payload ✉️:: ', payload);
      isValid = true;
    } catch (e) {
      console.error('🪙🚫 tokens not valid');
      isValid = false;
    }
    return isValid;
  },
  resendVerificationCode: async (body: any) => {
    const client = new CognitoIdentityProviderClient();
    const input = {
      ClientId: process.env.cognitoClientId,
      Username: body.email,
    };
    const command = new ResendConfirmationCodeCommand(input);
    try {
      await client.send(command);
    } catch (error) {
      console.error(error);
    }
  },
  validateOrgId: async (body: any) => {
    const params = {
      TableName: Tables.organizations,
      IndexName: TablesIndexes.id,
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': body.id,
      },
    };
    try {
      const data = await dynamoDB.query(params).promise();
      return helperFunctions.createResponse(200, JSON.stringify({ response: data }));
    } catch (err) {
      return helperFunctions.createResponse(500, JSON.stringify({ error: err }));
    }
  },
  userSignup: async (body: any) => {
    const client = new CognitoIdentityProviderClient();
    const input = {
      ClientId: process.env.cognitoClientId,
      Username: body.email,
      Password: body.password,
      UserAttributes: [
        {
          Name: 'email',
          Value: body.email,
        },
      ],
    };
    const command = new SignUpCommand(input);
    let response;
    try {
      response = await client.send(command);
      if (response.$metadata.httpStatusCode === 200) {
        const userData = {
          id: response.UserSub,
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          organizationId: body.orgId,
          role: 'member',
          verificationStatus: 'pending',
        };
        await databaseFunctions.createDBEntry(Tables.users, userData);
        return helperFunctions.createResponse(
          200,
          JSON.stringify({
            success: 'User sign up successful',
            userSub: response.UserSub,
          }),
        );
      } else {
        return helperFunctions.createResponse(500, JSON.stringify({ failed: 'User sign up failed' }));
      }
    } catch (error: any) {
      console.log('🔴 error:', error);
      return helperFunctions.createResponse(500, JSON.stringify({ failed: error.name }));
    }
  },
  // Your existing createOrganization function
  createOrganization: async (body: any) => {
    const client = new CognitoIdentityProviderClient();
    const input = {
      UserPoolId: process.env.cognitoUserPoolId,
      Username: body.email,
      UserAttributes: [
        {
          Name: 'email',
          Value: body.email,
        },
        {
          Name: 'email_verified',
          Value: 'true',
        },
      ],
      MessageAction: MessageActionType.SUPPRESS, // Suppress sending the email
    };
    const adminCreateUserCommand = new AdminCreateUserCommand(input);

    try {
      const adminCreateUserResponse = await client.send(adminCreateUserCommand);
      if (adminCreateUserResponse.$metadata.httpStatusCode === 200) {
        // Set the user password
        const setPasswordInput = {
          UserPoolId: process.env.cognitoUserPoolId,
          Username: body.email,
          Password: body.password,
          Permanent: true,
        };
        const adminSetUserPasswordCommand = new AdminSetUserPasswordCommand(setPasswordInput);
        await client.send(adminSetUserPasswordCommand);

        // Your existing user and organization creation logic
        const orgId = uuidv4();
        const userData = {
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          organizationId: orgId,
          role: 'admin',
          verificationStatus: 'confirmed',
          id: adminCreateUserResponse.User?.Username,
        };

        // Create user and organization in your DB
        await databaseFunctions.createDBEntry(Tables.users, userData);
        const orgData = {
          id: orgId,
          name: body.orgName,
          admin: adminCreateUserResponse.User?.Username,
        };
        await databaseFunctions.createDBEntry(Tables.organizations, orgData);

        mixpanel.track('organizations', {
          orgName: body.orgName,
          orgId: orgId,
          admin: adminCreateUserResponse.User?.Username,
        });

        // Return success response
        return helperFunctions.createResponse(
          200,
          JSON.stringify({
            success: 'Organization creation successful',
            userSub: adminCreateUserResponse.User?.Username,
          }),
        );
      } else {
        return helperFunctions.createResponse(500, JSON.stringify({ failed: 'Organization creation failed' }));
      }
    } catch (error: any) {
      console.log('🔴 error:', error);
      return helperFunctions.createResponse(500, JSON.stringify({ failed: error }));
    }
  },
  confirmUserSignUp: async (body: any) => {
    const client = new CognitoIdentityProviderClient();
    const input = {
      ClientId: process.env.cognitoClientId,
      Username: body.email,
      ConfirmationCode: body.verificationCode,
    };
    const command = new ConfirmSignUpCommand(input);
    try {
      const response = await client.send(command);
      if (response.$metadata.httpStatusCode === 200) {
        //update the user verification status
        await databaseFunctions.updateDBEntry(Tables.users, { id: body.id }, { verificationStatus: 'confirmed' });
        return helperFunctions.createResponse(200, JSON.stringify({ success: 'User verified' }));
      } else {
        return helperFunctions.createResponse(500, JSON.stringify({ failed: 'Email confirmation failed' }));
      }
    } catch (error) {
      console.log('🔴 error:', error);
      return helperFunctions.createResponse(500, JSON.stringify({ failed: 'Email confirmation failed' }));
    }
  },
  userSignIn: async (body: any) => {
    const client = new CognitoIdentityProviderClient();
    const input = {
      AuthFlow: 'USER_PASSWORD_AUTH' as AuthFlowType,
      AuthParameters: {
        USERNAME: body.email,
        PASSWORD: body.password,
      },
      ClientId: process.env.cognitoClientId,
    };
    const command = new InitiateAuthCommand(input);
    let response;
    try {
      response = await client.send(command);
      console.log('🔒🔒 cognito response: ', response);
      if (response.$metadata.httpStatusCode === 200) {
        const userInfo = await authFunctions.getUserInfo(body.email);
        return helperFunctions.createResponse(
          200,
          JSON.stringify({
            success: 'User sign in successful',
            userInfo: userInfo,
            accessToken: response.AuthenticationResult?.AccessToken,
            refreshToken: response.AuthenticationResult?.RefreshToken,
            deviceKey: response.AuthenticationResult?.NewDeviceMetadata?.DeviceKey,
          }),
        );
      }
    } catch (error: any) {
      console.log('🔴 error:', error);
      if (error.message.includes('User is not confirmed')) {
        return helperFunctions.createResponse(500, JSON.stringify({ failed: 'User sign in failed', status: 404 }));
      }
      return helperFunctions.createResponse(500, JSON.stringify({ failed: 'User sign in failed' }));
    }
  },
  userSignOut: async (body: any) => {
    const client = new CognitoIdentityProviderClient();
    const input = {
      UserPoolId: process.env.cognitoUserPoolId,
      Username: body.email,
    };
    const command = new AdminUserGlobalSignOutCommand(input);
    try {
      const response = await client.send(command);
      if (response.$metadata.httpStatusCode === 200) {
        return helperFunctions.createResponse(
          200,
          JSON.stringify({
            success: 'User sign out successful',
          }),
        );
      }
    } catch (error) {
      console.log('🔴 error:', error);
      return helperFunctions.createResponse(500, JSON.stringify({ failed: 'User sign out failed' }));
    }
  },
  forgotPassword: async (body: any) => {
    const client = new CognitoIdentityProviderClient();
    const input = {
      ClientId: process.env.cognitoClientId,
      Username: body.email,
    };
    const command = new ForgotPasswordCommand(input);
    try {
      const response = await client.send(command);
      if (response.$metadata.httpStatusCode === 200) {
        return helperFunctions.createResponse(
          200,
          JSON.stringify({
            success: 'Code successfully sent to email',
          }),
        );
      }
    } catch (error) {
      console.log('🔴 error:', error);
      return helperFunctions.createResponse(500, JSON.stringify({ failed: `Couldn't send the code` }));
    }
  },
  confirmForgotPassword: async (body: any) => {
    const client = new CognitoIdentityProviderClient();
    const input = {
      ClientId: process.env.cognitoClientId,
      Username: body.email,
      ConfirmationCode: body.confirmationCode,
      Password: body.password,
    };
    const command = new ConfirmForgotPasswordCommand(input);
    try {
      const response = await client.send(command);
      if (response.$metadata.httpStatusCode === 200) {
        return helperFunctions.createResponse(
          200,
          JSON.stringify({
            success: 'Password reset successful',
          }),
        );
      }
    } catch (error) {
      console.log('🔴 error:', error);
      return helperFunctions.createResponse(500, JSON.stringify({ failed: `Couldn't reset the password` }));
    }
  },
  getUserInfo: async (body: any): Promise<any> => {
    let params: any = {
      TableName: Tables.users,
      IndexName: TablesIndexes.userEmail,
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': body.email,
      },
    };
    try {
      let user = await dynamoDB.query(params).promise();
      return user;
    } catch (error) {
      console.error(error);
    }
  },
};

//ANCHOR - database
export const databaseFunctions = {
  createLibraryEntry: async (body: any) => {
    body.id = uuidv4();
    const params = {
      TableName: Tables.library,
      Item: body,
    };
    try {
      await dynamoDB.put(params).promise();
      return { id: body.id };
    } catch (error) {
      console.error('Error creating DB entry: ', error);
      throw error;
    }
  },
  readDBEntry: async (tableName: string, key: any) => {
    const params = {
      TableName: tableName,
      Key: key,
    };

    try {
      const result = await dynamoDB.get(params).promise();
      return result.Item;
    } catch (error: any) {
      console.error('Error reading DB entry: ', error);
      return error;
    }
  },
  updateDBEntry: async (tableName: string, key: any, updateData: any) => {
    const expressionAttributeValues: {
      [key: string]: any;
    } = {};
    let updateExpression = 'set ';
    let prefix = '';

    for (const property in updateData) {
      const valueKey = `:${property}`;
      updateExpression += `${prefix}${property} = ${valueKey}`;
      expressionAttributeValues[valueKey] = updateData[property];
      prefix = ', ';
    }

    const params = {
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'UPDATED_NEW',
    };

    try {
      const result = await dynamoDB.update(params).promise();
      return result.Attributes;
    } catch (error) {
      console.error('Error updating DB entry: ', error);
      throw error;
    }
  },
  deleteDBEntry: async (tableName: string, key: any) => {
    const params = {
      TableName: tableName,
      Key: key,
    };

    try {
      await dynamoDB.delete(params).promise();
      return 'Entry deleted successfully';
    } catch (error) {
      console.error('Error deleting DB entry: ', error);
      throw error;
    }
  },
  fetchOrgConnections: async (orgId: string) => {
    let params: any = {
      TableName: Tables.connections,
      IndexName: TablesIndexes.orgId,
      KeyConditionExpression: 'orgId = :orgId',
      ExpressionAttributeValues: {
        ':orgId': orgId,
      },
    };
    try {
      let connections = await dynamoDB.query(params).promise();
      return connections;
    } catch (error) {
      console.error(error);
    }
  },
  queryLibrary: async (options: {
    indexName: string;
    sortDirection: string;
    orgId: string;
    authorId: string;
    sortKeyCondition?: any;
    limit?: number;
    offsetKey?: string;
  }): Promise<any> => {
    let expressionAttributeNames: any = {
      '#pk': 'orgId',
    };
    let expressionAttributeValues: any = {
      ':pkvalue': options.orgId,
    };

    let keyConditionExpression = '#pk = :pkvalue'; // Initial key condition remains the same

    let sortDirection = options.sortDirection === 'desc' ? false : true;

    let params: any = {
      TableName: Tables.library,
      IndexName: options.indexName, // Assuming this index is still relevant without filters
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: options.limit,
      ScanIndexForward: sortDirection, // true for ascending, false for descending.
      ...(options.sortKeyCondition && {
        KeyConditionExpression: options.sortKeyCondition,
      }),
      ...(options.offsetKey && { ExclusiveStartKey: options.offsetKey }),
    };

    console.log('📎: Query params: ', params);

    try {
      const queryResults: any = [];
      let items = await dynamoDB.query(params).promise();

      console.log('🤡: Query items: ', items);

      items.Items?.forEach((item) => queryResults.push(item));

      console.log('➡: returned object: ', {
        items: queryResults,
        offsetKey: items.LastEvaluatedKey ? items.LastEvaluatedKey : null,
      });

      return {
        items: queryResults,
        offsetKey: items.LastEvaluatedKey ? items.LastEvaluatedKey : null,
      };
    } catch (error) {
      console.error('Error querying DB table: ', error);
      throw error;
    }
  },
  queryAnalytics: async (options: {
    orgName: string;
    startTime: number;
    endTime: number;
    userId: string;
    length: number | string;
    type: string;
  }) => {
    type ExpressionNames = {
      '#nm'?: string;
      '#toc'?: string;
      '#uid'?: string;
      '#len'?: string;
      '#typ'?: string;
    };
    type ExpressionValues = {
      ':nameVal'?: string;
      ':startTime'?: number;
      ':endTime'?: number;
      ':userId'?: string;
      ':length'?: number | string;
      ':type'?: string;
    };
    try {
      let keyExpression = '';
      let filterExpression = '';
      let expressionNames: ExpressionNames = {};
      let expressionValues: ExpressionValues = {};

      if (options.orgName !== 'All') {
        keyExpression += '#nm = :nameVal AND #toc BETWEEN :startTime AND :endTime';
        expressionNames['#nm'] = 'org';
        expressionNames['#toc'] = 'timeOfCreation';
        expressionValues[':nameVal'] = options.orgName;
        expressionValues[':startTime'] = options.startTime;
        expressionValues[':endTime'] = options.endTime;
      } else {
        filterExpression += '#toc BETWEEN :startTime AND :endTime';
        expressionNames['#toc'] = 'timeOfCreation';
        expressionValues[':startTime'] = options.startTime;
        expressionValues[':endTime'] = options.endTime;
      }

      if (options.userId !== 'All') {
        filterExpression = filterExpression === '' ? '#uid = :userId' : filterExpression + ' AND #uid = :userId';
        expressionNames['#uid'] = 'userId';
        expressionValues[':userId'] = options.userId;
      }
      if (options.length !== 'All') {
        filterExpression = filterExpression === '' ? '#len = :length' : filterExpression + ' AND #len = :length';
        expressionNames['#len'] = 'requestedLength';
        expressionValues[':length'] = options.length;
      }
      if (options.type !== 'All') {
        filterExpression = filterExpression === '' ? '#typ = :type' : filterExpression + ' AND #typ = :type';
        expressionNames['#typ'] = 'sourceType';
        expressionValues[':type'] = options.type;
      }

      const params: any = {
        TableName: Tables.articleAnalytics,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
      };

      if (options.orgName !== 'All') {
        params.IndexName = TablesIndexes.orgNameTimeOfCreation;
        params.KeyConditionExpression = keyExpression;
        if (filterExpression !== '') params.FilterExpression = filterExpression;
      } else {
        params.FilterExpression = filterExpression;
      }

      console.log('📎: Query params: ', params);

      const operation = options.orgName === 'All' ? 'scan' : 'query';

      const queryResults: any = [];
      let items;
      let lastEvaluatedKey = undefined;

      do {
        items = await dynamoDB[operation]({
          ...params,
          ExclusiveStartKey: lastEvaluatedKey,
        }).promise();

        console.log('🤡: Query items: ', items);

        items.Items?.forEach((item) => queryResults.push(item));
        lastEvaluatedKey = items.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      console.log('➡: returned object: ', {
        items: queryResults,
        offsetKey: lastEvaluatedKey,
      });

      const summarizeData = (data: any) => {
        const totalEntries = data.length;
        let totalCost = 0;
        data.forEach((item: any) => {
          if (item.totalCost) totalCost += item.totalCost;
        });
        // const totalCost = data.reduce((sum: any, item: any) => sum + item.totalCost, 0);
        const avgCostPerArticle = totalCost / totalEntries;
        return {
          totalEntries,
          totalCost,
          avgCostPerArticle,
        };
      };

      if (options.orgName === 'All') {
        const orgData: any = {};
        queryResults.forEach((item: any) => {
          if (!orgData[item.org]) orgData[item.org] = [];
          orgData[item.org].push(item);
        });

        const summary = Object.keys(orgData).map((org) => {
          const summarizedData = summarizeData(orgData[org]);
          return { org, ...summarizedData };
        });

        return summary;
      } else {
        const summarizedData = summarizeData(queryResults);
        return { org: options.orgName, ...summarizedData };
      }
    } catch (error) {
      console.error('Error querying DB table: ', error);
      return helperFunctions.createResponse(500, JSON.stringify({ error: error }));
    }
  },

  fetchUsersByOrgid: async (options: { orgId: string }) => {
    const params = {
      TableName: Tables.users,
      IndexName: TablesIndexes.orgId,
      ExpressionAttributeNames: {
        '#orgId': 'organizationId',
      },
      ExpressionAttributeValues: {
        ':orgId': options.orgId,
      },
      KeyConditionExpression: '#orgId = :orgId',
    };
    console.log('📎: Query params: ', params);

    try {
      const queryResults: any = [];
      let items = await dynamoDB.query(params).promise();

      console.log('🤡: Query items: ', items);

      items.Items?.forEach((item) => queryResults.push(item));

      console.log('➡: returned object: ', {
        items: queryResults,
        offsetKey: items.LastEvaluatedKey ? items.LastEvaluatedKey : null,
      });

      return {
        items: queryResults,
        offsetKey: items.LastEvaluatedKey ? items.LastEvaluatedKey : null,
      };
    } catch (error) {
      console.error('Error querying DB table: ', error);
      throw error;
    }
  },
  listDBTable: async (options: {
    tableName: string;
    offsetKey?: string;
    limit?: number;
    ownerId?: string;
  }): Promise<any> => {
    let params: any;

    if (!options.limit && !options.ownerId) {
      params = {
        TableName: options.tableName,
      };
    } else if (options.ownerId) {
      params = {
        TableName: options.tableName,
        IndexName: TablesIndexes.ownerId,
        KeyConditionExpression: 'ownerId = :ownerId',
        ExpressionAttributeValues: {
          ':ownerId': options.ownerId,
        },
      };
    } else {
      params = {
        TableName: options.tableName,
        Limit: options.limit,
        ScanIndexForward: false,
        IndexName: TablesIndexes.slugTimestamp,
        ...(options.offsetKey && { ExclusiveStartKey: options.offsetKey }),
      };
    }

    console.log('📎: params: ', params);

    try {
      const scanResults: any = [];
      let items = await dynamoDB.scan(params).promise();

      console.log('🤡: items: ', items);

      items.Items?.forEach((item) => scanResults.push(item));

      console.log('➡: returned object: ', {
        items: scanResults,
        offsetKey: items.LastEvaluatedKey ? items.LastEvaluatedKey : null,
      });

      return {
        items: scanResults,
        offsetKey: items.LastEvaluatedKey ? items.LastEvaluatedKey : null,
      };
    } catch (error) {
      console.error('Error listing DB table: ', error);
      throw error;
    }
  },
  listPresets: async (options: { orgId: string }) => {
    let params: any = {
      TableName: Tables.settingsPresets,
      IndexName: TablesIndexes.orgId,
      KeyConditionExpression: 'orgId = :orgId',
      ExpressionAttributeValues: {
        ':orgId': options.orgId,
      },
    };
    try {
      let presets = await dynamoDB.query(params).promise();
      return presets;
    } catch (error) {
      console.error(error);
    }
  },
  createDBEntry: async (tableName: string, data: any) => {
    // if (!data.id) return 'please add an id field to the data'
    const params = {
      TableName: tableName,
      Item: data,
    };
    try {
      await dynamoDB.put(params).promise();
      if (data.id) {
        return { id: data.id }; // Returning the item id itself as DynamoDB put doesn't return the item
      }
    } catch (error) {
      console.error('Error creating DB entry: ', error);
      throw error;
    }
  },
  doesSlugExist: async (body: { slug: string }): Promise<boolean> => {
    const params = {
      TableName: Tables.library,
      IndexName: TablesIndexes.slugTimestamp, // Name of the index with 'slug' as hash key
      KeyConditionExpression: 'slug = :slugVal',
      ExpressionAttributeValues: {
        ':slugVal': body.slug,
      },
      Limit: 1, // We only need to know if at least one item exists
    };

    try {
      const result = await dynamoDB.query(params).promise();
      return result.Count !== undefined && result.Count > 0;
    } catch (error) {
      console.error('Error checking if entry exists: ', error);
      throw error;
    }
  },
  doesOrgNameExist: async (body: { orgName: string }): Promise<boolean> => {
    const params = {
      TableName: Tables.organizations,
      IndexName: TablesIndexes.orgNameIndex, // Name of the index with 'name' as hash key
      KeyConditionExpression: '#name = :nameVal',
      ExpressionAttributeNames: {
        '#name': 'name', // Alias for the reserved keyword 'name'
      },
      ExpressionAttributeValues: {
        ':nameVal': body.orgName,
      },
      Limit: 1, // We only need to know if at least one item exists
    };

    try {
      const result = await dynamoDB.query(params).promise();
      return result.Count !== undefined && result.Count > 0;
    } catch (error) {
      console.error('Error checking if entry exists: ', error);
      throw error;
    }
  },
};

const sesFunctions = {
  sendEmailWithContent: async (
    recipientEmails: string[],
    htmlContent: string,
    subjectLine: string,
    ccEmails?: string[],
  ) => {
    try {
      const params: SES.Types.SendEmailRequest = {
        Source: process.env.env === 'PROD' ? 'no-reply@app.seshasystems.com' : 'no-reply@app.dev.seshasystems.com', // The email address must be verified with SES
        Destination: {
          ToAddresses: recipientEmails, // An array of email addresses
        },
        Message: {
          Subject: {
            Data: subjectLine, // Customize your email subject
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlContent, // Pass the HTML content directly
              Charset: 'UTF-8',
            },
          },
        },
      };

      if (ccEmails && ccEmails.length > 0) {
        params.Destination.CcAddresses = ccEmails;
      }

      // Create a new instance of AWS SES and send the email
      const ses = new AWS.SES({ apiVersion: '2010-12-01' });
      const sendEmailPromise = ses.sendEmail(params).promise();
      await sendEmailPromise;

      console.log('☺️ Email sent successfully');
      return true;
    } catch (error) {
      console.error('🔴 Error sending email:', error);
      return false;
    }
  },
  sendArticleCompletionEmail: async (params: {
    userEmail: string;
    username: string;
    articleSlug: string;
    articleUrl: string;
  }) => {
    const articleVersion = params.articleUrl.split('version=')[1];

    let htmlContent = emailHtml.articleCompletion;
    htmlContent = htmlContent
      .replace(/{{first_name}}/g, params.username)
      .replace(/\{\{slug\}\}/g, params.articleSlug) // Use a regex to replace all instances of {{slug}}
      .replace(/{{article_url}}/g, params.articleUrl)
      .replace(/\{\{version\}\}/g, articleVersion);

    const sendEmail = await sesFunctions.sendEmailWithContent(
      [params.userEmail],
      htmlContent,
      `Your article is ready - "${params.articleSlug}" Version: ${articleVersion}`,
    );

    if (sendEmail) {
      return helperFunctions.createResponse(200, JSON.stringify({ success: 'Email sent successfully' }));
    } else {
      return helperFunctions.createResponse(500, JSON.stringify({ error: 'Error sending email' }));
    }
  },
  sendVerificationCodeEmail: async (params: { userEmail: string; username: string; verificationCode: string }) => {
    let htmlContent = emailHtml.verificationCode;
    htmlContent = htmlContent
      .replace(/{{first_name}}/g, params.username)
      .replace(/{{ Verification_code }}/g, params.verificationCode);
    const sendEmail = await sesFunctions.sendEmailWithContent(
      [params.userEmail],
      htmlContent,
      'Verification code for your account',
    );

    if (sendEmail) {
      return helperFunctions.createResponse(200, JSON.stringify({ success: 'Email sent successfully' }));
    } else {
      return helperFunctions.createResponse(500, JSON.stringify({ error: 'Error sending email' }));
    }
  },
  sendForgotPasswordEmail: async (params: { userEmail: string; username: string; recoveryCode: string }) => {
    let htmlContent = emailHtml.forgotPassword;
    htmlContent = htmlContent
      .replace(/{{first_name}}/g, params.username)
      .replace(/{{recovery_code}}/g, params.recoveryCode);

    const sendEmail = await sesFunctions.sendEmailWithContent(
      [params.userEmail],
      htmlContent,
      'Verification code for your account',
    );

    if (sendEmail) {
      return helperFunctions.createResponse(200, JSON.stringify({ success: 'Email sent successfully' }));
    } else {
      return helperFunctions.createResponse(500, JSON.stringify({ error: 'Error sending email' }));
    }
  },
};

// ANCHOR helper functions
const helperFunctions = {
  getDocApiAuthToken: async () => {
    try {
      let newToken;
      try {
        const params = new URLSearchParams({
          grant_type: 'password',
          username: process.env.docConverterUsername as string,
          password: process.env.docConverterPassword as string,
        });
        const response = await axios.post('https://api.docconverter.pro/token', params);
        newToken = response.data.access_token;
      } catch (error) {
        console.error('Error fetching new token:', error);
        throw error;
      }

      const newTokenData = {
        id: '1',
        token: newToken,
        createdAt: Date.now(),
      };
      await databaseFunctions.createDBEntry(Tables.docConvertToken, newTokenData);
      return newToken;
    } catch (error) {
      console.error('Error getting Doc API auth token:', error);
      throw error;
    }
  },
  convertHtmlToDocx: async (htmlContent: string) => {
    try {
      const authToken = await helperFunctions.getDocApiAuthToken();
      const formData = new FormData();
      formData.append('template', 'Convert to DOCX');
      formData.append('returnJson', 'true');
      formData.append('file', new Blob([htmlContent], { type: 'text/html' }), 'article.html');

      const response = await axios.post('https://api.docconverter.pro/api/converter/convertdoc', formData, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data; // URL or path of the converted DOCX file
    } catch (error) {
      console.error('Error converting HTML to DOCX:', error);
      throw error;
    }
  },
  convertHtmlToPdf: async (htmlContent: string) => {
    try {
      const authToken = await helperFunctions.getDocApiAuthToken();
      const formData = new FormData();
      formData.append('template', 'Convert to PDF');
      formData.append('returnJson', 'true');
      formData.append('file', new Blob([htmlContent], { type: 'text/html' }), 'article.html');

      const response = await axios.post('https://api.docconverter.pro/api/converter/convertdoc', formData, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data; // URL or path of the converted DOCX file
    } catch (error) {
      console.error('Error converting HTML to DOCX:', error);
      throw error;
    }
  },
  replaceNewlinesWithBrTags: (input: string) => {
    return input.replace(/\\n/g, '<br>');
  },
  replaceConsecutiveDoubleQuotes: (input: string) => {
    return input.replace(/"{2,}/g, '"');
  },
  removeBackslashes: (input: string) => {
    return input.replace(/\\(?!n)/g, '');
  },
  removePAndBrTags: (input: string) => {
    return input.replace(/<p>|<\/p>|<br>/g, '');
  },
  removeQuotes: (input: string) => {
    // Check if the string starts and ends with either single or double quotes
    if ((input.startsWith('"') && input.endsWith('"')) || (input.startsWith("'") && input.endsWith("'"))) {
      // Remove the starting and ending quotes
      return input.substring(1, input.length - 1);
    }
    // Return the original string if no surrounding quotes are found
    return input;
  },
  deepJSONParse: (input: string): any => {
    try {
      // Attempt to parse the input string.
      const parsed = JSON.parse(input);

      // Check if the parsed result is a string that could be parsed further.
      if (typeof parsed === 'string') {
        return helperFunctions.deepJSONParse(parsed); // Recursively call itself with the new string.
      } else {
        return parsed; // Return the parsed object if it's not a string.
      }
    } catch (e) {
      // If parsing fails, return the original input (the last successfully parsed value).
      return input;
    }
  },
  convertHtmlToPlainText: (htmlContent: string) => {
    // Remove <br> and <br/> tags
    let plainText = htmlContent.replace(/<br\s*\/?>/gi, '');

    // Remove <p> tags
    plainText = plainText.replace(/<p>/gi, '');

    // Replace </p> tags with double line breaks
    plainText = plainText.replace(/<\/p>/gi, '\n\n');

    // Remove any other remaining HTML tags
    plainText = plainText.replace(/<[^>]+>/gi, '');

    // Trim the string to remove leading and trailing whitespaces
    return plainText.trim();
  },
  getParsedResult: (input: string): string => {
    let text = '';
    try {
      text = JSON.parse(input);
    } catch (error) {
      console.log('🛑 error parsing response: ', error);
      text = input;
    }
    return text;
  },
  countWords: (input: string) => {
    // Remove URLs and count them as one word each
    const urlRegex = /https?:\/\/[^\s]+/g;
    let urlCount = (input.match(urlRegex) || []).length;
    input = input.replace(urlRegex, ' ');

    // Split the input string into words using a regular expression.
    // The regular expression matches sequences of characters separated by spaces or punctuation, considering hyphenated words.
    const words = input.match(/\b[\w'-]+\b/g);

    // Return the count of words plus the number of URLs.
    return (words ? words.length : 0) + urlCount;
  },
  isLongBaseSource: (source: string, threshold = 4000) => {
    if (source.length / 4 > threshold) return true;
    return false;
  },
  createResponse: (statusCode: number, body: string) => {
    return {
      statusCode: statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body,
    };
  },
};

// Handles LAMBDA INPUT for the case if S3URI is defined or if legacy input is defined
// if S3URI is defined, then READ from the S3 file and output the content
// if S3URI is not defined, just use the given input
// any errors that occur will always fallback to legacy
const parseLambdaInput = async (input: any) => {
  console.log('running parseLambdaInput');
  try {
    const { s3URI } = input;
    if (s3URI) {
      console.log('S3 URI Found as Input');
      const s3URISplit = s3URI.split('/');
      if (s3URISplit.length !== 6)
        throw new Error(`Error : S3 URI is expected to have a split length of 6 but received ${s3URISplit.length}`);
      if (s3URISplit.length === 6) {
        const bucketName = s3URISplit[2];
        const key = s3URISplit.slice(3).join('/');
        const s3Content = await runS3FileDownload({
          region: `${process.env.region}`,
          key,
          bucket: bucketName,
          retry: 0,
        });
        const { Body } = s3Content;
        if (!Body) console.error(`s3Content.Body is undefined`);
        if (Body) {
          const returnData = Body.toString('utf-8');
          if (!returnData) console.error(`s3Content.Body is empty`);
          if (returnData) {
            const returnDataParsed = JSON.parse(returnData);
            console.log('parseLambdaInput S3 content return');
            return returnDataParsed;
          }
        }
      }
    }
  } catch (e) {
    console.error('unknown error in parseLambdaInput');
    console.trace(e);
    throw e;
  }

  // default return the provided input as-is
  console.log('parseLambdaInput default return');
  return input;
};

// Handles LAMBDA OUTPUT for the case if S3URI is defined in the original input or if legacy input is defined
// if S3URI is defined, then WRITE the provided output to the S3 file with the next sequential integer
// if S3URI is not defined, just use the given output
// any errors that occur will always fallback to legacy
const generateLambdaOutput = async (input: any, outputContent: any) => {
  console.log('running generateLambdaOutput');
  try {
    const { s3URI } = input;
    if (s3URI) {
      console.log('S3 URI Found as Input');
      const s3URISplit = s3URI.split('/');
      if (s3URISplit.length !== 6)
        throw new Error(`Error : S3 URI is expected to have a split length of 6 but received ${s3URISplit.length}`);
      if (s3URISplit.length === 6) {
        const bucketName = s3URISplit[2];
        const folderLocation = s3URISplit.slice(3, 5).join('/');
        const inputFileName = s3URISplit[5];
        console.log(`Input S3 File Name : ${inputFileName}`);
        const inputFileNameSplit = inputFileName.split('.');
        if (inputFileNameSplit.length !== 2)
          throw new Error(
            `Error : Input S3 File Name Split is expected to have a split length of 2 but received ${inputFileNameSplit.length}`,
          );
        if (inputFileNameSplit.length === 2) {
          const inputFileInt = parseInt(inputFileNameSplit[0]);
          const inputFileExtension = inputFileNameSplit[1];
          if (isNaN(inputFileInt)) throw new Error(`Error : Input S3 File Name is not a parseable integer`);
          if (!isNaN(inputFileInt)) {
            const outputFileInt = inputFileInt + 1;
            const outputFileIntPadded = outputFileInt < 10 ? `0${outputFileInt}` : `${outputFileInt}`;
            const outputFileS3Key = `${folderLocation}/${outputFileIntPadded}.${inputFileExtension}`;
            const outputFileS3URI = `s3://${bucketName}/${outputFileS3Key}`;
            const stringifiedData = typeof outputContent === 'object' ? JSON.stringify(outputContent) : outputContent;
            const uploadResult = await runS3FileUpload({
              region: `${process.env.region}`,
              key: outputFileS3Key,
              bucket: bucketName,
              data: stringifiedData,
              retry: 0,
            });
            console.log(`S3 Upload Result : `, uploadResult);
            const returnDataOutput = {
              s3URI: outputFileS3URI,
              ...extractFieldsToAlwaysInclude(outputContent),
            };
            console.log('returnDataParsed S3 Content URI');
            return returnDataOutput;
          }
        }
      }
    }
  } catch (e) {
    console.error('unknown error in generateLambdaOutput');
    console.trace(e);
  }

  // default return the provided input as-is
  console.log('outputContent default return');
  return outputContent;
};

// takes the input if there is an s3URI, read all the state files in that bucket
// and combine them to a single file - return the content
const generateCombinedStateFileContent = async (input: any) => {
  let combinedStateFileContent: any[] = [];
  const { s3URI } = input;
  if (s3URI) {
    console.log('S3 URI Found as Input');
    const s3URISplit = s3URI.split('/');
    if (s3URISplit.length !== 6)
      throw new Error(`Error : S3 URI is expected to have a split length of 6 but received ${s3URISplit.length}`);
    if (s3URISplit.length === 6) {
      const bucketName = s3URISplit[2];
      const folderLocation = s3URISplit.slice(3, 5).join('/');
      const inputFileName = s3URISplit[5];
      console.log(`Input S3 File Name : ${inputFileName}`);
      const inputFileNameSplit = inputFileName.split('.');
      if (inputFileNameSplit.length !== 2)
        throw new Error(
          `Error : Input S3 File Name Split is expected to have a split length of 2 but received ${inputFileNameSplit.length}`,
        );
      if (inputFileNameSplit.length === 2) {
        const inputFileInt = parseInt(inputFileNameSplit[0]);
        const inputFileExtension = inputFileNameSplit[1];
        if (isNaN(inputFileInt)) throw new Error(`Error : Input S3 File Name is not a parseable integer`);
        if (!isNaN(inputFileInt)) {
          const totalStateFileCount = inputFileInt + 1;
          const stepFunctionStateFileKeys = Array(totalStateFileCount)
            .fill(null)
            .map((_stateFile, stateFileIndex) => {
              const stateFileIntPadded = stateFileIndex < 10 ? `0${stateFileIndex}` : `${stateFileIndex}`;
              return `${folderLocation}/${stateFileIntPadded}.${inputFileExtension}`;
            });

          // run s3 get request for all state files
          const results = await Promise.all(
            stepFunctionStateFileKeys.map((stateFileKey, stateFileIndex) => {
              return new Promise((resolve, reject) => {
                setTimeout(async () => {
                  console.log(
                    `starting get ${stateFileKey} index ${stateFileIndex} of ${stepFunctionStateFileKeys.length}`,
                  );
                  try {
                    const result = await runS3FileDownload({
                      region: `${process.env.region}`,
                      key: stateFileKey,
                      bucket: bucketName,
                      retry: 0,
                    });
                    const { Body } = result;
                    if (!Body) console.error(`data.Body is undefined`);
                    if (Body) {
                      const returnData = Body.toString('utf-8');
                      if (!returnData) console.error(`data.Body is empty`);
                      if (returnData) {
                        const returnDataParsed = JSON.parse(returnData);
                        const currentS3URI = `s3://${bucketName}/${stateFileKey}`;
                        const currentStateFileReturn = {
                          uri: currentS3URI,
                          content: returnDataParsed,
                        };
                        console.log(`⬇️ Content Found : ${stateFileKey}`);
                        resolve(currentStateFileReturn);
                      }
                    }
                  } catch (e) {
                    console.error('unknown error with s3.getObject');
                    console.error(`bucket : ${bucketName}`);
                    console.error(`key : ${stateFileKey}`);
                    console.error(e);
                    reject(e);
                  }
                }, stateFileIndex * 500);
              });
            }),
          );

          // combine output from all responses
          results.forEach((result: any) => combinedStateFileContent.push(result));
        }
      }
    }
  }
  return combinedStateFileContent;
};

// ANCHOR article generation functions
export const articleGenerationLambdas = {
  createInitialSourcesArray: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as any;
    let response = { ...input };
    if (input.source) {
      response = {
        ...response,
        initialSources: [
          {
            text: input.source.text,
            accredit: input.source.accredit,
            number: 1,
            useVerbatim: input.source.useVerbatim,
            isBaseSource: input.source.isBaseSource,
            isPrimarySource: input.source.isPrimarySource,
          },
        ],
      };
    } else if (input.sources) {
      let initialSources: any = [];
      input.sources.forEach((source: SourceType) => {
        initialSources.push({
          text: source.text,
          accredit: source.accredit,
          number: source.number,
          useVerbatim: source.useVerbatim,
          isBaseSource: source.isBaseSource,
          isPrimarySource: source.isPrimarySource,
        });
      });
      response = { ...response, initialSources: initialSources };
    }
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '5%' });
        await pingOrgMembers(input.dynamodbData.orgId, input.dynamodbData.id); // ask online org members to refetch
        const responseVal = await generateLambdaOutput(inputVal, response);

        console.log('🥸 initial source(s): ', response.initialSources);

        return responseVal;
      }
    }
  },
  factsBitsDigest: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as SingleSourceInput;
    console.log('🤡 all prompts: ', input.prompts);
    console.log('📝 prompt for this step: ', input.prompts.factsBitSplitting);

    const factsBits = await processPipelineInput({
      source: input.source,
      prompt: input.prompts.factsBitSplitting,
      instructions: input.instructions,
      settings: input.settings,
      initialSources: input.initialSources,
      dynamodbData: input.dynamodbData,
    });

    const response: SingleSourceInput = {
      ...input,
      source: { ...input.source, text: helperFunctions.getParsedResult(factsBits.result) },
      stepOutputs: {
        factsBitSplitting: {
          text: helperFunctions.getParsedResult(factsBits.result),
          words: helperFunctions.countWords(
            helperFunctions.convertHtmlToPlainText(helperFunctions.getParsedResult(factsBits.result)),
          ),
          characters: helperFunctions.getParsedResult(factsBits.result).length,
        },
      },
      parsedPrompts: factsBits.parsedPrompts,
    };
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '15%' });
        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch
        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  factsBitsAggregator: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as MultiSourceInput;
    const factBits: string[] = [];
    const parsedPrompts: ParsedPrompt[] = [];

    console.log('🤡 all prompts: ', input.prompts);
    console.log('#️⃣ sources count : ', input.sources.length);
    console.log('#️🪟 sources : ', input.sources);

    // wait for all requests to complete
    const allResponses = await Promise.all(
      input.sources.map(
        (source, index) =>
          new Promise((resolve) => {
            // start requests with a small delay between each request
            setTimeout(
              async () => {
                console.log('📝 prompt for this step index : ', index, input.prompts.factsBitSplitting);

                const bits = await processPipelineInput({
                  source: source,
                  prompt: input.prompts.factsBitSplitting,
                  instructions: input.instructions,
                  settings: { ...input.settings, noOfBlobs: input.settings.blobs },
                  dynamodbData: input.dynamodbData,
                  initialSources: input.initialSources,
                  initialSource: input.initialSources?.[index] ?? undefined,
                });
                resolve({
                  factBitOutput: helperFunctions.getParsedResult(bits.result),
                  parsedPromptOutput: bits.parsedPrompts,
                });
              },
              (index + 1) * 1000,
            );
          }),
      ),
    );

    // appends to global arrays AFTER all requests completed to guarantee order
    allResponses.forEach(({ factBitOutput, parsedPromptOutput }: any) => {
      factBits.push(factBitOutput);
      parsedPrompts.push(parsedPromptOutput);
    });

    const response: MultiSourceInput = {
      ...input,
      sources: factBits.map((factBit, index) => ({
        ...input.sources[index],
        text: factBit,
      })),
      stepOutputs: {
        ...input.stepOutputs,
        factsBitSplitting: factBits.map((factBit, index) => ({
          text: factBit,
          words: helperFunctions.countWords(helperFunctions.convertHtmlToPlainText(factBit)),
          characters: factBit.length,
        })),
      },
      parsedPrompts: parsedPrompts,
    };
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '10%' });
        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch
        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  factsBitsAggregator2: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as MultiSourceInput;
    const factBits: string[] = [];
    const parsedPrompts: ParsedPrompt[] = [];

    console.log('🤡 all prompts: ', input.prompts);
    console.log('#️⃣ sources count : ', input.sources.length);
    console.log('#️🪟 sources : ', input.sources);

    // wait for all requests to complete
    const allResponses = await Promise.all(
      input.sources.map(
        (source, index) =>
          new Promise((resolve) => {
            // start requests with a small delay between each request
            setTimeout(
              async () => {
                console.log('📝 prompt for this step index : ', index, input.prompts.factsBitSplitting2);

                const bits = await processPipelineInput({
                  source: source,
                  initialSource: input.initialSources?.[index] ?? undefined,
                  initialSources: input.initialSources,
                  factsBitSplitting: source,
                  prompt: input.prompts.factsBitSplitting2,
                  settings: { ...input.settings, noOfBlobs: input.settings.blobs },
                  instructions: input.instructions,
                  dynamodbData: input.dynamodbData,
                });
                resolve({
                  factBitOutput: helperFunctions.getParsedResult(bits.result),
                  parsedPromptOutput: bits.parsedPrompts,
                });
              },
              (index + 1) * 1000,
            );
          }),
      ),
    );

    // appends to global arrays AFTER all requests completed to guarantee order
    allResponses.forEach(({ factBitOutput, parsedPromptOutput }: any) => {
      factBits.push(factBitOutput);
      parsedPrompts.push(parsedPromptOutput);
    });

    const response: MultiSourceInput = {
      ...input,
      sources: factBits.map((factBit, index) => ({
        ...input.sources[index],
        text: factBit,
      })),
      stepOutputs: {
        ...input.stepOutputs,
        factsBitSplitting2: factBits.map((factBit, index) => ({
          text: factBit,
          words: helperFunctions.countWords(helperFunctions.convertHtmlToPlainText(factBit)),
          characters: factBit.length,
        })),
      },
      parsedPrompts: parsedPrompts,
    };
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '15%' });
        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch
        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  cleanUpFactsAggregator: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as MultiSourceInput;
    console.log('🤡 all prompts: ', input.prompts);
    console.log('📝 prompt for this step: ', input.prompts.paraphrasingFacts);

    let response: SingleSourceInput | null = null;
    let allFacts = ``;
    const sources = input.sources;

    sources.forEach((source) => {
      allFacts = `${allFacts}

          ${source.number}
          ${source.accredit}
          ${source.text}

          `;
    });
    const paraphrasedFacts = await processPipelineInput({
      //REVIEW - What number should be here? for now using placeholder value
      source: {
        text: allFacts,
        accredit: input.sources[0].accredit,
        number: 1,
        words: helperFunctions.countWords(allFacts),
      },
      prompt: input.prompts.paraphrasingFacts,
      instructions: input.instructions,
      settings: input.settings,
      stepOutputs: input.stepOutputs,
      initialSources: input.initialSources,
      dynamodbData: input.dynamodbData,
    });

    response = {
      ...input,
      source: {
        text: helperFunctions.getParsedResult(paraphrasedFacts.result),
        accredit: input.sources[0].accredit,
        number: 1,
        words: helperFunctions.countWords(helperFunctions.getParsedResult(paraphrasedFacts.result)),
      },
      stepOutputs: {
        ...input.stepOutputs,
        paraphrasingFacts: {
          text: helperFunctions.getParsedResult(paraphrasedFacts.result),
          words: helperFunctions.countWords(
            helperFunctions.convertHtmlToPlainText(helperFunctions.getParsedResult(paraphrasedFacts.result)),
          ),
          characters: helperFunctions.getParsedResult(paraphrasedFacts.result).length,
        },
      },
      parsedPrompts: paraphrasedFacts.parsedPrompts,
    };
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '30%' });
        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch

        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  cleanUpFactsDigest: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as SingleSourceInput;
    console.log('🤡 all prompts: ', input.prompts);
    console.log('📝 prompt for this step: ', input.prompts.paraphrasingFacts);

    const paraphrasedFacts = await processPipelineInput({
      source: input.source,
      prompt: input.prompts.paraphrasingFacts,
      instructions: input.instructions,
      settings: input.settings,
      stepOutputs: input.stepOutputs,
      initialSources: input.initialSources,
      dynamodbData: input.dynamodbData,
    });

    const response: SingleSourceInput = {
      ...input,
      source: { ...input.source, text: helperFunctions.getParsedResult(paraphrasedFacts.result) },
      stepOutputs: {
        ...input.stepOutputs,
        paraphrasingFacts: {
          text: helperFunctions.getParsedResult(paraphrasedFacts.result),
          words: helperFunctions.countWords(
            helperFunctions.convertHtmlToPlainText(helperFunctions.getParsedResult(paraphrasedFacts.result)),
          ),
          characters: helperFunctions.getParsedResult(paraphrasedFacts.result).length,
        },
      },
      parsedPrompts: paraphrasedFacts.parsedPrompts,
    };
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '30%' });
        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch
        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  articlePreparationOne: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as SingleSourceInput;
    console.log('🤡 all prompts: ', input.prompts);
    console.log('📝 prompt for this step: ', input.prompts.articlePreparationOne);

    const articlePrepOneOutput = await processPipelineInput({
      source: input.source,
      instructions: input.instructions,
      settings: input.settings,
      prompt: input.prompts.articlePreparationOne,
      stepOutputs: input.stepOutputs,
      initialSources: input.initialSources,
      dynamodbData: input.dynamodbData,
    });

    const response: SingleSourceInput = {
      ...input,
      source: { ...input.source, text: helperFunctions.getParsedResult(articlePrepOneOutput.result) },
      stepOutputs: {
        ...input.stepOutputs,
        articlePreparationOne: {
          text: helperFunctions.getParsedResult(articlePrepOneOutput.result),
          words: helperFunctions.countWords(
            helperFunctions.convertHtmlToPlainText(helperFunctions.getParsedResult(articlePrepOneOutput.result)),
          ),
          characters: helperFunctions.getParsedResult(articlePrepOneOutput.result).length,
        },
      },
      parsedPrompts: articlePrepOneOutput.parsedPrompts,
    };
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '40%' });
        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch
        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  headlinesBlobs: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as SingleSourceInput;
    console.log('🤡 all prompts: ', input.prompts);
    console.log('📝 prompt for this step: ', input.prompts.headlinesAndBlobs);

    const headlinesBlobs = await processPipelineInput({
      source: input.source,
      instructions: input.instructions,
      settings: input.settings,
      prompt: input.prompts.headlinesAndBlobs,
      stepOutputs: input.stepOutputs,
      initialSources: input.initialSources,
      dynamodbData: input.dynamodbData,
      openAiOutputFormat: 'json_object',
    });

    const response: SingleSourceInput = {
      ...input,
      source: { ...input.source, text: helperFunctions.getParsedResult(headlinesBlobs.result) },
      stepOutputs: {
        ...input.stepOutputs,
        headlinesAndBlobs: {
          text: helperFunctions.getParsedResult(headlinesBlobs.result),
          words: helperFunctions.countWords(
            helperFunctions.convertHtmlToPlainText(helperFunctions.getParsedResult(headlinesBlobs.result)),
          ),
          characters: helperFunctions.getParsedResult(headlinesBlobs.result).length,
        },
      },
      parsedPrompts: headlinesBlobs.parsedPrompts,
    };
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '45%' });
        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch
        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  articlePreparationTwo: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as SingleSourceInput;
    console.log('🤡 all prompts: ', input.prompts);
    console.log('📝 prompt for this step: ', input.prompts.articlePreparationTwo);

    const articlePrepTwoOutput = await processPipelineInput({
      source: input.source,
      instructions: input.instructions,
      settings: input.settings,
      prompt: input.prompts.articlePreparationTwo,
      stepOutputs: input.stepOutputs,
      initialSources: input.initialSources,
      dynamodbData: input.dynamodbData,
    });

    const response: SingleSourceInput = {
      ...input,
      source: { ...input.source, text: helperFunctions.getParsedResult(articlePrepTwoOutput.result) },
      stepOutputs: {
        ...input.stepOutputs,
        articlePreparationTwo: {
          text: helperFunctions.getParsedResult(articlePrepTwoOutput.result),
          words: helperFunctions.countWords(
            helperFunctions.convertHtmlToPlainText(helperFunctions.getParsedResult(articlePrepTwoOutput.result)),
          ),
          characters: helperFunctions.getParsedResult(articlePrepTwoOutput.result).length,
        },
      },
      parsedPrompts: articlePrepTwoOutput.parsedPrompts,
    };
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '50%' });
        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch
        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  quotePicking: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as SingleSourceInput;
    console.log('🤡 all prompts: ', input.prompts);
    console.log('📝 prompt for this step: ', input.prompts.quotesPicking);

    const quotesList = await processPipelineInput({
      source: input.source,
      instructions: input.instructions,
      settings: input.settings,
      prompt: input.prompts.quotesPicking,
      stepOutputs: input.stepOutputs,
      initialSources: input.initialSources,
      dynamodbData: input.dynamodbData,
    });

    const response: SingleSourceInput = {
      ...input,
      source: { ...input.source, text: helperFunctions.getParsedResult(quotesList.result) },
      stepOutputs: {
        ...input.stepOutputs,
        quotesPicking: {
          text: helperFunctions.getParsedResult(quotesList.result),
          words: helperFunctions.countWords(
            helperFunctions.convertHtmlToPlainText(helperFunctions.getParsedResult(quotesList.result)),
          ),
          characters: helperFunctions.getParsedResult(quotesList.result).length,
        },
      },
      parsedPrompts: quotesList.parsedPrompts,
    };
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '56%' });
        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch
        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  articleWriting: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as SingleSourceInput;
    console.log('🤡 all prompts: ', input.prompts);
    console.log('📝 prompt for this step: ', input.prompts.writing);

    const article = await processPipelineInput({
      source: input.source,
      instructions: input.instructions,
      settings: input.settings,
      prompt: input.prompts.writing,
      stepOutputs: input.stepOutputs,
      initialSources: input.initialSources,
      dynamodbData: input.dynamodbData,
    });
    const response: SingleSourceInput = {
      ...input,
      source: { ...input.source, text: helperFunctions.getParsedResult(article.result) },
      stepOutputs: {
        ...input.stepOutputs,
        writing: {
          text: helperFunctions.getParsedResult(article.result),
          words: helperFunctions.countWords(
            helperFunctions.convertHtmlToPlainText(helperFunctions.getParsedResult(article.result)),
          ),
          characters: helperFunctions.getParsedResult(article.result).length,
        },
      },
      parsedPrompts: article.parsedPrompts,
    };
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '60%' });
        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch
        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  rewritingArticle: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as SingleSourceInput;
    console.log('🤡 all prompts: ', input.prompts);
    console.log('📝 prompt for this step: ', input.prompts.rewriting);

    const rewrittenArticle = await processPipelineInput({
      source: input.source,
      settings: input.settings,
      instructions: input.instructions,
      prompt: input.prompts.rewriting,
      stepOutputs: input.stepOutputs,
      initialSources: input.initialSources,
      dynamodbData: input.dynamodbData,
    });

    const response: SingleSourceInput = {
      ...input,
      source: { ...input.source, text: helperFunctions.getParsedResult(rewrittenArticle.result) },
      stepOutputs: {
        ...input.stepOutputs,
        rewriting: {
          text: helperFunctions.getParsedResult(rewrittenArticle.result),
          words: helperFunctions.countWords(
            helperFunctions.convertHtmlToPlainText(helperFunctions.getParsedResult(rewrittenArticle.result)),
          ),
          characters: helperFunctions.getParsedResult(rewrittenArticle.result).length,
        },
      },
      parsedPrompts: rewrittenArticle.parsedPrompts,
    };
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '80%' });
        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch
        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  finalizationOne: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as SingleSourceInput;
    console.log('🤡 all prompts: ', input.prompts);
    console.log('📝 prompt for this step: ', input.prompts.finalizationOne);

    const finalizationOneOutput = await processPipelineInput({
      source: input.source,
      instructions: input.instructions,
      settings: input.settings,
      prompt: input.prompts.finalizationOne,
      stepOutputs: input.stepOutputs,
      initialSources: input.initialSources,
      dynamodbData: input.dynamodbData,
    });

    const response: SingleSourceInput = {
      ...input,
      source: { ...input.source, text: helperFunctions.getParsedResult(finalizationOneOutput.result) },
      stepOutputs: {
        ...input.stepOutputs,
        finalizationOne: {
          text: helperFunctions.getParsedResult(finalizationOneOutput.result),
          words: helperFunctions.countWords(
            helperFunctions.convertHtmlToPlainText(helperFunctions.getParsedResult(finalizationOneOutput.result)),
          ),
          characters: helperFunctions.getParsedResult(finalizationOneOutput.result).length,
        },
      },
      parsedPrompts: finalizationOneOutput.parsedPrompts,
    };
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '85%' });
        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch
        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  finalizationTwo: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as SingleSourceInput;
    console.log('🤡 all prompts: ', input.prompts);
    console.log('📝 prompt for this step: ', input.prompts.finalizationTwo);

    const finalizationTwoOutput = await processPipelineInput({
      source: input.source,
      instructions: input.instructions,
      settings: input.settings,
      prompt: input.prompts.finalizationTwo,
      stepOutputs: input.stepOutputs,
      initialSources: input.initialSources,
      dynamodbData: input.dynamodbData,
    });

    const response: SingleSourceInput = {
      ...input,
      source: { ...input.source, text: helperFunctions.getParsedResult(finalizationTwoOutput.result) },
      stepOutputs: {
        ...input.stepOutputs,
        finalizationTwo: {
          text: helperFunctions.getParsedResult(finalizationTwoOutput.result),
          words: helperFunctions.countWords(
            helperFunctions.convertHtmlToPlainText(helperFunctions.getParsedResult(finalizationTwoOutput.result)),
          ),
          characters: helperFunctions.getParsedResult(finalizationTwoOutput.result).length,
        },
      },
      parsedPrompts: finalizationTwoOutput.parsedPrompts,
    };
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(tableName, { id: input.dynamodbData.id }, { progress: '90%' });
        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch
        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  digestArticleAttribution: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as SingleSourceInput;
    console.log('🤡 all prompts: ', input.prompts);
    console.log('📝 prompt for this step: ', input.prompts.attribution);

    const attributedDigest = await processPipelineInput({
      source: input.source,
      instructions: input.instructions,
      settings: input.settings,
      prompt: input.prompts.attribution,
      stepOutputs: input.stepOutputs,
      initialSources: input.initialSources,
      dynamodbData: input.dynamodbData,
    });
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(
          tableName,
          { id: input.dynamodbData.id },
          {
            progress: '100%',
            digest: attributedDigest,
            headlinesAndBlobs: input.stepOutputs?.headlinesAndBlobs,
          },
        );

        // add article data to opensearch for indexing
        const searchRespose = await searchFunctions.addItemToSearchIndex({
          article: {
            orgId: dynamodbData.orgId ? dynamodbData.orgId.replaceAll('-', '') : '',
            slug: input.slug,
            version: dynamodbData.version,
            headlinesAndBlobs: input.stepOutputs?.headlinesAndBlobs?.text,
            user: dynamodbData.authorName,
            sourceType: dynamodbData.sourceType,
            timestamp: dynamodbData.timestamp,
            digest: attributedDigest.result,
            progress: '100%',
          },
        });

        console.log('🔍 search response: ', searchRespose);

        try {
          mixpanel.track('articles', {
            orgId: input.dynamodbData.orgId,
            orgName: input.dynamodbData.orgName,
            userId: input.dynamodbData.authorId,
            username: input.dynamodbData.authorName,
            slug: input.dynamodbData.slug,
            version: input.dynamodbData.version,
            article_type: input.articleType,
            article_url:
              process.env.env === 'prod'
                ? 'app.seshasystems.com'
                : 'app.dev.seshasystems.com' +
                  `/article?slug=${encodeURIComponent(input.dynamodbData.slug as string)}&version=${
                    input.dynamodbData.version
                  }`,
          });
        } catch (e) {
          console.error('🔴', e);
        }

        await sesFunctions.sendArticleCompletionEmail({
          articleSlug: input.dynamodbData.slug as string,
          articleUrl:
            process.env.env === 'prod'
              ? 'app.seshasystems.com'
              : 'app.dev.seshasystems.com' +
                `/article?slug=${encodeURIComponent(input.dynamodbData.slug as string)}&version=${
                  input.dynamodbData.version
                }`,
          username: input.dynamodbData.authorName as string,
          userEmail: input.dynamodbData.authorEmail as string,
        });

        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch

        const response = {
          ...input,
          result: helperFunctions.getParsedResult(attributedDigest.result),
          headlinesAndBlobs: input.stepOutputs?.headlinesAndBlobs,
          parsedPrompts: attributedDigest.parsedPrompts,
        };

        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  aggregatorArticleAttribution: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as SingleSourceInput;
    console.log('🤡 all prompts: ', input.prompts);
    console.log('📝 prompt for this step: ', input.prompts.attribution);

    const attributedArticle = await processPipelineInput({
      source: input.source,
      instructions: input.instructions,
      settings: input.settings,
      prompt: input.prompts.attribution,
      stepOutputs: input.stepOutputs,
      initialSources: input.initialSources,
      dynamodbData: input.dynamodbData,
    });
    const { dynamodbData } = input;
    if (!dynamodbData) throw new Error('dynamodbData undefined in input');
    if (dynamodbData) {
      const { tableName } = dynamodbData;
      if (!tableName) throw new Error('tableName undefined in input.dynamodbData');
      if (tableName) {
        await databaseFunctions.updateDBEntry(
          tableName,
          { id: input.dynamodbData.id },
          {
            progress: '100%',
            digest: attributedArticle,
            headlinesAndBlobs: input.stepOutputs?.headlinesAndBlobs,
          },
        );

        // add article data to opensearch for indexing
        const searchResponse = await searchFunctions.addItemToSearchIndex({
          article: {
            orgId: dynamodbData.orgId ? dynamodbData.orgId.replaceAll('-', '') : '',
            slug: input.slug,
            version: dynamodbData.version,
            headlinesAndBlobs: input.stepOutputs?.headlinesAndBlobs?.text,
            user: dynamodbData.authorName,
            sourceType: dynamodbData.sourceType,
            timestamp: dynamodbData.timestamp,
            digest: attributedArticle.result,
            progress: '100%',
          },
        });

        console.log('🔍 search response: ', searchResponse);

        try {
          mixpanel.track('articles', {
            orgId: input.dynamodbData.orgId,
            orgName: input.dynamodbData.orgName,
            userId: input.dynamodbData.authorId,
            username: input.dynamodbData.authorName,
            slug: input.dynamodbData.slug,
            version: input.dynamodbData.version,
            article_type: input.articleType,
            article_url:
              process.env.env === 'prod'
                ? 'app.seshasystems.com'
                : 'app.dev.seshasystems.com' +
                  `/article?slug=${encodeURIComponent(input.dynamodbData.slug as string)}&version=${
                    input.dynamodbData.version
                  }`,
          });
        } catch (e) {
          console.log('🔴', e);
        }

        await sesFunctions.sendArticleCompletionEmail({
          articleSlug: input.dynamodbData.slug as string,
          articleUrl:
            process.env.env === 'prod'
              ? 'app.seshasystems.com'
              : 'app.dev.seshasystems.com' +
                `/article?slug=${encodeURIComponent(input.dynamodbData.slug as string)}&version=${
                  input.dynamodbData.version
                }`,
          username: input.dynamodbData.authorName as string,
          userEmail: input.dynamodbData.authorEmail as string,
        });

        await pingOrgMembers(input.dynamodbData.orgId as string, input.dynamodbData.id); // ask online org members to refetch

        //send here mix panel event for article generation
        const response = {
          ...input,
          result: helperFunctions.getParsedResult(attributedArticle.result),
          headlinesAndBlobs: input.stepOutputs?.headlinesAndBlobs,
          parsedPrompts: attributedArticle.parsedPrompts,
        };

        const responseVal = await generateLambdaOutput(inputVal, response);
        return responseVal;
      }
    }
  },
  analyticsStep: async (inputVal: any) => {
    const input = (await parseLambdaInput(inputVal)) as SingleSourceInput;
    console.log('🔴 INPUT::: ', input);
    const articleId = input.dynamodbData.id;

    // get analytic info from dynamodb against article Id
    const articleAnalytics: AnalyticsInfo = await databaseFunctions.readDBEntry(Tables.articleAnalytics, {
      id: articleId,
    });
    const dynamoDBData = await databaseFunctions.readDBEntry(Tables.library, { id: articleId });

    if (dynamoDBData.cancelled === true) {
      articleAnalytics['progress'] = 'Cancelled';
    } else if (dynamoDBData.error === true) {
      articleAnalytics['progress'] = 'failed';
    } else {
      articleAnalytics['progress'] = dynamoDBData.progress;
    }

    if (articleAnalytics.progress === '100%') {
      const base = process.env.env === 'prod' ? 'app.seshasystems.com' : 'app.dev.seshasystems.com';
      const path = `/article?slug=${encodeURIComponent(dynamoDBData.slug as string)}&version=${dynamoDBData.version}`;
      articleAnalytics['articleUrl'] = base + path;
    }

    if (input.stepOutputs?.headlinesAndBlobs?.text) {
      articleAnalytics['headline'] = helperFunctions.deepJSONParse(input.stepOutputs.headlinesAndBlobs.text).headline;
    }

    articleAnalytics['totalCost'] = articleAnalytics['totalAnthropicCost'] + articleAnalytics['totalOpenAiCost'];

    delete articleAnalytics['id'];

    await databaseFunctions.updateDBEntry(Tables.articleAnalytics, { id: articleId }, articleAnalytics);

    // insert analytic info into sheet
    console.log('writing to analytic sheet');
    await insertArticleAnalyticsData(articleAnalytics);

    const response = {
      ...input,
    };

    const responseVal = await generateLambdaOutput(inputVal, response);
    return responseVal;
  },
  postRunHook: async (inputVal: any) => {
    const combinedStateFileContent = await generateCombinedStateFileContent(inputVal);
    const responseVal = await generateLambdaOutput(inputVal, combinedStateFileContent);
    const { s3URI } = responseVal;
    if (!s3URI) console.error('responseVal.s3URI is empty');
    if (s3URI) {
      console.log(`Combined Output S3 URI : ${s3URI}`);
      const s3URISplit = s3URI.split('/');
      if (s3URISplit.length !== 6)
        console.error(`S3 URI is expected to have a split length of 6 but received ${s3URISplit.length}`);
      if (s3URISplit.length === 6) {
        const bucketName = s3URISplit[2];
        const stateMachine = s3URISplit[3];
        const uniqueRun = s3URISplit[4];
        const inputFileName = s3URISplit[5];
        console.log(`Input S3 File Name : ${inputFileName}`);
        const objectURL = `https://${bucketName}.s3.${process.env.region}.amazonaws.com/${stateMachine}/${uniqueRun}/${inputFileName}`;
        try {
          const { postRunHookMakeEndpoint } = process.env;
          if (!postRunHookMakeEndpoint) console.error('postRunHookMakeEndpoint is not configured');
          if (postRunHookMakeEndpoint) {
            const headers = { 'Content-Type': 'application/json' };
            const postRequestObj = {
              s3URI: s3URI,
              objectURL: objectURL,
              region: process.env.region,
              env: process.env.env,
              bucketName: bucketName,
              fileName: inputFileName,
              stateMachine: stateMachine,
              uniqueRun: uniqueRun,
            };

            // run make.com request
            console.log(
              `Ⓜ️ Running Make.com Action Request with ${combinedStateFileContent.length} Log File Reference(s)...`,
            );
            console.log('Post Request Object : ', postRequestObj);
            const response = await axios.post(postRunHookMakeEndpoint, postRequestObj, { headers });
            const { data, status, statusText } = response;
            console.log(`Ⓜ️ Make.com Action Request Complete with Response :`, {
              response: { data, status, statusText },
            });
          }
        } catch (e) {
          console.error('Ⓜ️ unknown error running make.com postRunHook');
          console.trace(e);
        }
      }
    }

    // return the combined content
    return responseVal;
  },
};

//ANCHOR - Websocket functions
export const connectHandler = async (event: any) => {
  console.log('🔴🔴', event);

  const connectionId = event.requestContext.connectionId;
  const orgId = event.queryStringParameters ? event.queryStringParameters.orgId : null;
  const userId = event.queryStringParameters ? event.queryStringParameters.userId : null;

  const data = {
    connectionId: connectionId,
    orgId: orgId,
    userId: userId,
  };
  // add data in dynamodb connections table
  await databaseFunctions.createDBEntry(Tables.connections, data);

  return { statusCode: 200, body: 'Connected.' };
};
export const disconnectHandler = async (event: any) => {
  console.log('🔴🔴', event);
  const connectionId = event.requestContext.connectionId;

  // Delete connectionId from dynamodb
  try {
    await databaseFunctions.deleteDBEntry(Tables.connections, { connectionId: connectionId });
  } catch (e: any) {
    console.log('🔴🔴', e);
  }
  return { statusCode: 200, body: 'Disconnected.' };
};
export const websocketHeartbeat = async (event: any) => {
  //get all entries from the connections table
  const connections = await databaseFunctions.listDBTable({ tableName: Tables.connections });
  console.log('©️ connections: ', connections.items);

  for (const connection of connections.items) {
    try {
      // Send message to recipient
      const client = new ApiGatewayManagementApiClient({
        endpoint:
          process.env.env === 'prod'
            ? 'https://vcqo4iw7bl.execute-api.eu-north-1.amazonaws.com/prod' //perhaps these should be in the env variables
            : 'https://fn92v53qee.execute-api.eu-north-1.amazonaws.com/dev',
      });
      const input = {
        Data: JSON.stringify({ heartbeat: true }),
        ConnectionId: connection.connectionId,
      };
      const command = new PostToConnectionCommand(input);
      await client.send(command);
    } catch (e) {
      console.log('⚠️ cant ping connection: ', connection.connectionId);
      // Remove the connectionId from the connections table
      try {
        await databaseFunctions.deleteDBEntry(Tables.connections, { connectionId: connection.connectionId });
        console.log('🗑️ Removed connection: ', connection.connectionId);
      } catch (err) {
        console.log('⚠️ Failed to remove connection: ', connection.connectionId, err);
      }
    }
  }
};
export const pingOrgMembers = async (orgId: string, articleId: string) => {
  // get all the org's websocket connections
  const connections = await databaseFunctions.fetchOrgConnections(orgId);
  if (connections && connections.Items) {
    for (let i = 0; i < connections.Items.length; i++) {
      const connection = connections.Items[i];
      try {
        // Send message to recipient
        const client = new ApiGatewayManagementApiClient({
          endpoint:
            process.env.env === 'prod'
              ? 'https://vcqo4iw7bl.execute-api.eu-north-1.amazonaws.com/prod' //perhaps these should be in the env variables
              : 'https://fn92v53qee.execute-api.eu-north-1.amazonaws.com/dev',
        });
        const input = {
          Data: JSON.stringify({ articleId }),
          ConnectionId: connection.connectionId,
        };
        const command = new PostToConnectionCommand(input);
        await client.send(command);
      } catch (e) {
        console.log('⚠️ cant ping connection: ', connection.connectionId);
      }
    }
  }
};
export const sendMessageHandler = async () => {};

interface ReplaceHTMLConfig {
  src: string;
  dest: string;
}

const generateArticleFromPageContent = (pageHTMLContent: string) => {
  console.log(`📎 attempting to generate article content...`);
  try {
    const pageHTMLContentTrimmed = pageHTMLContent.trim();
    if (pageHTMLContentTrimmed.length === 0) throw new Error('📄 page content undefined');
    if (pageHTMLContentTrimmed.length > 0) {
      // configure this for SOURCE (src) text (universal search) and DESTINATION (dest) text
      // Example In :   <p aria-hidden="true">Test Date</p>
      // Example Out :  <p aria-hidden="false">Test Date</p>
      const replaceContentsConfig: ReplaceHTMLConfig[] = [
        {
          src: `aria-hidden="true"`,
          dest: `aria-hidden="false"`,
        },
      ];
      let replacedContentHTMLTrimmed = pageHTMLContentTrimmed;
      replaceContentsConfig.forEach((currentConfig) => {
        const { src, dest } = currentConfig;
        const blReplaceContent = src && dest && replacedContentHTMLTrimmed.indexOf(src) > -1;
        if (blReplaceContent) {
          console.log(`....replacing content ${src} with ${dest}`);
          replacedContentHTMLTrimmed = replacedContentHTMLTrimmed.split(`${src}`).join(`${dest}`);
        }
      });
      console.log('📄 Source Page Content : ', pageHTMLContentTrimmed);
      if (pageHTMLContentTrimmed !== replacedContentHTMLTrimmed)
        console.log('📄 **Replaced** Page Content : ', replacedContentHTMLTrimmed);
      console.log(`📄 Extracting JSDOM...`);
      const dom = new JSDOM(replacedContentHTMLTrimmed);
      if (!dom) {
        console.error(`📄 JSDOM Content Not Extracted`);
      }
      if (dom) {
        console.log(`📄 JSDOM Extrated`);
        console.log(`📘 Creating Reader...`);
        const reader = new Readability(dom.window.document);
        if (!reader) {
          console.error(`📘 Reader Not Created`);
        }
        if (reader) {
          console.log(`📘 Reader Created`);
          console.log('📎 Parsing Article...');
          const article = reader.parse();
          if (!article) {
            console.error(`📎 Article Not Parsed`);
          }
          if (article) {
            console.log(`📎 Article Created`);
            const { siteName, title, byline, excerpt, content } = article;

            // initialize html content
            let siteNameHtml = ``;
            let titleHtml = ``;
            let bylineHtml = ``;
            let excerptHtml = ``;
            let contentHtml = ``;

            // site name
            const siteNameTrimmed = siteName ? siteName.trim() : '';
            if (siteNameTrimmed.length) {
              console.log('📎 Article Site Name Successfully Extracted : ', siteNameTrimmed);
              siteNameHtml = `<p><cite><span data-editable="source">${siteNameTrimmed}</span></cite></p>`;
            }

            // title
            const titleTrimmed = title ? title.trim() : '';
            if (titleTrimmed.length) {
              console.log('📎 Article Title Successfully Extracted : ', titleTrimmed);
              titleHtml = `<h1 class="reader-title">${titleTrimmed}</h1>`;
            }

            // byline
            const bylineTrimmed = byline ? byline.trim() : '';
            if (bylineTrimmed.length) {
              console.log('📎 Article Byline Successfully Extracted : ', bylineTrimmed);
              bylineHtml = `<div class="credits reader-credits">${bylineTrimmed}</div>`;
            }

            // excerpt
            const excerptTrimmed = excerpt ? excerpt.trim() : '';
            if (excerptTrimmed.length) {
              console.log('📎 Article Excerpt Successfully Extracted : ', excerptTrimmed);
              excerptHtml = `<div><p>${excerptTrimmed}</p></div>`;
            }

            // content
            const contentTrimmed = content ? content.trim() : '';
            if (contentTrimmed.length) {
              console.log('📎 Article Content Successfully Extracted : ', contentTrimmed);
              contentHtml = `<div>${contentTrimmed}</div>`;
            }

            // if at least one field has text content
            const blContentExtracted =
              siteNameHtml.length || titleHtml.length || bylineHtml.length || excerptHtml.length || contentHtml.length;

            // if any content extracted
            if (!blContentExtracted) console.error(`📎 Error : Article Output Does Not Have Content`);
            if (blContentExtracted) {
              // does NOT contain a KNOWN failed messages
              // Please enable JS and disable any ad blocker
              const knownFailureMessage = `Please enable JS and disable any ad blocker`;
              const blContainsKnownFailureMessage =
                siteNameHtml.toLowerCase().indexOf(knownFailureMessage.toLowerCase()) > -1 ||
                titleHtml.toLowerCase().indexOf(knownFailureMessage.toLowerCase()) > -1 ||
                bylineHtml.toLowerCase().indexOf(knownFailureMessage.toLowerCase()) > -1 ||
                excerptHtml.toLowerCase().indexOf(knownFailureMessage.toLowerCase()) > -1 ||
                contentHtml.toLowerCase().indexOf(knownFailureMessage.toLowerCase()) > -1;
              if (blContainsKnownFailureMessage)
                console.error(`📎 Article Content Contains Known Failure Message : ${knownFailureMessage}`);
              if (!blContainsKnownFailureMessage) {
                // header content
                let headerContentBlock = ``;
                if (bylineHtml.length || titleHtml.length) {
                  headerContentBlock = `<div class="header reader-header reader-show-element">${titleHtml}${bylineHtml}</div>`;
                }

                // body content
                let bodyContentBlock = ``;
                if (siteNameHtml.length || excerptHtml.length || contentHtml.length) {
                  let bodyText = ``;
                  if (contentHtml.length) {
                    bodyText = contentHtml;
                  }
                  if (!contentHtml.length && (excerptHtml.length || siteNameHtml.length)) {
                    bodyText = `${siteNameHtml}${excerptHtml}`;
                  }
                  bodyContentBlock = `<div class="content">${bodyText}</div>`;
                }

                //combine header and body
                const combinedHeaderBodyContent = `<div>${headerContentBlock}${bodyContentBlock}</div>`;
                console.log('📎 ✅ Generated Content Output : ', content);
                return combinedHeaderBodyContent;
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(`unexpected error in generateArticleFromPageContent`);
    console.trace(e);
  }
  return undefined;
};

const errorMessageParsing = `Apologies, an unexpected error occurred. Please copy/paste into the "Text from Source" field.`;

// ATTEMPT 1 : Run an axios.get request
export const fetchSiteText1 = async (body?: any, queryStringParameters?: any) => {
  console.log('📰 fetching source via axios get request');
  const url = body.url;
  console.log(`📰 url : ${url}`);
  try {
    const response = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    console.log('📰, axios get request complete');
    const pageHTMLContent = response.data;
    const axiosGeneratedArticle = generateArticleFromPageContent(pageHTMLContent);
    if (!axiosGeneratedArticle) throw new Error('axiosGeneratedArticle failed');
    if (axiosGeneratedArticle)
      return helperFunctions.createResponse(200, JSON.stringify({ content: axiosGeneratedArticle }));
  } catch (e) {
    console.error(`unexpected error encountered in fetchSiteText1`);
    console.trace(e);
    return helperFunctions.createResponse(500, JSON.stringify({ error: { message: errorMessageParsing } }));
  }
};

// ATTEMPT 2 : Invoke the Puppeteer Proxy Lambda to run the request
export const fetchSiteText2 = async (body?: any, queryStringParameters?: any) => {
  console.log('🤿 fetching source via puppeteer proxy request');
  const url = body.url;
  console.log(`🤿 url : ${url}`);
  try {
    const lambda = new AWS.Lambda();
    const response = lambda.invoke({
      FunctionName: `lambda-handler-puppeteer-proxy-${process.env.env}`,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ body: { url } }),
    });
    const res = await response.promise();
    console.log('🤿 puppeteer proxy lambda request completed');
    const { Payload } = res;
    const { body } = JSON.parse(Payload as any);
    if (!body) console.error('🤿 no body in puppeteer proxy lambda response payload');
    if (body) {
      const parsedBody = JSON.parse(body);
      const { pageContent } = parsedBody;
      if (!pageContent) console.error('🤿 no pageContent in puppeteer proxy lambda response payload body');
      if (pageContent) {
        const pageHTMLContent = pageContent;
        console.log(`📄 Page Content Found from puppeteer proxy lambda response payload body : ${pageHTMLContent}`);
        const puppeteerProxyGeneratedArticle = generateArticleFromPageContent(pageHTMLContent);
        if (!puppeteerProxyGeneratedArticle) throw new Error('puppeteerProxyGeneratedArticle failed');
        if (puppeteerProxyGeneratedArticle)
          return helperFunctions.createResponse(200, JSON.stringify({ content: puppeteerProxyGeneratedArticle }));
      }
    }
  } catch (e) {
    console.error(`unexpected error encountered in fetchSiteText2`);
    console.trace(e);
    return helperFunctions.createResponse(500, JSON.stringify({ error: { message: errorMessageParsing } }));
  }
};

// ATTEMPT 3 : Invoke the Web Unblocker Lambda to run the request
export const fetchSiteText3 = async (body?: any, queryStringParameters?: any) => {
  console.log('🚧 attempting page request via web unblocker');
  const url = body.url;
  console.log(`🚧 url : ${url}`);
  try {
    const webUnblockerServer = `${process.env.webUnblockerServer}`;
    const webUnblockerUsername = `${process.env.webUnblockerUsername}`;
    const webUnblockerPassword = `${process.env.webUnblockerPassword}`;
    const webUnblockerServerSplit = webUnblockerServer.split(':');
    if (webUnblockerServerSplit.length !== 2)
      console.error(
        `🚧 Expected webUnblockerServer split to have a length of 2 and received ${webUnblockerServer.length}`,
      );
    if (webUnblockerServerSplit.length === 2) {
      const host = webUnblockerServerSplit[0];
      const port = parseInt(webUnblockerServerSplit[1]);
      if (isNaN(port)) console.error('🚧 Parsed webUnblockerServer port is not a number');
      if (!isNaN(port)) {
        const proxy = {
          host,
          port,
          auth: {
            username: webUnblockerUsername,
            password: webUnblockerPassword,
          },
          protocol: 'http',
        } as AxiosProxyConfig;
        const headers = { 'x-oxylabs-geo-location': 'United States' };
        console.log('🚧 running web unblocker axios get request');
        const response = await axios.get(url, {
          headers,
          proxy,
        });
        console.log('🚧 web unblocker axios get request complete');
        const pageHTMLContent = response.data;
        const webUnblockerGeneratedArticle = generateArticleFromPageContent(pageHTMLContent);
        if (!webUnblockerGeneratedArticle) throw new Error('webUnblockerGeneratedArticle failed');
        if (webUnblockerGeneratedArticle)
          return helperFunctions.createResponse(200, JSON.stringify({ content: webUnblockerGeneratedArticle }));
      }
    }
  } catch (e) {
    console.error(`unexpected error encountered in fetchSiteText3`);
    console.trace(e);
    return helperFunctions.createResponse(500, JSON.stringify({ error: { message: errorMessageParsing } }));
  }
};

//ANCHOR - openSearch functions
const searchFunctions = {
  invokeSearchLambda: async (body: any, path: string) => {
    try {
      const lambda = new AWS.Lambda();
      const response = lambda.invoke({
        InvocationType: 'RequestResponse',
        FunctionName: 'opensearch-handler-' + process.env.env,
        Payload: JSON.stringify({ body: body, path: path }),
      });

      const res = await response.promise();
      return res.Payload;
    } catch (e) {
      console.log('🛑 search error: ', e);
      return 'error. check lambda handler logs';
    }
  },

  testSearch: async () => {
    const res = await searchFunctions.invokeSearchLambda({}, '/test-function');
  },
  getSearchItem: async (body: any) => {
    const res = await searchFunctions.invokeSearchLambda({ id: body.id }, '/get-item');
    console.log('🤷 search response: ', res);
    return helperFunctions.createResponse(200, JSON.stringify(res));
  },
  searchTerm: async (body: any) => {
    const searchInput = {
      orgId: body.orgId,
      input: body.input,
      fieldsToSearch: body.fieldsToSearch,
      fuzziness: body.fuzziness,
      from: body.from,
      size: body.size,
    };
    const result = await searchFunctions.invokeSearchLambda(searchInput, '/search');
    console.log('🔍 search lambda response::: 🔍 ', result);
    return helperFunctions.createResponse(200, JSON.stringify(result));
  },
  filterArticles: async (body: any) => {
    const filters = {
      orgId: body.filters.orgId,
      slug: body.filters.slug,
      contains: body.filters.contains,
      user: body.filters.user,
      date: body.filters.date,
      sourceType: body.filters.sourceType,
    };
    const requestBody = {
      filters: filters,
      from: body.from,
      size: body.size,
    };
    const result = await searchFunctions.invokeSearchLambda(requestBody, '/filter');
    console.log('🔍 search lambda response::: 🔍 ', result);
    return helperFunctions.createResponse(200, JSON.stringify(result));
  },
  addItemToSearchIndex: async (body: any) => {
    console.log('adding item to search index: body:: ', body);
    const article = body.article;
    const result = await searchFunctions.invokeSearchLambda(article, '/create-entry');
    console.log('➕🔍➕ search lambda response::: ➕🔍➕ ', result);
    return helperFunctions.createResponse(200, JSON.stringify(result));
  },
  addBulkItemsToSearchIndex: async (body: any) => {
    const result = await searchFunctions.invokeSearchLambda(body, '/create-bulk-entries');
    console.log('➕🔍➕ search lambda response::: ➕🔍➕ ', result);
    return helperFunctions.createResponse(200, JSON.stringify(result));
  },
  updateOpensearchMapping: async (body: any) => {
    const mapping = body.mapping;
    const result = await searchFunctions.invokeSearchLambda(mapping, '/update-mapping');
    console.log('🔃 search lambda response::: 🔃 ', result);
    return helperFunctions.createResponse(200, JSON.stringify(result));
  },
  createIndex: async (body: any) => {
    body = { indexName: body.indexName };
    const result = await searchFunctions.invokeSearchLambda(body, '/create-index');
    console.log('🔃 search lambda response::: 🔃 ', result);
    return helperFunctions.createResponse(200, JSON.stringify(result));
  },
  deleteIndex: async (body: any) => {
    body = { indexName: body.indexName };
    const result = await searchFunctions.invokeSearchLambda(body, '/delete-index');
    console.log('🔃 search lambda response::: 🔃 ', result);
    return helperFunctions.createResponse(200, JSON.stringify(result));
  },
};

//ANCHOR - Email Html
const emailHtml = {
  articleCompletion: `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
  <html data-editor-version="2" class="sg-campaigns" xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1">
        <!--[if !mso]><!-->
        <meta http-equiv="X-UA-Compatible" content="IE=Edge">
        <!--<![endif]-->
        <!--[if (gte mso 9)|(IE)]>
        <xml>
          <o:OfficeDocumentSettings>
            <o:AllowPNG/>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
        </xml>
        <![endif]-->
        <!--[if (gte mso 9)|(IE)]>
    <style type="text/css">
      body {width: 600px;margin: 0 auto;}
      table {border-collapse: collapse;}
      table, td {mso-table-lspace: 0pt;mso-table-rspace: 0pt;}
      img {-ms-interpolation-mode: bicubic;}
    </style>
  <![endif]-->
        <style type="text/css">
      body, p, div {
        font-family: inherit;
        font-size: 14px;
      }
      body {
        color: #000000;
      }
      body a {
        color: #2D73FF;
        text-decoration: none;
      }
      p { margin: 0; padding: 0; }
      table.wrapper {
        width:100% !important;
        table-layout: fixed;
        -webkit-font-smoothing: antialiased;
        -webkit-text-size-adjust: 100%;
        -moz-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      img.max-width {
        max-width: 100% !important;
      }
      .column.of-2 {
        width: 50%;
      }
      .column.of-3 {
        width: 33.333%;
      }
      .column.of-4 {
        width: 25%;
      }
      ul ul ul ul  {
        list-style-type: disc !important;
      }
      ol ol {
        list-style-type: lower-roman !important;
      }
      ol ol ol {
        list-style-type: lower-latin !important;
      }
      ol ol ol ol {
        list-style-type: decimal !important;
      }
      @media screen and (max-width:480px) {
        .preheader .rightColumnContent,
        .footer .rightColumnContent {
          text-align: left !important;
        }
        .preheader .rightColumnContent div,
        .preheader .rightColumnContent span,
        .footer .rightColumnContent div,
        .footer .rightColumnContent span {
          text-align: left !important;
        }
        .preheader .rightColumnContent,
        .preheader .leftColumnContent {
          font-size: 80% !important;
          padding: 5px 0;
        }
        table.wrapper-mobile {
          width: 100% !important;
          table-layout: fixed;
        }
        img.max-width {
          height: auto !important;
          max-width: 100% !important;
        }
        a.bulletproof-button {
          display: block !important;
          width: auto !important;
          font-size: 80%;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
        .columns {
          width: 100% !important;
        }
        .column {
          display: block !important;
          width: 100% !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }
        .social-icon-column {
          display: inline-block !important;
        }
      }
    </style>
        <!--user entered Head Start--><link href="https://static1.squarespace.com/static/611da5dbb3229b68e49c06cb/t/63f910eda8884f6be93fe972/1677267181856/CircularStd-Book.otfhttps://static1.squarespace.com/static/611da5dbb3229b68e49c06cb/t/6401316c46ffd931182b8394/1677799788363/CircularStd-Medium.otf" rel="stylesheet"><style>
    body {
      font-family: 'CircularStd-Medium', sans-serif;
    }
  </style><!--End Head user entered-->
      </head>
      <body>
        <center class="wrapper" data-link-color="#2D73FF" data-body-style="font-size:14px; font-family:inherit; color:#000000; background-color:#FCFCFC;">
          <div class="webkit">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" class="wrapper" bgcolor="#FCFCFC">
              <tr>
                <td valign="top" bgcolor="#FCFCFC" width="100%">
                  <table width="100%" role="content-container" class="outer" align="center" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="100%">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td>
                              <!--[if mso]>
      <center>
      <table><tr><td width="600">
    <![endif]-->
                                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px;" align="center">
                                        <tr>
                                          <td role="modules-container" style="padding:0px 0px 0px 0px; color:#000000; text-align:left;" bgcolor="#FFFFFF" width="100%" align="left"><table class="module preheader preheader-hide" role="module" data-type="preheader" border="0" cellpadding="0" cellspacing="0" width="100%" style="display: none !important; mso-hide: all; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">
      <tr>
        <td role="module-content">
          <p></p>
        </td>
      </tr>
    </table><table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" role="module" data-type="columns" style="padding:20px 20px 20px 20px;" bgcolor="#FFFFFF" data-distribution="1">
      <tbody>
        <tr role="module-content">
          <td height="100%" valign="top"><table width="560" style="width:560px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-0">
        <tbody>
          <tr>
            <td style="padding:0px;margin:0px;border-spacing:0;"><table class="wrapper" role="module" data-type="image" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="eee2cfbb-273e-4c3d-8959-191e1f1e3d59">
      <tbody>
        <tr>
          <td style="font-size:6px; line-height:10px; padding:0px 0px 0px 0px;" valign="top" align="center">

          <a href="https://www.seshasystems.com"><img class="max-width" border="0" style="display:block; color:#000000; text-decoration:none; font-family:Helvetica, arial, sans-serif; font-size:16px; max-width:33% !important; width:33%; height:auto !important;" width="185" alt="" data-proportionally-constrained="true" data-responsive="true" src="http://cdn.mcauto-images-production.sendgrid.net/d26772979e6f511d/34285358-5350-4695-b340-f104afe3792b/195x50.png"></a></td>
        </tr>
      </tbody>
    </table></td>
          </tr>
        </tbody>
      </table></td>
        </tr>
      </tbody>
    </table><table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" role="module" data-type="columns" style="padding:0px 0px 0px 0px;" bgcolor="#20313f" data-distribution="1">
      <tbody>
        <tr role="module-content">
          <td height="100%" valign="top"><table width="580" style="width:580px; border-spacing:0; border-collapse:collapse; margin:0px 10px 0px 10px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-0">
        <tbody>
          <tr>
            <td style="padding:0px;margin:0px;border-spacing:0;"><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="875206ff-5c1e-40c3-aab9-f7897181d5f7.1" data-mc-module-version="2019-10-22">
      <tbody>
        <tr>
          <td style="padding:10px 0px 10px 0px; line-height:12px; text-align:inherit; background-color:#000000;" height="100%" valign="top" bgcolor="#000000" role="module-content"><div><h1 style="text-align: center; font-family: inherit"><span style="color: #ffffff; font-family: verdana, geneva, sans-serif">ARTICLE COMPLETED</span></h1><div></div></div></td>
        </tr>
      </tbody>
    </table></td>
          </tr>
        </tbody>
      </table></td>
        </tr>
      </tbody>
    </table><table class="module" role="module" data-type="divider" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="73ae13f6-cabd-46aa-a3b9-053cce903028">
      <tbody>
        <tr>
          <td style="padding:0px 0px 0px 0px;" role="module-content" height="100%" valign="top" bgcolor="">
            <table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" height="10px" style="line-height:10px; font-size:10px;">
              <tbody>
                <tr>
                  <td style="padding:0px 0px 10px 0px;" bgcolor="#ffffff"></td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="855b2f72-da4b-4e4a-ad77-d1578bfc5357" data-mc-module-version="2019-10-22">
      <tbody>
        <tr>
          <td style="padding:18px 0px 18px 0px; line-height:22px; text-align:inherit;" height="100%" valign="top" bgcolor="" role="module-content"><div><div style="font-family: inherit; text-align: inherit"><span style="font-family: verdana, geneva, sans-serif; color: #777777">Hi {{first_name}},<br>
  <br>
  Your article - "{{slug}}" version: {{version}} is now complete! This article is ready for your review.</span></div><div></div></div></td>
        </tr>
      </tbody>
    </table><table border="0" cellpadding="0" cellspacing="0" class="module" data-role="module-button" data-type="button" role="module" style="table-layout:fixed;" width="100%" data-muid="2ae612ac-47c6-4d9e-a7d2-7c8e8f3cddeb">
        <tbody>
          <tr>
            <td align="center" bgcolor="#F5F5F4" class="outer-td" style="padding:30px 0px 30px 0px; background-color:#F5F5F4;">
              <table border="0" cellpadding="0" cellspacing="0" class="wrapper-mobile" style="text-align:center;">
                <tbody>
                  <tr>
                  <td align="center" bgcolor="#2D73FF" class="inner-td" style="border-radius:6px; font-size:16px; text-align:center; background-color:inherit;">
                    <a href="{{article_url}}" style="background-color:#2D73FF; border:12px solid #2D73FF; border-color:#2D73FF; border-radius:8px; border-width:12px; color:#ffffff; display:inline-block; font-size:14px; font-weight:bold; letter-spacing:1px; line-height:normal; padding:12px 18px 12px 18px; text-align:center; text-decoration:none; border-style:solid; font-family:verdana,geneva,sans-serif;" target="_blank">REVIEW "{{slug}}" version: {{version}}</a>
                  </td>
                  </tr>
                  
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
        
      </table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="855b2f72-da4b-4e4a-ad77-d1578bfc5357.1" data-mc-module-version="2019-10-22">
      <tbody>
        <br/>
        
        <span style="color: #777777; font-family: verdana, geneva, sans-serif">Or copy this link into your browser: {{article_url}}</span>
        <tr>
          <td style="padding:18px 0px 18px 0px; line-height:22px; text-align:inherit;" height="100%" valign="top" bgcolor="" role="module-content"><div><div style="font-family: inherit; text-align: inherit"><span style="color: #777777; font-family: verdana, geneva, sans-serif">Now that your article is completed, you can always try to re-run it again with minor adjustments or make further human edits to polish it off.<br>
  <br>
  </span><span style="color: #777777; font-family: verdana, geneva, sans-serif"><em>TIP: You can run multiple versions of an article simultaneously to review and compare minor adjustments.</em></span></div><div></div></div></td>
        </tr>
      </tbody>
    </table>
      <tbody>
        <tr role="module-content">
          <td height="100%" valign="top"><table width="140" style="width:140px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-0">
        <tbody>
          <tr>
            <td style="padding:0px;margin:0px;border-spacing:0;"></td>
          </tr>
        </tbody>
      </table><table width="140" style="width:140px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-1">
        <tbody>
          <tr>
            <td style="padding:0px;margin:0px;border-spacing:0;"></td>
          </tr>
        </tbody>
      </table><table width="140" style="width:140px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-2">
        <tbody>
          <tr>
            <td style="padding:0px;margin:0px;border-spacing:0;"></td>
          </tr>
        </tbody>
      </table><table width="140" style="width:140px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-3">
        <tbody>
          <tr>
            <td style="padding:0px;margin:0px;border-spacing:0;"></td>
          </tr>
        </tbody>
      </table></td>
        </tr>
      </tbody>
    </table>
            </td>
          </tr>
        </tbody>
      </table></td>
                                        </tr>
                                      </table>
                                      <!--[if mso]>
                                    </td>
                                  </tr>
                                </table>
                              </center>
                              <![endif]-->
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
          </div>
        </center>
      </body>
    </html>
  `,
  verificationCode: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
  <html data-editor-version="2" class="sg-campaigns" xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1">
        <!--[if !mso]><!-->
        <meta http-equiv="X-UA-Compatible" content="IE=Edge">
        <!--<![endif]-->
        <!--[if (gte mso 9)|(IE)]>
        <xml>
          <o:OfficeDocumentSettings>
            <o:AllowPNG/>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
        </xml>
        <![endif]-->
        <!--[if (gte mso 9)|(IE)]>
    <style type="text/css">
      body {width: 600px;margin: 0 auto;}
      table {border-collapse: collapse;}
      table, td {mso-table-lspace: 0pt;mso-table-rspace: 0pt;}
      img {-ms-interpolation-mode: bicubic;}
    </style>
  <![endif]-->
        <style type="text/css">
      body, p, div {
        font-family: inherit;
        font-size: 14px;
      }
      body {
        color: #000000;
      }
      body a {
        color: #2D73FF;
        text-decoration: none;
      }
      p { margin: 0; padding: 0; }
      table.wrapper {
        width:100% !important;
        table-layout: fixed;
        -webkit-font-smoothing: antialiased;
        -webkit-text-size-adjust: 100%;
        -moz-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      img.max-width {
        max-width: 100% !important;
      }
      .column.of-2 {
        width: 50%;
      }
      .column.of-3 {
        width: 33.333%;
      }
      .column.of-4 {
        width: 25%;
      }
      ul ul ul ul  {
        list-style-type: disc !important;
      }
      ol ol {
        list-style-type: lower-roman !important;
      }
      ol ol ol {
        list-style-type: lower-latin !important;
      }
      ol ol ol ol {
        list-style-type: decimal !important;
      }
      @media screen and (max-width:480px) {
        .preheader .rightColumnContent,
        .footer .rightColumnContent {
          text-align: left !important;
        }
        .preheader .rightColumnContent div,
        .preheader .rightColumnContent span,
        .footer .rightColumnContent div,
        .footer .rightColumnContent span {
          text-align: left !important;
        }
        .preheader .rightColumnContent,
        .preheader .leftColumnContent {
          font-size: 80% !important;
          padding: 5px 0;
        }
        table.wrapper-mobile {
          width: 100% !important;
          table-layout: fixed;
        }
        img.max-width {
          height: auto !important;
          max-width: 100% !important;
        }
        a.bulletproof-button {
          display: block !important;
          width: auto !important;
          font-size: 80%;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
        .columns {
          width: 100% !important;
        }
        .column {
          display: block !important;
          width: 100% !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }
        .social-icon-column {
          display: inline-block !important;
        }
      }
    </style>
        <!--user entered Head Start--><link href="https://static1.squarespace.com/static/611da5dbb3229b68e49c06cb/t/63f910eda8884f6be93fe972/1677267181856/CircularStd-Book.otfhttps://static1.squarespace.com/static/611da5dbb3229b68e49c06cb/t/6401316c46ffd931182b8394/1677799788363/CircularStd-Medium.otf" rel="stylesheet"><style>
    body {
      font-family: 'CircularStd-Medium', sans-serif;
    }
  </style><!--End Head user entered-->
      </head>
      <body>
        <center class="wrapper" data-link-color="#2D73FF" data-body-style="font-size:14px; font-family:inherit; color:#000000; background-color:#FCFCFC;">
          <div class="webkit">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" class="wrapper" bgcolor="#FCFCFC">
              <tr>
                <td valign="top" bgcolor="#FCFCFC" width="100%">
                  <table width="100%" role="content-container" class="outer" align="center" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="100%">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td>
                              <!--[if mso]>
      <center>
      <table><tr><td width="600">
    <![endif]-->
                                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px;" align="center">
                                        <tr>
                                          <td role="modules-container" style="padding:0px 0px 0px 0px; color:#000000; text-align:left;" bgcolor="#FFFFFF" width="100%" align="left"><table class="module preheader preheader-hide" role="module" data-type="preheader" border="0" cellpadding="0" cellspacing="0" width="100%" style="display: none !important; mso-hide: all; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">
      <tr>
        <td role="module-content">
          <p></p>
        </td>
      </tr>
    </table><table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" role="module" data-type="columns" style="padding:20px 20px 20px 20px;" bgcolor="#FFFFFF" data-distribution="1">
      <tbody>
        <tr role="module-content">
          <td height="100%" valign="top"><table width="560" style="width:560px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-0">
        <tbody>
          <tr>
            <td style="padding:0px;margin:0px;border-spacing:0;"><table class="wrapper" role="module" data-type="image" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="eee2cfbb-273e-4c3d-8959-191e1f1e3d59">
      <tbody>
        <tr>
          <td style="font-size:6px; line-height:10px; padding:0px 0px 0px 0px;" valign="top" align="center">
            
          <a href="https://www.seshasystems.com"><img class="max-width" border="0" style="display:block; color:#000000; text-decoration:none; font-family:Helvetica, arial, sans-serif; font-size:16px; max-width:33% !important; width:33%; height:auto !important;" width="185" alt="" data-proportionally-constrained="true" data-responsive="true" src="http://cdn.mcauto-images-production.sendgrid.net/d26772979e6f511d/34285358-5350-4695-b340-f104afe3792b/195x50.png"></a></td>
        </tr>
      </tbody>
    </table></td>
          </tr>
        </tbody>
      </table></td>
        </tr>
      </tbody>
    </table><table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" role="module" data-type="columns" style="padding:0px 0px 0px 0px;" bgcolor="#20313f" data-distribution="1">
      <tbody>
        <tr role="module-content">
          <td height="100%" valign="top"><table width="580" style="width:580px; border-spacing:0; border-collapse:collapse; margin:0px 10px 0px 10px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-0">
        <tbody>
          <tr>
            <td style="padding:0px;margin:0px;border-spacing:0;"><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="875206ff-5c1e-40c3-aab9-f7897181d5f7.1" data-mc-module-version="2019-10-22">
      <tbody>
        <tr>
          <td style="padding:10px 0px 10px 0px; line-height:12px; text-align:inherit; background-color:#000000;" height="100%" valign="top" bgcolor="#000000" role="module-content"><div><h1 style="text-align: center; font-family: inherit"><span style="color: #ffffff; font-family: verdana, geneva, sans-serif">ACCOUNT VERIFICATION</span></h1><div></div></div></td>
        </tr>
      </tbody>
    </table></td>
          </tr>
        </tbody>
      </table></td>
        </tr>
      </tbody>
    </table><table class="module" role="module" data-type="divider" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="73ae13f6-cabd-46aa-a3b9-053cce903028">
      <tbody>
        <tr>
          <td style="padding:0px 0px 0px 0px;" role="module-content" height="100%" valign="top" bgcolor="">
            <table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" height="10px" style="line-height:10px; font-size:10px;">
              <tbody>
                <tr>
                  <td style="padding:0px 0px 10px 0px;" bgcolor="#ffffff"></td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="855b2f72-da4b-4e4a-ad77-d1578bfc5357" data-mc-module-version="2019-10-22">
      <tbody>
        <tr>
          <td style="padding:18px 0px 18px 0px; line-height:22px; text-align:inherit;" height="100%" valign="top" bgcolor="" role="module-content"><div><div style="font-family: inherit; text-align: inherit"><span style="font-family: verdana, geneva, sans-serif; color: #777777">Hi {{first_name}},<br>
  <br>
  Thanks for joining Sesha!</span></div>
  <div style="font-family: inherit; text-align: inherit"><span style="font-family: verdana, geneva, sans-serif; color: #777777"><br>
  To complete account sign-up: please input this verification code below on app.seshasystems.com to keep your account secure.<br>
  <br>
  Your verification code is:</span></div><div></div></div></td>
        </tr>
      </tbody>
    </table><table border="0" cellpadding="0" cellspacing="0" class="module" data-role="module-button" data-type="button" role="module" style="table-layout:fixed;" width="100%" data-muid="2ae612ac-47c6-4d9e-a7d2-7c8e8f3cddeb">
        <tbody>
          <tr>
            <td align="center" bgcolor="#F5F5F4" class="outer-td" style="padding:30px 0px 30px 0px; background-color:#F5F5F4;">
              <table border="0" cellpadding="0" cellspacing="0" class="wrapper-mobile" style="text-align:center;">
                <tbody>
                  <tr>
                  <td align="center" bgcolor="#2D73FF" class="inner-td" style="border-radius:6px; font-size:16px; text-align:center; background-color:inherit;">
                    <a href="" style="background-color:#2D73FF; border:12px solid #2D73FF; border-color:#2D73FF; border-radius:8px; border-width:12px; color:#ffffff; display:inline-block; font-size:14px; font-weight:bold; letter-spacing:1px; line-height:normal; padding:12px 18px 12px 18px; text-align:center; text-decoration:none; border-style:solid; font-family:verdana,geneva,sans-serif;" target="_blank">{{ Verification_code }}</a>
                  </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="855b2f72-da4b-4e4a-ad77-d1578bfc5357.1" data-mc-module-version="2019-10-22">
      <tbody>
        <tr>
  Once you verify, you'll be able to complete the sign up process and begin creating articles.</span></div><div></div></div></td>
        </tr>
      </tbody>
    </table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="972f936d-f1bf-40fd-898c-21fe3724beb1" data-mc-module-version="2019-10-22">
      <tbody>
        <tr>
          <td style="padding:18px 18px 18px 18px; line-height:22px; text-align:inherit; background-color:#000000;" height="100%" valign="top" bgcolor="#000000" role="module-content"><div><div style="font-family: inherit; text-align: start"><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0pt; margin-right: 0px; margin-bottom: 0pt; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: normal; font-variant-east-asian: normal; font-weight: 700; font-stretch: inherit; line-height: 1.38; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; color: #ffffff; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; text-decoration-line: none; font-family: verdana, geneva, sans-serif">Need any other help?</span><span style="font-family: verdana, geneva, sans-serif">&nbsp;</span></div>
  <div style="font-family: inherit; text-align: start"><span style="font-family: verdana, geneva, sans-serif"><br>
  </span><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0px; margin-right: 0px; margin-bottom: 0px; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: inherit; font-variant-east-asian: inherit; font-weight: inherit; font-stretch: inherit; line-height: inherit; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-line: none; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; color: #ffffff; font-family: verdana, geneva, sans-serif">Check out our Support page to review our </span><a href="https://www.seshasystems.com/support#FAQs"><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0pt; margin-right: 0px; margin-bottom: 0pt; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: normal; font-variant-east-asian: normal; font-weight: inherit; font-stretch: inherit; line-height: 1.38; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; outline-color: initial; outline-style: none; outline-width: initial; color: #ffffff; text-decoration-line: underline; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; transition-duration: 0.3s; transition-timing-function: ease; transition-delay: 0s; transition-property: color; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-skip-ink: none; font-family: verdana, geneva, sans-serif">FAQs</span></a><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0px; margin-right: 0px; margin-bottom: 0px; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: inherit; font-variant-east-asian: inherit; font-weight: inherit; font-stretch: inherit; line-height: inherit; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-line: none; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; color: #ffffff; font-family: verdana, geneva, sans-serif"> or </span><a href="https://www.seshasystems.com/support#Contact"><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0pt; margin-right: 0px; margin-bottom: 0pt; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: normal; font-variant-east-asian: normal; font-weight: inherit; font-stretch: inherit; line-height: 1.38; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; outline-color: initial; outline-style: none; outline-width: initial; color: #ffffff; text-decoration-line: underline; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; transition-duration: 0.3s; transition-timing-function: ease; transition-delay: 0s; transition-property: color; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-skip-ink: none; font-family: verdana, geneva, sans-serif">Contact us</span></a><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0px; margin-right: 0px; margin-bottom: 0px; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: inherit; font-variant-east-asian: inherit; font-weight: inherit; font-stretch: inherit; line-height: inherit; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-line: none; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; color: #ffffff; font-family: verdana, geneva, sans-serif"> and we can help you further.</span></div>
  <div style="font-family: inherit; text-align: inherit; margin-left: 0px"><span style="font-family: verdana, geneva, sans-serif">&nbsp;</span></div>
  <div style="font-family: inherit; text-align: inherit; margin-left: 0px"><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0pt; margin-right: 0px; margin-bottom: 0pt; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: normal; font-variant-east-asian: normal; font-weight: inherit; font-stretch: inherit; line-height: 1.38; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; color: #ffffff; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; text-decoration-line: none; font-family: verdana, geneva, sans-serif">Happy creating,</span></div>
  <div style="font-family: inherit; text-align: start"><br></div>
  <div style="font-family: inherit; text-align: inherit; margin-left: 0px"><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0pt; margin-right: 0px; margin-bottom: 0pt; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: normal; font-variant-east-asian: normal; font-weight: inherit; font-stretch: inherit; line-height: 1.38; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; color: #ffffff; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; text-decoration-line: none; font-family: verdana, geneva, sans-serif">- The Sesha Team</span><span style="font-family: verdana, geneva, sans-serif">&nbsp;</span></div><div></div></div></td>
        </tr>
      </tbody>
    </table><table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" role="module" data-type="columns" style="padding:0px 20px 0px 20px;" bgcolor="#87CEEA" data-distribution="1,1,1,1">
      <tbody>
        <tr role="module-content">
          <td height="100%" valign="top"><table width="140" style="width:140px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-0">
        <tbody>
          <tr>
            <td style="padding:0px;margin:0px;border-spacing:0;"></td>
          </tr>
        </tbody>
      </table><table width="140" style="width:140px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-1">
        <tbody>
          <tr>
            <td style="padding:0px;margin:0px;border-spacing:0;"></td>
          </tr>
        </tbody>
      </table><table width="140" style="width:140px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-2">
        <tbody>
          <tr>
            <td style="padding:0px;margin:0px;border-spacing:0;"></td>
          </tr>
        </tbody>
      </table><table width="140" style="width:140px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-3">
        <tbody>
          <tr>
            <td style="padding:0px;margin:0px;border-spacing:0;"></td>
          </tr>
        </tbody>
      </table></td>
        </tr>
      </tbody>
    </table>
            </td>
          </tr>
        </tbody>
      </table></td>
                                        </tr>
                                      </table>
                                      <!--[if mso]>
                                    </td>
                                  </tr>
                                </table>
                              </center>
                              <![endif]-->
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
          </div>
        </center>
      </body>
    </html>`,
  forgotPassword: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
    <html data-editor-version="2" class="sg-campaigns" xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1">
          <!--[if !mso]><!-->
          <meta http-equiv="X-UA-Compatible" content="IE=Edge">
          <!--<![endif]-->
          <!--[if (gte mso 9)|(IE)]>
          <xml>
            <o:OfficeDocumentSettings>
              <o:AllowPNG/>
              <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
          </xml>
          <![endif]-->
          <!--[if (gte mso 9)|(IE)]>
      <style type="text/css">
        body {width: 600px;margin: 0 auto;}
        table {border-collapse: collapse;}
        table, td {mso-table-lspace: 0pt;mso-table-rspace: 0pt;}
        img {-ms-interpolation-mode: bicubic;}
      </style>
    <![endif]-->
          <style type="text/css">
        body, p, div {
          font-family: inherit;
          font-size: 14px;
        }
        body {
          color: #000000;
        }
        body a {
          color: #2D73FF;
          text-decoration: none;
        }
        p { margin: 0; padding: 0; }
        table.wrapper {
          width:100% !important;
          table-layout: fixed;
          -webkit-font-smoothing: antialiased;
          -webkit-text-size-adjust: 100%;
          -moz-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }
        img.max-width {
          max-width: 100% !important;
        }
        .column.of-2 {
          width: 50%;
        }
        .column.of-3 {
          width: 33.333%;
        }
        .column.of-4 {
          width: 25%;
        }
        ul ul ul ul  {
          list-style-type: disc !important;
        }
        ol ol {
          list-style-type: lower-roman !important;
        }
        ol ol ol {
          list-style-type: lower-latin !important;
        }
        ol ol ol ol {
          list-style-type: decimal !important;
        }
        @media screen and (max-width:480px) {
          .preheader .rightColumnContent,
          .footer .rightColumnContent {
            text-align: left !important;
          }
          .preheader .rightColumnContent div,
          .preheader .rightColumnContent span,
          .footer .rightColumnContent div,
          .footer .rightColumnContent span {
            text-align: left !important;
          }
          .preheader .rightColumnContent,
          .preheader .leftColumnContent {
            font-size: 80% !important;
            padding: 5px 0;
          }
          table.wrapper-mobile {
            width: 100% !important;
            table-layout: fixed;
          }
          img.max-width {
            height: auto !important;
            max-width: 100% !important;
          }
          a.bulletproof-button {
            display: block !important;
            width: auto !important;
            font-size: 80%;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          .columns {
            width: 100% !important;
          }
          .column {
            display: block !important;
            width: 100% !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          .social-icon-column {
            display: inline-block !important;
          }
        }
      </style>
          <!--user entered Head Start--><link href="https://static1.squarespace.com/static/611da5dbb3229b68e49c06cb/t/63f910eda8884f6be93fe972/1677267181856/CircularStd-Book.otfhttps://static1.squarespace.com/static/611da5dbb3229b68e49c06cb/t/6401316c46ffd931182b8394/1677799788363/CircularStd-Medium.otf" rel="stylesheet"><style>
      body {
        font-family: 'CircularStd-Medium', sans-serif;
      }
    </style><!--End Head user entered-->
        </head>
        <body>
          <center class="wrapper" data-link-color="#2D73FF" data-body-style="font-size:14px; font-family:inherit; color:#000000; background-color:#FCFCFC;">
            <div class="webkit">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" class="wrapper" bgcolor="#FCFCFC">
                <tr>
                  <td valign="top" bgcolor="#FCFCFC" width="100%">
                    <table width="100%" role="content-container" class="outer" align="center" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="100%">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td>
                                <!--[if mso]>
        <center>
        <table><tr><td width="600">
      <![endif]-->
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px;" align="center">
                                          <tr>
                                            <td role="modules-container" style="padding:0px 0px 0px 0px; color:#000000; text-align:left;" bgcolor="#FFFFFF" width="100%" align="left"><table class="module preheader preheader-hide" role="module" data-type="preheader" border="0" cellpadding="0" cellspacing="0" width="100%" style="display: none !important; mso-hide: all; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">
        <tr>
          <td role="module-content">
            <p></p>
          </td>
        </tr>
      </table><table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" role="module" data-type="columns" style="padding:20px 20px 20px 20px;" bgcolor="#FFFFFF" data-distribution="1">
        <tbody>
          <tr role="module-content">
            <td height="100%" valign="top"><table width="560" style="width:560px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-0">
          <tbody>
            <tr>
              <td style="padding:0px;margin:0px;border-spacing:0;"><table class="wrapper" role="module" data-type="image" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="eee2cfbb-273e-4c3d-8959-191e1f1e3d59">
        <tbody>
          <tr>
            <td style="font-size:6px; line-height:10px; padding:0px 0px 0px 0px;" valign="top" align="center">
              
            <a href="https://www.seshasystems.com"><img class="max-width" border="0" style="display:block; color:#000000; text-decoration:none; font-family:Helvetica, arial, sans-serif; font-size:16px; max-width:33% !important; width:33%; height:auto !important;" width="185" alt="" data-proportionally-constrained="true" data-responsive="true" src="http://cdn.mcauto-images-production.sendgrid.net/d26772979e6f511d/34285358-5350-4695-b340-f104afe3792b/195x50.png"></a></td>
          </tr>
        </tbody>
      </table></td>
            </tr>
          </tbody>
        </table></td>
          </tr>
        </tbody>
      </table><table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" role="module" data-type="columns" style="padding:0px 0px 0px 0px;" bgcolor="#20313f" data-distribution="1">
        <tbody>
          <tr role="module-content">
            <td height="100%" valign="top"><table width="580" style="width:580px; border-spacing:0; border-collapse:collapse; margin:0px 10px 0px 10px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-0">
          <tbody>
            <tr>
              <td style="padding:0px;margin:0px;border-spacing:0;"><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="875206ff-5c1e-40c3-aab9-f7897181d5f7.1" data-mc-module-version="2019-10-22">
        <tbody>
          <tr>
            <td style="padding:10px 0px 10px 0px; line-height:12px; text-align:inherit; background-color:#000000;" height="100%" valign="top" bgcolor="#000000" role="module-content"><div><h1 style="text-align: center; font-family: inherit"><span style="color: #ffffff; font-family: verdana, geneva, sans-serif">RESET PASSWORD</span></h1><div></div></div></td>
          </tr>
        </tbody>
      </table></td>
            </tr>
          </tbody>
        </table></td>
          </tr>
        </tbody>
      </table><table class="module" role="module" data-type="divider" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="73ae13f6-cabd-46aa-a3b9-053cce903028">
        <tbody>
          <tr>
            <td style="padding:0px 0px 0px 0px;" role="module-content" height="100%" valign="top" bgcolor="">
              <table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" height="10px" style="line-height:10px; font-size:10px;">
                <tbody>
                  <tr>
                    <td style="padding:0px 0px 10px 0px;" bgcolor="#ffffff"></td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="855b2f72-da4b-4e4a-ad77-d1578bfc5357" data-mc-module-version="2019-10-22">
        <tbody>
          <tr>
            <td style="padding:18px 0px 18px 0px; line-height:22px; text-align:inherit;" height="100%" valign="top" bgcolor="" role="module-content"><div><div style="font-family: inherit; text-align: inherit"><span style="font-family: verdana, geneva, sans-serif; color: #777777">Hi {{first_name}},<br>
    <br>
    A password reset request has been initiated for your account. Please insert use this code to create a new password: </span></div><div></div></div></td>
          </tr>
        </tbody>
      </table><table border="0" cellpadding="0" cellspacing="0" class="module" data-role="module-button" data-type="button" role="module" style="table-layout:fixed;" width="100%" data-muid="2ae612ac-47c6-4d9e-a7d2-7c8e8f3cddeb">
          <tbody>
            <tr>
              <td align="center" bgcolor="#F5F5F4" class="outer-td" style="padding:30px 0px 30px 0px; background-color:#F5F5F4;">
                <table border="0" cellpadding="0" cellspacing="0" class="wrapper-mobile" style="text-align:center;">
                  <tbody>
                    <tr>
                    <td align="center" bgcolor="#2D73FF" class="inner-td" style="border-radius:6px; font-size:16px; text-align:center; background-color:inherit;">
                      <p style="background-color:#2D73FF; border:12px solid #2D73FF; border-color:#2D73FF; border-radius:8px; border-width:12px; color:#ffffff; display:inline-block; font-size:14px; font-weight:bold; letter-spacing:1px; line-height:normal; padding:12px 18px 12px 18px; text-align:center; text-decoration:none; border-style:solid; font-family:verdana,geneva,sans-serif;" target="_blank">{{recovery_code}}</p>
                    </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="855b2f72-da4b-4e4a-ad77-d1578bfc5357.1" data-mc-module-version="2019-10-22">
        <tbody>
          <tr>
            <td style="padding:18px 0px 18px 0px; line-height:22px; text-align:inherit;" height="100%" valign="top" bgcolor="" role="module-content"><div><div style="font-family: inherit; text-align: inherit">
    <br>
    If you did not mean to do this, you can ignore this email and your password will not be reset. If you did not do this and think someone may have illegally accessed your account, </span><a href="https://www.seshasystems.com/support#Contact"><span style="color: #777777; font-family: verdana, geneva, sans-serif"><u>please reach out to us here</u></span></a><span style="color: #777777; font-family: verdana, geneva, sans-serif">.</span></div><div></div></div></td>
          </tr>
        </tbody>
      </table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="972f936d-f1bf-40fd-898c-21fe3724beb1" data-mc-module-version="2019-10-22">
        <tbody>
          <tr>
            <td style="padding:18px 18px 18px 18px; line-height:22px; text-align:inherit; background-color:#000000;" height="100%" valign="top" bgcolor="#000000" role="module-content"><div><div style="font-family: inherit; text-align: start"><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0pt; margin-right: 0px; margin-bottom: 0pt; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: normal; font-variant-east-asian: normal; font-weight: 700; font-stretch: inherit; line-height: 1.38; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; color: #ffffff; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; text-decoration-line: none; font-family: verdana, geneva, sans-serif">Need any other help?</span><span style="font-family: verdana, geneva, sans-serif">&nbsp;</span></div>
    <div style="font-family: inherit; text-align: start"><span style="font-family: verdana, geneva, sans-serif"><br>
    </span><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0px; margin-right: 0px; margin-bottom: 0px; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: inherit; font-variant-east-asian: inherit; font-weight: inherit; font-stretch: inherit; line-height: inherit; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-line: none; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; color: #ffffff; font-family: verdana, geneva, sans-serif">Check out our Support page to review our </span><a href="https://www.seshasystems.com/support#FAQs"><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0pt; margin-right: 0px; margin-bottom: 0pt; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: normal; font-variant-east-asian: normal; font-weight: inherit; font-stretch: inherit; line-height: 1.38; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; outline-color: initial; outline-style: none; outline-width: initial; color: #ffffff; text-decoration-line: underline; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; transition-duration: 0.3s; transition-timing-function: ease; transition-delay: 0s; transition-property: color; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-skip-ink: none; font-family: verdana, geneva, sans-serif">FAQs</span></a><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0px; margin-right: 0px; margin-bottom: 0px; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: inherit; font-variant-east-asian: inherit; font-weight: inherit; font-stretch: inherit; line-height: inherit; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-line: none; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; color: #ffffff; font-family: verdana, geneva, sans-serif"> or </span><a href="https://www.seshasystems.com/support#Contact"><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0pt; margin-right: 0px; margin-bottom: 0pt; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: normal; font-variant-east-asian: normal; font-weight: inherit; font-stretch: inherit; line-height: 1.38; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; outline-color: initial; outline-style: none; outline-width: initial; color: #ffffff; text-decoration-line: underline; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; transition-duration: 0.3s; transition-timing-function: ease; transition-delay: 0s; transition-property: color; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-skip-ink: none; font-family: verdana, geneva, sans-serif">Contact us</span></a><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0px; margin-right: 0px; margin-bottom: 0px; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: inherit; font-variant-east-asian: inherit; font-weight: inherit; font-stretch: inherit; line-height: inherit; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-line: none; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; color: #ffffff; font-family: verdana, geneva, sans-serif"> and we can help you further.</span></div>
    <div style="font-family: inherit; text-align: inherit; margin-left: 0px"><span style="font-family: verdana, geneva, sans-serif">&nbsp;</span></div>
    <div style="font-family: inherit; text-align: inherit; margin-left: 0px"><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0pt; margin-right: 0px; margin-bottom: 0pt; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: normal; font-variant-east-asian: normal; font-weight: inherit; font-stretch: inherit; line-height: 1.38; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; color: #ffffff; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; text-decoration-line: none; font-family: verdana, geneva, sans-serif">Happy creating,</span></div>
    <div style="font-family: inherit; text-align: start"><br></div>
    <div style="font-family: inherit; text-align: inherit; margin-left: 0px"><span style="box-sizing: border-box; padding-top: 0px; padding-right: 0px; padding-bottom: 0px; padding-left: 0px; margin-top: 0pt; margin-right: 0px; margin-bottom: 0pt; margin-left: 0px; font-style: inherit; font-variant-ligatures: inherit; font-variant-caps: inherit; font-variant-numeric: normal; font-variant-east-asian: normal; font-weight: inherit; font-stretch: inherit; line-height: 1.38; font-size: 14.6667px; vertical-align: baseline; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; border-top-style: initial; border-right-style: initial; border-bottom-style: initial; border-left-style: initial; border-top-color: initial; border-right-color: initial; border-bottom-color: initial; border-left-color: initial; border-image-source: initial; border-image-slice: initial; border-image-width: initial; border-image-outset: initial; border-image-repeat: initial; color: #ffffff; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space-collapse: preserve; text-wrap: wrap; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; background-color: transparent; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; text-decoration-line: none; font-family: verdana, geneva, sans-serif">- The Sesha Team</span><span style="font-family: verdana, geneva, sans-serif">&nbsp;</span></div><div></div></div></td>
          </tr>
        </tbody>
      </table><table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" role="module" data-type="columns" style="padding:0px 20px 0px 20px;" bgcolor="#87CEEA" data-distribution="1,1,1,1">
        <tbody>
          <tr role="module-content">
            <td height="100%" valign="top"><table width="140" style="width:140px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-0">
          <tbody>
            <tr>
              <td style="padding:0px;margin:0px;border-spacing:0;"></td>
            </tr>
          </tbody>
        </table><table width="140" style="width:140px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-1">
          <tbody>
            <tr>
              <td style="padding:0px;margin:0px;border-spacing:0;"></td>
            </tr>
          </tbody>
        </table><table width="140" style="width:140px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-2">
          <tbody>
            <tr>
              <td style="padding:0px;margin:0px;border-spacing:0;"></td>
            </tr>
          </tbody>
        </table><table width="140" style="width:140px; border-spacing:0; border-collapse:collapse; margin:0px 0px 0px 0px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-3">
          <tbody>
            <tr>
              <td style="padding:0px;margin:0px;border-spacing:0;"></td>
            </tr>
          </tbody>
        </table></td>
          </tr>
        </tbody>
      </table>
              </td>
            </tr>
          </tbody>
        </table></td>
                                          </tr>
                                        </table>
                                        <!--[if mso]>
                                      </td>
                                    </tr>
                                  </table>
                                </center>
                                <![endif]-->
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
            </div>
          </center>
        </body>
      </html>`,
};
