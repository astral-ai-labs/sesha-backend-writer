// Import AWS SDK and fetch
import pkg from 'aws-sdk';
const { config, DynamoDB } = pkg;
import fetch from 'node-fetch'; // or you can use import fetch from 'node-fetch' if you're using ES modules

// Configure AWS DynamoDB
config.update({
  region: 'eu-north-1', // Example: 'eu-west-1'
  // other configuration if needed
});

const env = 'dev'; // or prod
const docClient = new DynamoDB.DocumentClient();

async function getAllUsers() {
  const params = {
    TableName: `users-${env}`,
  };

  try {
    const data = await docClient.scan(params).promise();
    return data.Items;
  } catch (err) {
    console.error(`Unable to scan users-${env} table. Error:`, JSON.stringify(err, null, 2));
    throw err;
  }
}

async function scanForItems(lastEvaluatedKey) {
  const params = {
    TableName: `article-analytics-${env}`,
    ExclusiveStartKey: lastEvaluatedKey,
  };

  try {
    const data = await docClient.scan(params).promise();
    return data;
  } catch (err) {
    console.error(`Unable to scan article-analytics-${env} table. Error:`, JSON.stringify(err, null, 2));
    throw err;
  }
}

const updateItem = async (item, userId) => {
  const params = {
    TableName: `article-analytics-${env}`,
    Key: {
      id: item.id, // replace with your actual primary key attribute
    },
    UpdateExpression: 'set userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
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
  const users = await getAllUsers();
  const userMap = new Map();
  users.forEach((user) => {
    const username = `${user.firstName} ${user.lastName}`;
    userMap.set(username, user.id);
  });

  let lastEvaluatedKey = null;
  do {
    const { Items, LastEvaluatedKey } = await scanForItems(lastEvaluatedKey);
    for (const item of Items) {
      const userId = userMap.get(item.username);
      if (userId) {
        await updateItem(item, userId);
      } else {
        console.error(`Skipping update for item with id: ${item.id} due to missing userId`);
      }
    }
    lastEvaluatedKey = LastEvaluatedKey;
  } while (lastEvaluatedKey);
}

updateItems()
  .then(() => console.log('All items updated'))
  .catch((err) => console.error(err));
