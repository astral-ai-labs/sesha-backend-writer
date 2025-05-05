# sesha-backend

## Getting Started

For new accounts, refer to `GitHub Identity Provider via OpenID Connect`

For existing stacks, refer to `Pulumi Login`

For new stacks, refer to `Create Pulumi State Storage S3 Bucket`

### backend structure

This project is a serverless backend application that uses AWS services and is managed using Pulumi. The project structure is as follows:

- `.github/workflows`: Contains GitHub workflows for CI/CD.

- `infrastructure/`: Contains the Pulumi scripts that define the infrastructure of the application. The main entry point is `infrastructure/index.ts`, which sets up various resources like VPC, Auth, API, Websocket, Step Functions, DynamoDB, and OpenSearch.

- `lambdas/`: Contains the source code for AWS Lambda functions. Each subdirectory represents a separate Lambda function. The main handler function is in `/lambdas/lambda-handler/index.ts`.

The backend infrastructure is composed of several AWS services:

- **AWS Lambda**: The application logic is implemented in several Lambda functions. The code for these functions is packaged into archives using the `getLambdaCodeArchive` function and similar functions in `infrastructure/utils/pulumi-utils.ts`.

- **Amazon DynamoDB**: The application's data is stored in DynamoDB tables. These tables are set up in the `setupDynamoDbResources` function.

- **Amazon OpenSearch Service**: The application uses OpenSearch for full-text search capabilities.

- **Amazon API Gateway**: The application's HTTP API and its Websocket API is built with API Gateway.

- **Amazon Cognito**: The application uses Cognito for user authentication.

- **AWS Step Functions**: The application uses Step Functions to orchestrate Lambda functions for article generation.

- **Amazon VPC**: The application runs in a VPC set up in the `setupVpcResources` function.

The infrastructure is defined and managed using Pulumi. The Pulumi scripts are written in TypeScript and are located in the `infrastructure/` directory. The main entry point is `infrastructure/index.ts`.

### Development

Our main handler function is in `/lambdas/lambda-handler/index.ts`

After making any changes to the code, you will need to push on the `dev` or `prod` branch for it to be deployed and be available for testing.
Some parts of the code you can run locally but since the infrastructure is built via lambdas, you will eventally need to deploy the changes to see them in action.

## AWS Account Summary

- Management Account : ``
- Sesha Backend Production Account : ``
- Sesha Backend Development Account : ``

## Create AWS SSO Login

This can be useful if you need to run aws cli commands directly on resources. In general, it is recommended to make changes via Pulumi stack configurations where possible.

- Start the configuration : `aws configure sso`
- Session Name : `sesha-backend-dev` or `sesha-backend-prod`
- Start URL : ``
- Enter SSO region : `eu-north-1`
- Registration Scopes leave as default
- Leave default value for `SSO registration scopes`
- In the browser window that pops up, click `Confirm and continue` and then `Allow` and close the window
- Select the associated account that this SSO profile should use if there are multiple (eg, `sesha-backend-dev` or `sesha-backend-prod`)
- CLI default client Region : `eu-north-1`
- CLI default output format leave as `None`
- CLI profile name : `sesha-backend-dev` or `sesha-backend-prod`
- To confirm the profile exists, check the `config` text file in `/Users/[username]/.aws/config`
- To test the login, run `aws sso login --profile sesha-backend-[dev or prod]` and follow the process. A message will appear `Successfully logged into Start URL: `

## Pulumi Login

Follow these steps after completing `AWS SSO Login` setup.

- Login to AWS Start URL : ``
- Click on the respective account (`sesha-backend-[dev or prod]`)
- Click the button link `Command line or programmatic access`
- In the area `Option 1: Set AWS environment variables (Short-term credentials)`, click on `Click to copy these commands` as you hover over the credentials
- In the terminal window being used for pulumi login, paste the output. This should include : `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_SESSION_TOKEN`.
- Additionally, set the AWS Region : `export AWS_REGION=eu-north-1` - this is required so that Pulumi does not login to the default `us-east-1` region.
- Login to Pulumi : `pulumi login --cloud-url s3://sesha-backend-pulumi-[dev or prod]`
- Message should appear : `Logged in to **** as **** (s3://sesha-backend-pulumi-[dev or prod])`

## GitHub Identity Provider via OpenID Connect

- Login to the `TARGET` AWS account where Pulumi resources should be created
- Navigate to 
- Under `Configure provider`, select `OpenID Connect`
- For Provider URL, enter `https://token.actions.githubusercontent.com`
- Click `Get thumbprint`
- For Audience, enter `sts.amazonaws.com`
- Click `Add provider`
- Navigate into the newly created Identiy Provider
- Click `Assign role`

### For a NEW Role

- Select `Create a new role`
- Click `Next`
- Under `Trusted entity type`, select `Web identity`
- Confirm `Identity provider` is `token.actions.githubusercontent.com`
- Under `Audience`, select `sts.amazonaws.com`
- Under `GitHub Organization`, enter `SeshaMC`
- Under `GitHub Repository`, enter the repository name : `sesha-backend` or `sesha-frontend` for example
- Leave `GitHub branch` blank
- Click `Next`
- For permissions, select `AdministratorAccess` - this will grant the role permissions to manage all AWS resources
- Click `Next`
- For `Role name`, enter `github-actions`
- Click `Create role`
- Navigate into the newly-created role
- Copy the `ARN` of the role
- Use this `ARN` in the associated GitHub Actions step `aws-actions/configure-aws-credentials@v4` in the `role-to-assume` field. This tells pulumi which AWS account to deploy to.

### For an EXISTING Role

If this is not the first repository associated with the account, the `github-actions` role should already exist. In this case, the existing role can be edited to simply include the new repositoy(ies).

- Navigate to `IAM`
- Find the `github-actions` role
- Navigate to the `Trust relationships` tab
- Click `Edit trust policy`
- Add a new item to the `Statement` array using this template :

```json
{
  "Effect": "Allow",
  "Principal": {
    "Federated": "arn:aws:iam::[AWS ACCOUNT ID]:oidc-provider/token.actions.githubusercontent.com"
  },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
    },
    "StringLike": {
      "token.actions.githubusercontent.com:sub": "repo:[Organization]/[Repository]:*"
    }
  }
}
```

- ignore warnings about `Specific Github Repo And Branch Recommended`
- click `Update Policy`
- confirm that the new statement exists

## Create Pulumi State Storage S3 Bucket

### Create S3 Bucket

- Navigate to `S3`
- Click `Create bucket`
- Select the region `eu-north-1`
- Select `General purpose` for `Bucket type`
- For `Bucket name`, create a unique name with the org name, app name and environment for context. For example `sesha-backend-pulumi-prod`
- Keep default selection for `ACLs disabled`
- Keep the checkbox selected for `Block all public access`
- Click `Enable` next to `Bucket Versioning`
- Select `Server-side encryption with Amazon S3 managed keys (SSE-S3)` for encryption
- Click `Create bucket`
- Verify the new bucket exists

### Create Pulumi Starting Point Folder structure

- Navigate into the newly-created bucket
- Click `Create folder`
- Enter the text `.pulumi`
- Click `Create folder`
- Navigate into the folder `.pulumi`
- Click `Create folder`
- Enter the text `stacks`
- Click `Create folder`
- Navigate into the folder `stacks`
- Click `Create folder`
- Enter the text `sesha-pulumi`
- Click `Create folder`

### Create Pulumi Starting Point File Content

#### Meta File

- Create a local file with the name `meta.yaml`
- For the file content, enter `version: 1` on the first line
- Save the file locally
- Navigate to the folder `.pulumi` in the new bucket
- Click `Upload`
- Click `Add files`
- Select the `meta.yaml` file
- Click `Upload`
- Wait for upload to complete
- Click `Close`
- Verify the stack starting point `meta.yaml` file exists in the `.pulumi` folder

#### Stack Config Creation

Follow the steps in `Pulumi Login` to prepare local environment

- Initialize the stack `pulumi stack init`
- Enter the unique name for the stacks (eg, `sesha-backend-prod`)
- If the stack name is available, the message will show `Created stack 'sesha-backend-prod'`
- Create a unique passphrase to used to encrypt the secure values stored in the config file
- Re-enter the passphrase
- Confirm there is a new stack configuration file locally (eg, `config/Pulumi.sesha-backend-prod.yaml`)
- Confirm there is a new stack json file remotely (eg, ``)

#### Add Values to Pulumi Configuration

For values that can be stored in plain text : `pulumi config set keyName keyValue`

For values that should be stored in encrypted text : `pulumi config set --secret keyName`. You will be asked to provide the key that was used during `Stack Config Creation`.

After adding configuration values, confirm that they are updated locally in the stack `yaml`. (eg, `Pulumi.sesha-backend-prod`).

## Canceling Pulumi Commands

There are some scenarios where Pulumi commands get stuck or fail and need to manually canceled. An example error message will show something like this :

```bash
ConcurrentUpdateError: code: -2
    stdout:
    stderr: Command failed with exit code 255: pulumi refresh --yes --skip-preview --exec-agent pulumi/actions@v3 --color auto --exec-kind auto.local --stack sesha-backend-dev --non-interactive
error: the stack is currently locked by 1 lock(s). Either wait for the other process(es) to end or delete the lock file with `pulumi cancel`.
```

- Follow steps for `pulumi login --cloud-url`
- Select the correct stack : `pulumi stack select`
- Run `pulumi cancel`
- Type in the stack name to confirm the cancel of the correct
- Re-run the job

## Backup and Restore DynamoDB Tables

### Create Backup of Existing Table

- Navigate to the table
- Ensure `Point-in-time recovery (PITR)` is enabled
- Navigate to `S3 Export` page : ``
- Click `Export to S3`
- Select a table
- Enter the bucket ARN
- Select `Full export`
- Select `Current time`
- Select `DynamoDB JSON`
- Select `Amazon S3 key`
- Click `Export`
- Wait until the Export status is `Completed`

### Share Bucket Cross Account Within Same Organization

- Add an S3 bucket policy to the bucket which should be shared

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowGetObject",
      "Principal": {
        "AWS": "*"
      },
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::dynmodb-backup/*",
      "Condition": {
        "StringEquals": {
          "aws:PrincipalOrgID": ["o-dl58u1upvq"]
        }
      }
    }
  ]
}
```

### Import S3 Data to New DynamoDB Table

- Navigate to `Imports from S3`
- Click `Import from S3`
- Enter the S3 source from the source account
- Select `A different AWS account`
- Enter the source acount number
- Select `GZIP` compression
- Select `DynamoDB JSON`
- Click next
- Enter the table name
- Enter the partion key and optional sort key
- Change to `Manual configuration`
- Change to `Customize settings`
- Modify capacity mode as needed
- Recreate the secondary indexes
- Click `Next`
- Monitor the progress. From experience, a failed job does not mean that the data was not correctly imported.
- Manually verify the data imported

## Add Chromium Executable to S3 Bucket for Puppeteer + Proxy Browser

In order to keep the Lambda build below the maximum size (about 70mb), the required Chromium executable should be stored in an S3 Bucket and then the layer can be created via the pulumi resource `lambda-layer-chromium-v121-0-0-[dev or prod]`.

- Download the most recent version of Chromium (https://github.com/Sparticuz/chromium/releases) from this link (at the time of writing v121.0.0) : https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-layer.zip
- Login to the AWS Console for the respective target account (eg, dev or prod)
- Create an S3 Bucket (if it doesn't exist) in the respective environment : `sesha-backend-chromium-browser-[dev or prod]`
- Create a folder specifically for the downloaded version : `v121.0.0`
- Upload the output `*.zip` file to the S3 Bucket folder
- The lambda layer will be created in the resource `lambda-layer-chromium-v121.0.0-[dev or prod]`

## Steps for creating new lambdas

1. Create a folder in the `lambdas` folder
2. run `npm init -y`
3. run `npm install typescript`
4. create a `tsconfig.json` file. You can copy the config from other lambdas
5. create an `index.ts` file. Export your lambda handler from here
6. go to the `infrastructure/utils/pulumi-utils.ts` file
7. export a function that returns your lambda code archive. Look at other existing functions for example
8. go to the `infrasturcture/resources` folder
9. create a pulumi resource for your lambda. You can use an existing file if the lambda shares context with that file
10. push the code, after the github workflow is complete, your lambda will be created
