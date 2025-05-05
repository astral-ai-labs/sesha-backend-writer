# DynamoDB Copy

This script will take data from one table and copy to another if the data does not yet exist.

Create a copy of `.env-example` to `.env` and add the associated account keys.

To create keys, navigate to `IAM` and create a new user (https://us-east-1.console.aws.amazon.com/iam/home?region=eu-north-1#/users). Add the policy `AmazonDynamoDBFullAccess` to the user. Then, navigate into the user and `Create access key` with `Command Line Interface (CLI)` access. 

**Once the migration is done, it is best practice to remove the IAM users and access keys**

**Account 1** is the `SOURCE` account

**Account 2** is the `DESTINATION` account

The associated `PARTION_KEY` values will be compared. Any document that has partition key value that exists in Account 1 but NOT in Account 2 will be created in Account 2.

When the env value `COPY_MODE_PREVIEW` is set to `true`, only a dry run preview step will run. A comparison will be made a summary displayed but the actual copy from Account 1 to Account 2 will not occur. When `COPY_MODE_PREVIEW` is set to `false`, the copy will actually occur for missing documents in Account 2 from Account 1.

Once the migration is completed, running the script again (with COPY_MODE_PREVIEW=true) should show a message indicating that there are no documents to migrate. This will indicate a successful run. If there are new documents created in Account 1, then there may still be remaining documents to migrate in a second round.
