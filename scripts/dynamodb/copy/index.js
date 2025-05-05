import pkg from '@aws-sdk/client-dynamodb';
const { DynamoDBClient, ScanCommand, GetCommand, GetCommandOutput, PutItemCommand } = pkg;
import 'dotenv/config'

console.log(`Account 1 (Source) Config :`)
console.log(`... Region : ${process.env.AWS_ACCOUNT_1_REGION}`)
console.log(`... Access Key Id : ${process.env.AWS_ACCOUNT_1_ACCESS_KEY_ID}`)
console.log(`... Table : ${process.env.AWS_ACCOUNT_1_TABLE_NAME}`)
console.log(`... Partition Key : ${process.env.AWS_ACCOUNT_1_PARTION_KEY}`)
console.log(``)
console.log(`Account 2 (Destination) Config :`)
console.log(`... Region : ${process.env.AWS_ACCOUNT_2_REGION}`)
console.log(`... Access Key Id : ${process.env.AWS_ACCOUNT_2_ACCESS_KEY_ID}`)
console.log(`... Table : ${process.env.AWS_ACCOUNT_2_TABLE_NAME}`)
console.log(`... Partition Key : ${process.env.AWS_ACCOUNT_2_PARTION_KEY}`)

// Set up AWS DynamoDB Clients
const dynamoDBClientAccount1 = new DynamoDBClient({
  region: process.env.AWS_ACCOUNT_1_REGION,
  credentials:{
    accessKeyId: process.env.AWS_ACCOUNT_1_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_ACCOUNT_1_SECRET_ACCESS_KEY
  }
});

const dynamoDBClientAccount2 = new DynamoDBClient({
  region: process.env.AWS_ACCOUNT_2_REGION,
  credentials:{
    accessKeyId: process.env.AWS_ACCOUNT_2_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_ACCOUNT_2_SECRET_ACCESS_KEY
  }
});

// Define the DynamoDB table name
const tableName_1 = process.env.AWS_ACCOUNT_1_TABLE_NAME;
const tableName_2 = process.env.AWS_ACCOUNT_2_TABLE_NAME;

// partion keys
const tablePartitionKey_1 = process.env.AWS_ACCOUNT_1_PARTION_KEY
const tablePartitionKey_2 = process.env.AWS_ACCOUNT_2_PARTION_KEY

async function copyMissingItemsFromAccount1ToAccount2() {
  try {

    let scanOutput_1 = []
    let scanOutput_2 = []
    let scanExclusiveStartKey_1 = undefined
    let scanExclusiveStartKey_2 = undefined

    let blContinueScan1 = true
    let blContinueScan2 = true
    while (blContinueScan1) {
      if (scanOutput_1.length) console.log("running scan1 again...")
      const scanCommand_1 = new ScanCommand({
        TableName: tableName_1,
        ...(scanExclusiveStartKey_1 ? { ExclusiveStartKey : scanExclusiveStartKey_1} : null)
      });
      const currentScan1 = await dynamoDBClientAccount1.send(scanCommand_1);
      const {Items,LastEvaluatedKey} = currentScan1
      if (Items) scanOutput_1 = [...scanOutput_1,...Items]
      console.log(Items.length, ' item(s) found')
      if (LastEvaluatedKey) scanExclusiveStartKey_1 = LastEvaluatedKey
      if (!LastEvaluatedKey) blContinueScan1 = false
    }
    while (blContinueScan2) {
      if (scanOutput_2.length) console.log("running scan2 again...")
      const scanCommand_2 = new ScanCommand({
        TableName: tableName_2,
        ...(scanExclusiveStartKey_2 ? { ExclusiveStartKey : scanExclusiveStartKey_2} : null)
      });
      const currentScan2 = await dynamoDBClientAccount2.send(scanCommand_2);
      const {Items,LastEvaluatedKey} = currentScan2
      if (Items) scanOutput_2 = [...scanOutput_2,...Items]
      console.log(Items.length, ' item(s) found')
      if (LastEvaluatedKey) scanExclusiveStartKey_2 = LastEvaluatedKey
      if (!LastEvaluatedKey) blContinueScan2 = false
    }
    
    console.log(`${scanOutput_1.length} Items Found from Account 1 Table ${tableName_1}`);
    console.log(`${scanOutput_2.length} Items Found from Account 2 Table ${tableName_2}`);

    const uniqueIds_1 = scanOutput_1.map((item) => JSON.stringify(item[tablePartitionKey_1]))
    const uniqueIds_2 = scanOutput_2.map((item) => JSON.stringify(item[tablePartitionKey_2]))

    const uniqueIdsIn1NotFoundIn2 = uniqueIds_1.filter((item) => uniqueIds_2.indexOf(item) === -1)

    console.log(`${uniqueIdsIn1NotFoundIn2.length} item(s) found in [Account 1].${tablePartitionKey_1} that were not found in [Account 2].${tablePartitionKey_2}`)

    const itemsToAdd = scanOutput_1.filter((item) => {
      const currentComparePartitionKey = JSON.stringify(item[tablePartitionKey_1])
      return uniqueIdsIn1NotFoundIn2.indexOf(currentComparePartitionKey) > -1
    })

    const timeoutMS = process.env.COPY_MODE_PREVIEW === "true" ? 10 : 1000

    itemsToAdd.forEach((item,index) => {
      setTimeout(async () => {
        console.log(`Adding Item ${index + 1} of ${itemsToAdd.length} to Account 2 Table ${tableName_2}`)
        if (process.env.COPY_MODE_PREVIEW === "true") console.log("Preview insert item :", JSON.stringify(item))
        if (process.env.COPY_MODE_PREVIEW === "false") {
          console.log(`Item :`, JSON.stringify(item))
          const putItemCommand = new PutItemCommand({
            TableName: tableName_2,
            Item: item,
          });
          await dynamoDBClientAccount2.send(putItemCommand);
          console.log('Item inserted successfully.');
        }
      },(index + 1) * timeoutMS)
    })
  } catch (error) {
    console.error('unknown error', error);
  }
}

// Invoke the functions to read from DynamoDB
copyMissingItemsFromAccount1ToAccount2();
