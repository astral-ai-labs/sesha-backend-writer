// Import AWS SDK and fetch
import pkg from 'aws-sdk';
const { config, DynamoDB } = pkg;
import fetch from 'node-fetch'; // or you can use import fetch from 'node-fetch' if you're using ES modules

// Configure AWS DynamoDB
config.update({
  region: 'eu-north-1', // Example: 'eu-west-1'
  // other configuration if needed
});

const docClient = new DynamoDB.DocumentClient();

async function scanForIsoStrings(lastEvaluatedKey) {
  const params = {
    TableName: 'article-analytics-dev',
    FilterExpression: 'attribute_type(timeOfCreation, :type)',
    ExpressionAttributeValues: {
      ':type': 'S',
    },
    ExclusiveStartKey: lastEvaluatedKey,
  };

  try {
    const data = await docClient.scan(params).promise();
    return data;
  } catch (err) {
    console.error('Unable to scan. Error:', JSON.stringify(err, null, 2));
    throw err;
  }
}

const updateItem = async (item) => {
  const unixTimestamp = new Date(item.timeOfCreation).getTime();

  const params = {
    TableName: 'article-analytics-dev',
    Key: {
      id: item.id, // replace with your actual primary key attribute
    },
    UpdateExpression: 'set timeOfCreation = :timestamp',
    ExpressionAttributeValues: {
      ':timestamp': unixTimestamp,
    },
  };

  try {
    await docClient.update(params).promise();
    console.log(`Updated item with PrimaryKey: ${item.id}`);
  } catch (err) {
    console.error('Unable to update item. Error:', JSON.stringify(err, null, 2));
    throw err;
  }
};

async function updateItems() {
  let lastEvaluatedKey = null;
  do {
    const { Items, LastEvaluatedKey } = await scanForIsoStrings(lastEvaluatedKey);
    for (const item of Items) {
      await updateItem(item);
    }
    lastEvaluatedKey = LastEvaluatedKey;
  } while (lastEvaluatedKey);
}

updateItems()
  .then(() => console.log('All items updated'))
  .catch((err) => console.error(err));
