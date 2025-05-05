"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pingOrgMembers = exports.sendMessageHandler = exports.disconnectHandler = exports.connectHandler = exports.articleGenerationLambdas = exports.startArticleStepFunctionExecution = exports.startDigestStepFunctionExecution = exports.createResponse = exports.isLongBaseSource = exports.createDBEntry = exports.listDBTable = exports.queryLibrary = exports.fetchOrgConnections = exports.countWords = exports.getUserInfo = exports.searchArticles = exports.deleteArticle = exports.updateArticle = exports.forgetPassword = exports.userSignOut = exports.userSignIn = exports.confirmUserSignUp = exports.createOrganization = exports.userSignup = exports.generateArticle = exports.generateDigest = exports.fetchSource = exports.deleteDBEntry = exports.updateDBEntry = exports.readDBEntry = exports.createLibraryEntry = exports.fetchArticlesBySlug = exports.validateOrgId = exports.resendVerificationCode = exports.getArticleById = exports.validateToken = exports.getArticleByParams = exports.handler = void 0;
const gptHelpers_1 = require("./gptHelpers");
const axios_1 = __importDefault(require("axios"));
const jsdom_1 = require("jsdom");
const readability_1 = require("@mozilla/readability");
const uuid_1 = require("uuid");
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const sheetHelpers_1 = require("./sheetHelpers");
const enums_1 = require("./enums");
const client_apigatewaymanagementapi_1 = require("@aws-sdk/client-apigatewaymanagementapi");
const aws_jwt_verify_1 = require("aws-jwt-verify");
const lodash_words_1 = __importDefault(require("lodash.words"));
// aws sdk
const dynamoDB = new aws_sdk_1.default.DynamoDB.DocumentClient();
const stepFunctions = new aws_sdk_1.default.StepFunctions();
// ANCHOR router
const handler = (event, context) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`----- Received event -----\n${JSON.stringify(event)}`);
    let path = event.rawPath;
    let method = event.requestContext.http.method;
    let body = {};
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
        case `/${process.env.env}/fetch-source`:
        case `/${process.env.env}/fetch-source/`:
            return yield (0, exports.fetchSource)(body, queryStringParameters);
        case `/${process.env.env}/generate-digest`:
        case `/${process.env.env}/generate-digest/`:
            return yield (0, exports.generateDigest)(body, queryStringParameters);
        case `/${process.env.env}/generate-article`:
        case `/${process.env.env}/generate-article/`:
            return yield (0, exports.generateArticle)(body, queryStringParameters);
        case `/${process.env.env}/list-table`:
        case `/${process.env.env}/list-table/`:
            return yield (0, exports.listDBTable)({
                tableName: body.tableName,
            });
        case `/${process.env.env}/create-library-entry`:
        case `/${process.env.env}/create-library-entry/`:
            return yield (0, exports.createLibraryEntry)(body);
        case `/${process.env.env}/user-sign-in`:
        case `/${process.env.env}/user-sign-in/`:
            return yield (0, exports.userSignIn)(body);
        case `/${process.env.env}/forget-password`:
        case `/${process.env.env}/forget-password/`:
            return yield (0, exports.forgetPassword)(body, queryStringParameters);
        case `/${process.env.env}/update-article`:
        case `/${process.env.env}/update-article/`:
            return yield (0, exports.updateArticle)(body, queryStringParameters);
        case `/${process.env.env}/delete-article`:
        case `/${process.env.env}/delete-article/`:
            return yield (0, exports.deleteArticle)(body, queryStringParameters);
        case `/${process.env.env}/search-articles`:
        case `/${process.env.env}/search-articles/`:
            return yield (0, exports.searchArticles)(body, queryStringParameters);
        case `/${process.env.env}/list-presets`:
        case `/${process.env.env}/list-presets/`:
            return yield (0, exports.listDBTable)({ tableName: enums_1.Tables.settingsPresets });
        case `/${process.env.env}/save-preset`:
        case `/${process.env.env}/save-preset/`:
            return yield (0, exports.createDBEntry)(enums_1.Tables.settingsPresets, body);
        case `/${process.env.env}/fetch-articles-by-slug`:
        case `/${process.env.env}/fetch-articles-by-slug/`:
            return yield (0, exports.fetchArticlesBySlug)(body);
        case `/${process.env.env}/user-signup`:
        case `/${process.env.env}/user-signup/`:
            return yield (0, exports.userSignup)(body);
        case `/${process.env.env}/create-organization`:
        case `/${process.env.env}/create-organization/`:
            return yield (0, exports.userSignup)(body);
        case `/${process.env.env}/confirm-signup`:
        case `/${process.env.env}/confirm-signup/`:
            return yield (0, exports.confirmUserSignUp)(body);
        case `/${process.env.env}/validate-organization-id`:
        case `/${process.env.env}/validate-organization-id/`:
            return yield (0, exports.validateOrgId)(body);
        case `/${process.env.env}/query-library`:
        case `/${process.env.env}/query-library/`:
            return yield (0, exports.queryLibrary)(body);
        case `/${process.env.env}/resend-verification-code`:
        case `/${process.env.env}/resend-verification-code/`:
            return yield (0, exports.resendVerificationCode)(body);
        case `/${process.env.env}/get-user-info`:
        case `/${process.env.env}/get-user-info/`:
            return yield (0, exports.getUserInfo)(body);
        case `/${process.env.env}/get-article-by-id`:
        case `/${process.env.env}/get-article-by-id/`:
            return yield (0, exports.getArticleById)(body);
        case `/${process.env.env}/user-sign-out`:
        case `/${process.env.env}/user-sign-out/`:
            return yield (0, exports.userSignOut)(body);
        case '/dev/validate-token':
        case '/dev/validate-token/':
            return yield (0, exports.validateToken)(body);
        case `/${process.env.env}/get-article-by-params`:
        case `/${process.env.env}/get-article-by-params/`:
            return yield (0, exports.getArticleByParams)(body);
        default:
            return (0, exports.createResponse)(404, JSON.stringify({ error: path + ' Not Found' }));
    }
});
exports.handler = handler;
// ANCHOR Handler functions
const getArticleByParams = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const params = {
        TableName: enums_1.Tables.library,
        IndexName: enums_1.TablesIndexes.slugVersion,
        KeyConditionExpression: 'slug = :slug and version = :version',
        FilterExpression: 'orgId=:orgId',
        ExpressionAttributeValues: {
            ':slug': body.slug,
            ':orgId': body.orgId,
            ':version': body.version,
        },
    };
    try {
        const data = yield dynamoDB.query(params).promise();
        return (0, exports.createResponse)(200, JSON.stringify({ response: data }));
    }
    catch (err) {
        return (0, exports.createResponse)(500, JSON.stringify({ error: err }));
    }
});
exports.getArticleByParams = getArticleByParams;
const validateToken = (body) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🪙 validating token 🪙. body:: ', body);
    console.log('token:::: ', body.token);
    const token = body.token;
    const cognitoUserPoolId = process.env.cognitoUserPoolId;
    const region = process.env.region;
    const cognitoClientId = process.env.cognitoClientId;
    let isValid = false;
    const verifier = aws_jwt_verify_1.CognitoJwtVerifier.create({
        userPoolId: cognitoUserPoolId,
        clientId: cognitoClientId,
        tokenUse: 'access',
    });
    try {
        const payload = yield verifier.verify(token);
        console.log('token validation payload ✉️:: ', payload);
        isValid = true;
    }
    catch (e) {
        console.error('🪙🚫 tokens not valid');
        isValid = false;
    }
    return isValid;
});
exports.validateToken = validateToken;
const getArticleById = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const params = {
        TableName: enums_1.Tables.library,
        IndexName: enums_1.TablesIndexes.articleId,
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: {
            ':id': body.id,
        },
    };
    try {
        const data = yield dynamoDB.query(params).promise();
        return (0, exports.createResponse)(200, JSON.stringify({ response: data }));
    }
    catch (err) {
        return (0, exports.createResponse)(500, JSON.stringify({ error: err }));
    }
});
exports.getArticleById = getArticleById;
const resendVerificationCode = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient();
    const input = {
        ClientId: process.env.cognitoClientId,
        Username: body.email,
    };
    const command = new client_cognito_identity_provider_1.ResendConfirmationCodeCommand(input);
    try {
        yield client.send(command);
    }
    catch (error) {
        console.error(error);
    }
});
exports.resendVerificationCode = resendVerificationCode;
const validateOrgId = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const params = {
        TableName: enums_1.Tables.organizations,
        IndexName: enums_1.TablesIndexes.id,
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: {
            ':id': body.id,
        },
    };
    try {
        const data = yield dynamoDB.query(params).promise();
        return (0, exports.createResponse)(200, JSON.stringify({ response: data }));
    }
    catch (err) {
        return (0, exports.createResponse)(500, JSON.stringify({ error: err }));
    }
});
exports.validateOrgId = validateOrgId;
const fetchArticlesBySlug = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const params = {
        TableName: enums_1.Tables.library,
        IndexName: enums_1.TablesIndexes.slugTimestamp,
        KeyConditionExpression: 'slug = :slug',
        ExpressionAttributeValues: {
            ':slug': body.slug,
        },
    };
    try {
        const data = yield dynamoDB.query(params).promise();
        return (0, exports.createResponse)(200, JSON.stringify({ response: data }));
    }
    catch (err) {
        return (0, exports.createResponse)(500, JSON.stringify({ error: err }));
    }
});
exports.fetchArticlesBySlug = fetchArticlesBySlug;
const createLibraryEntry = (body) => __awaiter(void 0, void 0, void 0, function* () {
    body.id = (0, uuid_1.v4)();
    const params = {
        TableName: enums_1.Tables.library,
        Item: body,
    };
    try {
        yield dynamoDB.put(params).promise();
        return { id: body.id };
    }
    catch (error) {
        console.error('Error creating DB entry: ', error);
        throw error;
    }
});
exports.createLibraryEntry = createLibraryEntry;
const readDBEntry = (tableName, key) => __awaiter(void 0, void 0, void 0, function* () {
    const params = {
        TableName: tableName,
        Key: key,
    };
    try {
        const result = yield dynamoDB.get(params).promise();
        return result.Item;
    }
    catch (error) {
        console.error('Error reading DB entry: ', error);
        return error;
    }
});
exports.readDBEntry = readDBEntry;
const updateDBEntry = (tableName, key, updateData) => __awaiter(void 0, void 0, void 0, function* () {
    const expressionAttributeValues = {};
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
        const result = yield dynamoDB.update(params).promise();
        return result.Attributes;
    }
    catch (error) {
        console.error('Error updating DB entry: ', error);
        throw error;
    }
});
exports.updateDBEntry = updateDBEntry;
const deleteDBEntry = (tableName, key) => __awaiter(void 0, void 0, void 0, function* () {
    const params = {
        TableName: tableName,
        Key: key,
    };
    try {
        yield dynamoDB.delete(params).promise();
        return 'Entry deleted successfully';
    }
    catch (error) {
        console.error('Error deleting DB entry: ', error);
        throw error;
    }
});
exports.deleteDBEntry = deleteDBEntry;
const fetchSource = (body, queryStringParameters) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('📰, fetching source');
    const url = body.url;
    try {
        const response = yield axios_1.default.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });
        const dom = new jsdom_1.JSDOM(response.data);
        const reader = new readability_1.Readability(dom.window.document);
        const article = reader.parse();
        console.log('📎', article === null || article === void 0 ? void 0 : article.content);
        return (0, exports.createResponse)(200, JSON.stringify({ content: article === null || article === void 0 ? void 0 : article.content }));
    }
    catch (e) {
        return (0, exports.createResponse)(500, JSON.stringify({ error: e }));
    }
});
exports.fetchSource = fetchSource;
const generateDigest = (body, queryStringParameters) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('📰', 'DIGEST STARTED');
    let source = body.source;
    const settings = body.settings;
    const instructions = body.instructions;
    const digestId = (0, uuid_1.v4)();
    console.log('🏓 table name: ', enums_1.Tables.library);
    // create dynamodb entry
    const data = yield (0, exports.createDBEntry)(enums_1.Tables.library, {
        id: digestId,
        slug: body.slug,
        source: source,
        timestamp: new Date().valueOf(),
        orgId: body.orgId ? body.orgId : '1',
        authorId: body.authorId ? body.authorId : 'a',
        version: body.version ? body.version : '1-00',
        sourceType: 'single',
        progress: '0%',
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
    });
    const promptsDigest = yield (0, sheetHelpers_1.getRawPrompts)(process.env.env === 'prod' ? enums_1.Sheets.digest_prompts : enums_1.Sheets.digest_prompts_dev);
    const stateMachineName = process.env.env === 'prod' ? 'digest-state-machine-prod' : 'digest-state-machine-dev';
    // pass input and dynamodb entry to digest step function
    yield (0, exports.startDigestStepFunctionExecution)(`arn:aws:states:${process.env.region}:${process.env.accountId}:stateMachine:${stateMachineName}`, {
        prompts: promptsDigest,
        dynamodbData: { id: data.id, tableName: enums_1.Tables.library },
        instructions: instructions,
        settings: settings,
        source: source,
    });
    // return dynamodb id to user
    return (0, exports.createResponse)(200, JSON.stringify({ tableName: enums_1.Tables.library, DBId: digestId }));
});
exports.generateDigest = generateDigest;
const generateArticle = (body, queryStringParameters) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🗞️', 'ARTICLE STARTED');
    const settings = body.settings;
    const instructions = body.instructions;
    const articleId = (0, uuid_1.v4)();
    // create dynamodb entry
    const data = yield (0, exports.createDBEntry)(enums_1.Tables.library, {
        id: articleId,
        slug: body.slug,
        sources: body.sources,
        timestamp: new Date().valueOf(),
        orgId: body.orgId ? body.orgId : '1',
        authorId: body.authorId ? body.authorId : 'a',
        version: body.version ? body.version : '1-00',
        sourceType: 'multi',
        progress: '0%',
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
    });
    const promptsAggregator = yield (0, sheetHelpers_1.getRawPrompts)(process.env.env === 'prod' ? enums_1.Sheets.aggregator_prompts : enums_1.Sheets.aggregator_prompts_dev);
    const stateMachineName = process.env.env === 'prod' ? 'article-state-machine-prod' : 'article-state-machine-dev';
    // pass input and dynamodb entry to digest step function
    yield (0, exports.startArticleStepFunctionExecution)(`arn:aws:states:${process.env.region}:${process.env.accountId}:stateMachine:${stateMachineName}`, {
        prompts: promptsAggregator,
        dynamodbData: { id: data.id, tableName: enums_1.Tables.library },
        instructions: instructions,
        settings: settings,
        sources: body.sources,
    });
    // return dynamodb id to user
    return (0, exports.createResponse)(200, JSON.stringify({ tableName: enums_1.Tables.library, DBId: articleId }));
});
exports.generateArticle = generateArticle;
const userSignup = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient();
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
    const command = new client_cognito_identity_provider_1.SignUpCommand(input);
    let response;
    try {
        response = yield client.send(command);
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
            yield (0, exports.createDBEntry)(enums_1.Tables.users, userData);
            return (0, exports.createResponse)(200, JSON.stringify({
                success: 'User sign up successful',
                userSub: response.UserSub,
            }));
        }
        else {
            return (0, exports.createResponse)(500, JSON.stringify({ failed: 'User sign up failed' }));
        }
    }
    catch (error) {
        console.log('🔴 error:', error);
        return (0, exports.createResponse)(500, JSON.stringify({ failed: 'User sign up failed' }));
    }
});
exports.userSignup = userSignup;
const createOrganization = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient();
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
    const command = new client_cognito_identity_provider_1.SignUpCommand(input);
    let response;
    try {
        response = yield client.send(command);
        if (response.$metadata.httpStatusCode === 200) {
            const orgId = (0, uuid_1.v4)();
            const userData = {
                id: response.UserSub,
                firstName: body.firstName,
                lastName: body.lastName,
                email: body.email,
                organizationId: orgId,
                role: 'admin',
                verificationStatus: 'pending',
            };
            yield (0, exports.createDBEntry)(enums_1.Tables.users, userData);
            const orgData = {
                id: orgId,
                name: body.orgName,
                admin: response.UserSub,
            };
            yield (0, exports.createDBEntry)(enums_1.Tables.organizations, orgData);
            return (0, exports.createResponse)(200, JSON.stringify({
                success: 'Organization creation successful',
                userSub: response.UserSub,
            }));
        }
        else {
            return (0, exports.createResponse)(500, JSON.stringify({ failed: 'Organization creation failed' }));
        }
    }
    catch (error) {
        console.log('🔴 error:', error);
        return (0, exports.createResponse)(500, JSON.stringify({ failed: 'Organization creation failed' }));
    }
});
exports.createOrganization = createOrganization;
const confirmUserSignUp = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient();
    const input = {
        ClientId: process.env.cognitoClientId,
        Username: body.email,
        ConfirmationCode: body.verificationCode,
    };
    const command = new client_cognito_identity_provider_1.ConfirmSignUpCommand(input);
    try {
        const response = yield client.send(command);
        if (response.$metadata.httpStatusCode === 200) {
            //update the user verification status
            yield (0, exports.updateDBEntry)(enums_1.Tables.users, { id: body.id }, { verificationStatus: 'confirmed' });
            return (0, exports.createResponse)(200, JSON.stringify({ success: 'User verified' }));
        }
        else {
            return (0, exports.createResponse)(500, JSON.stringify({ failed: 'Email confirmation failed' }));
        }
    }
    catch (error) {
        console.log('🔴 error:', error);
        return (0, exports.createResponse)(500, JSON.stringify({ failed: 'Email confirmation failed' }));
    }
});
exports.confirmUserSignUp = confirmUserSignUp;
const userSignIn = (body) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient();
    const input = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
            USERNAME: body.email,
            PASSWORD: body.password,
        },
        ClientId: process.env.cognitoClientId,
    };
    const command = new client_cognito_identity_provider_1.InitiateAuthCommand(input);
    let response;
    try {
        response = yield client.send(command);
        if (response.$metadata.httpStatusCode === 200) {
            const userInfo = yield (0, exports.getUserInfo)(body.email);
            return (0, exports.createResponse)(200, JSON.stringify({
                success: 'User sign in successful',
                userInfo: userInfo,
                token: (_a = response.AuthenticationResult) === null || _a === void 0 ? void 0 : _a.AccessToken,
            }));
        }
    }
    catch (error) {
        console.log('🔴 error:', error);
        if (error.message.includes('User is not confirmed')) {
            return (0, exports.createResponse)(500, JSON.stringify({ failed: 'User sign in failed', status: 404 }));
        }
        return (0, exports.createResponse)(500, JSON.stringify({ failed: 'User sign in failed' }));
    }
});
exports.userSignIn = userSignIn;
const userSignOut = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient();
    const input = {
        UserPoolId: process.env.cognitoUserPoolId,
        Username: body.email,
    };
    const command = new client_cognito_identity_provider_1.AdminUserGlobalSignOutCommand(input);
    try {
        const response = yield client.send(command);
        if (response.$metadata.httpStatusCode === 200) {
            return (0, exports.createResponse)(200, JSON.stringify({
                success: 'User sign out successful',
            }));
        }
    }
    catch (error) {
        console.log('🔴 error:', error);
        return (0, exports.createResponse)(500, JSON.stringify({ failed: 'User sign out failed' }));
    }
});
exports.userSignOut = userSignOut;
const forgetPassword = (body, queryStringParameters) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exports.createResponse)(200, JSON.stringify({ success: 'Forget Password' }));
});
exports.forgetPassword = forgetPassword;
const updateArticle = (body, queryStringParameters) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exports.createResponse)(200, JSON.stringify({ success: 'Article Modification successful' }));
});
exports.updateArticle = updateArticle;
const deleteArticle = (body, queryStringParameters) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exports.createResponse)(200, JSON.stringify({ success: 'Article Deletion successful' }));
});
exports.deleteArticle = deleteArticle;
const searchArticles = (body, queryStringParameters) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exports.createResponse)(200, JSON.stringify({ success: 'Article Search successful' }));
});
exports.searchArticles = searchArticles;
const getUserInfo = (body) => __awaiter(void 0, void 0, void 0, function* () {
    let params = {
        TableName: enums_1.Tables.users,
        IndexName: enums_1.TablesIndexes.userEmail,
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
            ':email': body.email,
        },
    };
    try {
        let user = yield dynamoDB.query(params).promise();
        return user;
    }
    catch (error) {
        console.error(error);
    }
});
exports.getUserInfo = getUserInfo;
// ANCHOR helper functions
function countWords(text) {
    return (0, lodash_words_1.default)(text).length;
}
exports.countWords = countWords;
const fetchOrgConnections = (orgId) => __awaiter(void 0, void 0, void 0, function* () {
    let params = {
        TableName: enums_1.Tables.connections,
        IndexName: enums_1.TablesIndexes.orgId,
        KeyConditionExpression: 'orgId = :orgId',
        ExpressionAttributeValues: {
            ':orgId': orgId,
        },
    };
    try {
        let connections = yield dynamoDB.query(params).promise();
        return connections;
    }
    catch (error) {
        console.error(error);
    }
});
exports.fetchOrgConnections = fetchOrgConnections;
const queryLibrary = (options) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    let params = Object.assign(Object.assign({ TableName: options.tableName, IndexName: enums_1.TablesIndexes.orgIdTimestamp, KeyConditionExpression: '#pk = :pkvalue', ExpressionAttributeNames: {
            '#pk': 'orgId',
        }, ExpressionAttributeValues: {
            ':pkvalue': options.orgId,
        }, Limit: options.limit, ScanIndexForward: false }, (options.sortKeyCondition && {
        KeyConditionExpression: options.sortKeyCondition,
    })), (options.offsetKey && { ExclusiveStartKey: options.offsetKey }));
    console.log('📎: Query params: ', params);
    try {
        const queryResults = [];
        let items = yield dynamoDB.query(params).promise();
        console.log('🤡: Query items: ', items);
        (_b = items.Items) === null || _b === void 0 ? void 0 : _b.forEach((item) => queryResults.push(item));
        console.log('➡: returned object: ', {
            items: queryResults,
            offsetKey: items.LastEvaluatedKey ? items.LastEvaluatedKey : null,
        });
        return {
            items: queryResults,
            offsetKey: items.LastEvaluatedKey ? items.LastEvaluatedKey : null,
        };
    }
    catch (error) {
        console.error('Error querying DB table: ', error);
        throw error;
    }
});
exports.queryLibrary = queryLibrary;
const listDBTable = (options) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    let params;
    if (!options.limit && !options.ownerId) {
        params = {
            TableName: options.tableName,
        };
    }
    else if (options.ownerId) {
        params = {
            TableName: options.tableName,
            IndexName: enums_1.TablesIndexes.ownerId,
            KeyConditionExpression: 'ownerId = :ownerId',
            ExpressionAttributeValues: {
                ':ownerId': options.ownerId,
            },
        };
    }
    else {
        params = Object.assign({ TableName: options.tableName, Limit: options.limit, ScanIndexForward: false, IndexName: enums_1.TablesIndexes.slugTimestamp }, (options.offsetKey && { ExclusiveStartKey: options.offsetKey }));
    }
    console.log('📎: params: ', params);
    try {
        const scanResults = [];
        let items = yield dynamoDB.scan(params).promise();
        console.log('🤡: items: ', items);
        (_c = items.Items) === null || _c === void 0 ? void 0 : _c.forEach((item) => scanResults.push(item));
        console.log('➡: returned object: ', {
            items: scanResults,
            offsetKey: items.LastEvaluatedKey ? items.LastEvaluatedKey : null,
        });
        return {
            items: scanResults,
            offsetKey: items.LastEvaluatedKey ? items.LastEvaluatedKey : null,
        };
    }
    catch (error) {
        console.error('Error listing DB table: ', error);
        throw error;
    }
});
exports.listDBTable = listDBTable;
const createDBEntry = (tableName, data) => __awaiter(void 0, void 0, void 0, function* () {
    // if (!data.id) return 'please add an id field to the data'
    const params = {
        TableName: tableName,
        Item: data,
    };
    try {
        yield dynamoDB.put(params).promise();
        if (data.id) {
            return { id: data.id }; // Returning the item id itself as DynamoDB put doesn't return the item
        }
    }
    catch (error) {
        console.error('Error creating DB entry: ', error);
        throw error;
    }
});
exports.createDBEntry = createDBEntry;
const isLongBaseSource = (source, threshold = 4000) => {
    if (source.length / 4 > threshold)
        return true;
    return false;
};
exports.isLongBaseSource = isLongBaseSource;
// Helper to create a standardized response
const createResponse = (statusCode, body) => {
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json',
        },
        body: body,
    };
};
exports.createResponse = createResponse;
const startDigestStepFunctionExecution = (stateMachineArn, inputData) => __awaiter(void 0, void 0, void 0, function* () {
    const params = {
        stateMachineArn: stateMachineArn,
        input: JSON.stringify(inputData),
    };
    try {
        yield stepFunctions.startExecution(params).promise();
    }
    catch (error) {
        console.error('Error starting Step Function execution: ', error);
        throw error;
    }
});
exports.startDigestStepFunctionExecution = startDigestStepFunctionExecution;
const startArticleStepFunctionExecution = (stateMachineArn, inputData) => __awaiter(void 0, void 0, void 0, function* () {
    const params = {
        stateMachineArn: stateMachineArn,
        input: JSON.stringify(inputData),
    };
    try {
        yield stepFunctions.startExecution(params).promise();
    }
    catch (error) {
        console.error('Error starting Step Function execution: ', error);
        throw error;
    }
});
exports.startArticleStepFunctionExecution = startArticleStepFunctionExecution;
// ANCHOR article generation functions
exports.articleGenerationLambdas = {
    createInitialSourcesArray: (input) => __awaiter(void 0, void 0, void 0, function* () {
        let response = Object.assign({}, input);
        if (input.source) {
            response = Object.assign(Object.assign({}, response), { initialSources: [
                    {
                        text: input.source.text,
                        accredit: input.source.accredit,
                        number: 1,
                        useVerbatim: input.source.useVerbatim,
                        isBaseSource: input.source.isBaseSource,
                    },
                ] });
        }
        else if (input.sources) {
            let initialSources = [];
            input.sources.forEach((source) => {
                initialSources.push({
                    text: source.text,
                    accredit: source.accredit,
                    number: source.number,
                    useVerbatim: source.useVerbatim,
                    isBaseSource: source.isBaseSource,
                });
            });
            response = Object.assign(Object.assign({}, response), { initialSources: initialSources });
        }
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, { progress: '5%' });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return response;
    }),
    summarizeDigest: (input) => __awaiter(void 0, void 0, void 0, function* () {
        let summary = '';
        if (input.source.text.length > 4000) {
            summary = yield (0, gptHelpers_1.summarizeSource)({
                source: input.source.text,
                instructions: input.instructions.instructions,
            });
        }
        else {
            summary = input.source.text;
        }
        const response = Object.assign(Object.assign({}, input), { source: Object.assign(Object.assign({}, input.source), { text: summary }) });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, { progress: '15%' });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return response;
    }),
    summarizeAggregator: (input) => __awaiter(void 0, void 0, void 0, function* () {
        const summarizedSources = [];
        for (let index = 0; index < input.sources.length; index++) {
            if (input.sources[index].text.length > 4000) {
                const source = input.sources[index];
                const summary = yield (0, gptHelpers_1.summarizeSource)({
                    source: source.text,
                    instructions: input.instructions.instructions,
                });
                summarizedSources.push(summary);
            }
            else {
                summarizedSources.push(input.sources[index].text);
            }
        }
        const response = Object.assign(Object.assign({}, input), { sources: summarizedSources.map((summedSource, index) => (Object.assign(Object.assign({}, input.sources[index]), { text: summedSource }))) });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, { progress: '15%' });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return response;
    }),
    factsBitsDigest: (input) => __awaiter(void 0, void 0, void 0, function* () {
        const factsBits = yield (0, gptHelpers_1.factsBitSplitting)({
            source: input.source,
            prompt: input.prompts.factsBitSplitting,
            instructions: input.instructions,
            settings: input.settings,
            initialSources: input.initialSources,
        });
        const response = Object.assign(Object.assign({}, input), { source: Object.assign(Object.assign({}, input.source), { text: factsBits.result }), stepOutputs: {
                factsBitSplitting: {
                    text: factsBits.result,
                    words: countWords(factsBits.result),
                    characters: factsBits.result.length,
                },
            }, parsedPrompts: factsBits.parsedPrompts });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, { progress: '15%' });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return response;
    }),
    factsBitsAggregator: (input) => __awaiter(void 0, void 0, void 0, function* () {
        const factBits = [];
        const parsedPrompts = [];
        for (let index = 0; index < input.sources.length; index++) {
            const source = input.sources[index];
            const bits = yield (0, gptHelpers_1.factBitsAggregator)({
                source: source,
                prompt: input.prompts.factsBitSplitting,
                settings: Object.assign(Object.assign({}, input.settings), { noOfBlobs: input.settings.blobs }),
                instructions: input.instructions,
            });
            factBits.push(bits.result);
            parsedPrompts.push(bits.parsedPrompts);
        }
        const response = Object.assign(Object.assign({}, input), { sources: factBits.map((factBit, index) => (Object.assign(Object.assign({}, input.sources[index]), { text: factBit }))), stepOutputs: Object.assign(Object.assign({}, input.stepOutputs), { factsBitSplitting: factBits.map((factBit, index) => ({
                    text: factBit,
                    words: countWords(factBit),
                    characters: factBit.length,
                })) }), parsedPrompts: parsedPrompts });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, { progress: '15%' });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return response;
    }),
    cleanUpFactsAggregator: (input) => __awaiter(void 0, void 0, void 0, function* () {
        let response = null;
        let allFacts = ``;
        const sources = input.sources;
        sources.forEach((source) => {
            allFacts = `${allFacts}

          ${source.number}
          ${source.accredit}
          ${source.text}

          `;
        });
        const paraphrasedFacts = yield (0, gptHelpers_1.paraphrasingFacts)({
            //REVIEW - What number be here? for now using placeholder value
            source: { text: allFacts, accredit: input.sources[0].accredit, number: 1 },
            prompt: input.prompts.paraphrasingFacts,
            instructions: input.instructions,
            settings: input.settings,
            stepOutputs: input.stepOutputs,
            initialSources: input.initialSources,
        });
        response = Object.assign(Object.assign({}, input), { source: {
                text: paraphrasedFacts.result,
                accredit: input.sources[0].accredit,
                number: 1,
            }, stepOutputs: Object.assign(Object.assign({}, input.stepOutputs), { paraphrasingFacts: {
                    text: paraphrasedFacts.result,
                    words: countWords(paraphrasedFacts.result),
                    characters: paraphrasedFacts.result.length,
                } }), parsedPrompts: paraphrasedFacts.parsedPrompts });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, { progress: '30%' });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return response;
    }),
    cleanUpFactsDigest: (input) => __awaiter(void 0, void 0, void 0, function* () {
        const paraphrasedFacts = yield (0, gptHelpers_1.paraphrasingFacts)({
            source: input.source,
            prompt: input.prompts.paraphrasingFacts,
            instructions: input.instructions,
            settings: input.settings,
            stepOutputs: input.stepOutputs,
            initialSources: input.initialSources,
        });
        const response = Object.assign(Object.assign({}, input), { source: Object.assign(Object.assign({}, input.source), { text: paraphrasedFacts.result }), stepOutputs: Object.assign(Object.assign({}, input.stepOutputs), { paraphrasingFacts: {
                    text: paraphrasedFacts.result,
                    words: countWords(paraphrasedFacts.result),
                    characters: paraphrasedFacts.result.length,
                } }), parsedPrompts: paraphrasedFacts.parsedPrompts });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, { progress: '30%' });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return response;
    }),
    articlePreparationOne: (input) => __awaiter(void 0, void 0, void 0, function* () {
        const articlePrepOneOutput = yield (0, gptHelpers_1.articlePrepOne)({
            source: input.source,
            instructions: input.instructions,
            settings: input.settings,
            prompt: input.prompts.articlePreparationOne,
            stepOutputs: input.stepOutputs,
            initialSources: input.initialSources,
        });
        const response = Object.assign(Object.assign({}, input), { source: Object.assign(Object.assign({}, input.source), { text: JSON.stringify(articlePrepOneOutput.result) }), stepOutputs: Object.assign(Object.assign({}, input.stepOutputs), { articlePreparationOne: {
                    text: articlePrepOneOutput.result,
                    words: countWords(articlePrepOneOutput.result),
                    characters: articlePrepOneOutput.result.length,
                } }), parsedPrompts: articlePrepOneOutput.parsedPrompts });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, { progress: '40%' });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return response;
    }),
    headlinesBlobs: (input) => __awaiter(void 0, void 0, void 0, function* () {
        const headlinesBlobs = yield (0, gptHelpers_1.headlinesAndBlobs)({
            source: input.source,
            instructions: input.instructions,
            settings: input.settings,
            prompt: input.prompts.headlinesAndBlobs,
            stepOutputs: input.stepOutputs,
            initialSources: input.initialSources,
        });
        const response = Object.assign(Object.assign({}, input), { source: Object.assign(Object.assign({}, input.source), { text: JSON.stringify(headlinesBlobs.result) }), stepOutputs: Object.assign(Object.assign({}, input.stepOutputs), { headlinesAndBlobs: {
                    text: headlinesBlobs.result,
                    words: countWords(headlinesBlobs.result),
                    characters: headlinesBlobs.result.length,
                } }), parsedPrompts: headlinesBlobs.parsedPrompts });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, { progress: '45%' });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return response;
    }),
    articlePreparationTwo: (input) => __awaiter(void 0, void 0, void 0, function* () {
        const articlePrepTwoOutput = yield (0, gptHelpers_1.articlePrepTwo)({
            source: input.source,
            instructions: input.instructions,
            settings: input.settings,
            prompt: input.prompts.articlePreparationTwo,
            stepOutputs: input.stepOutputs,
            initialSources: input.initialSources,
        });
        const response = Object.assign(Object.assign({}, input), { source: Object.assign(Object.assign({}, input.source), { text: JSON.stringify(articlePrepTwoOutput.result) }), stepOutputs: Object.assign(Object.assign({}, input.stepOutputs), { articlePreparationTwo: {
                    text: articlePrepTwoOutput.result,
                    words: countWords(articlePrepTwoOutput.result),
                    characters: articlePrepTwoOutput.result.length,
                } }), parsedPrompts: articlePrepTwoOutput.parsedPrompts });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, { progress: '50%' });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return response;
    }),
    quotePicking: (input) => __awaiter(void 0, void 0, void 0, function* () {
        const quotesList = yield (0, gptHelpers_1.quotesPicking)({
            source: input.source,
            instructions: input.instructions,
            settings: input.settings,
            prompt: input.prompts.quotesPicking,
            stepOutputs: input.stepOutputs,
            initialSources: input.initialSources,
        });
        const response = Object.assign(Object.assign({}, input), { source: Object.assign(Object.assign({}, input.source), { text: JSON.stringify(quotesList.result) }), stepOutputs: Object.assign(Object.assign({}, input.stepOutputs), { quotesPicking: {
                    text: quotesList.result,
                    words: countWords(quotesList.result),
                    characters: quotesList.result.length,
                } }), parsedPrompts: quotesList.parsedPrompts });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, { progress: '56%' });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return response;
    }),
    articleWriting: (input) => __awaiter(void 0, void 0, void 0, function* () {
        const article = yield (0, gptHelpers_1.writing)({
            source: input.source,
            instructions: input.instructions,
            settings: input.settings,
            prompt: input.prompts.writing,
            stepOutputs: input.stepOutputs,
            initialSources: input.initialSources,
        });
        const response = Object.assign(Object.assign({}, input), { source: Object.assign(Object.assign({}, input.source), { text: article.result }), stepOutputs: Object.assign(Object.assign({}, input.stepOutputs), { writing: { text: article.result, words: countWords(article.result), characters: article.result.length } }) });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, { progress: '60%' });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return response;
    }),
    rewritingArticle: (input) => __awaiter(void 0, void 0, void 0, function* () {
        const rewrittenArticle = yield (0, gptHelpers_1.rewriting)({
            source: input.source,
            settings: input.settings,
            instructions: input.instructions,
            prompt: input.prompts.rewriting,
            stepOutputs: input.stepOutputs,
            initialSources: input.initialSources,
        });
        const response = Object.assign(Object.assign({}, input), { source: Object.assign(Object.assign({}, input.source), { text: rewrittenArticle.result }), stepOutputs: Object.assign(Object.assign({}, input.stepOutputs), { rewriting: {
                    text: rewrittenArticle.result,
                    words: countWords(rewrittenArticle.result),
                    characters: rewrittenArticle.result.length,
                } }), parsedPrompts: rewrittenArticle.parsedPrompts });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, { progress: '80%' });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return response;
    }),
    digestArticleAttribution: (input) => __awaiter(void 0, void 0, void 0, function* () {
        var _d, _e;
        const attributedDigest = yield (0, gptHelpers_1.digestAttribution)({
            source: input.source,
            instructions: input.instructions,
            settings: input.settings,
            prompt: input.prompts.attribution,
            stepOutputs: input.stepOutputs,
            initialSources: input.initialSources,
        });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, {
            progress: '100%',
            digest: attributedDigest,
            headlinesAndBlobs: (_d = input.stepOutputs) === null || _d === void 0 ? void 0 : _d.headlinesAndBlobs,
        });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return {
            result: attributedDigest.result,
            headlinesAndBlobs: (_e = input.stepOutputs) === null || _e === void 0 ? void 0 : _e.headlinesAndBlobs,
            parsedPrompts: attributedDigest.parsedPrompts,
        };
    }),
    aggregatorArticleAttribution: (input) => __awaiter(void 0, void 0, void 0, function* () {
        var _f, _g;
        const attributedArticle = yield (0, gptHelpers_1.aggregatorAttribution)({
            source: input.source,
            instructions: input.instructions,
            settings: input.settings,
            prompt: input.prompts.attribution,
            stepOutputs: input.stepOutputs,
            initialSources: input.initialSources,
        });
        yield (0, exports.updateDBEntry)(input.dynamodbData.tableName, { id: input.dynamodbData.id }, {
            progress: '100%',
            digest: attributedArticle,
            headlinesAndBlobs: (_f = input.stepOutputs) === null || _f === void 0 ? void 0 : _f.headlinesAndBlobs,
        });
        yield (0, exports.pingOrgMembers)('1', input.dynamodbData.id); // ask online org members to refetch
        return {
            result: attributedArticle.result,
            headlinesAndBlobs: (_g = input.stepOutputs) === null || _g === void 0 ? void 0 : _g.headlinesAndBlobs,
            parsedPrompts: attributedArticle.parsedPrompts,
        };
    }),
};
//ANCHOR - Websocket functions
const connectHandler = (event) => __awaiter(void 0, void 0, void 0, function* () {
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
    yield (0, exports.createDBEntry)(enums_1.Tables.connections, data);
    return { statusCode: 200, body: 'Connected.' };
});
exports.connectHandler = connectHandler;
const disconnectHandler = (event) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔴🔴', event);
    const connectionId = event.requestContext.connectionId;
    // Delete connectionId from dynamodb
    try {
        yield (0, exports.deleteDBEntry)(enums_1.Tables.connections, { connectionId: connectionId });
    }
    catch (e) {
        console.log('🔴🔴', e);
    }
    return { statusCode: 200, body: 'Disconnected.' };
});
exports.disconnectHandler = disconnectHandler;
const sendMessageHandler = () => __awaiter(void 0, void 0, void 0, function* () { });
exports.sendMessageHandler = sendMessageHandler;
const pingOrgMembers = (orgId = '1', articleId) => __awaiter(void 0, void 0, void 0, function* () {
    // '1' is a hard coded orgId
    // get all the org's websocket connections
    const connections = yield (0, exports.fetchOrgConnections)(orgId);
    if (connections && connections.Items) {
        for (let i = 0; i < connections.Items.length; i++) {
            const connection = connections.Items[i];
            try {
                // Send message to recipient
                const client = new client_apigatewaymanagementapi_1.ApiGatewayManagementApiClient({
                    endpoint: process.env.env === 'prod'
                        ? 'https://vcqo4iw7bl.execute-api.eu-north-1.amazonaws.com/prod' //perhaps these should be in the env variables
                        : 'https://fn92v53qee.execute-api.eu-north-1.amazonaws.com/dev',
                });
                const input = {
                    Data: JSON.stringify({ articleId }),
                    ConnectionId: connection.connectionId,
                };
                const command = new client_apigatewaymanagementapi_1.PostToConnectionCommand(input);
                yield client.send(command);
            }
            catch (e) {
                console.log('🔴 failed to ping connection: ', connection.connectionId);
            }
        }
    }
});
exports.pingOrgMembers = pingOrgMembers;
