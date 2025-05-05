// Import AWS SDK and fetch
const AWS = require('aws-sdk');
const fetch = require('node-fetch'); // or you can use import fetch from 'node-fetch' if you're using ES modules

// Configure AWS DynamoDB
AWS.config.update({
  region: 'eu-north-1', // Example: 'eu-west-1'
  // other configuration if needed
});

const docClient = new AWS.DynamoDB.DocumentClient();

const tableNameDev = 'library-dev'; // Replace with your DynamoDB table name
const tableNameProd = 'library-prod'; // Replace with your DynamoDB table name
const devUrl = 'https://9n4v1oviqh.execute-api.eu-north-1.amazonaws.com/dev/add-bulk-items-to-search-index';
const prodUrl = 'https://il8v7589lj.execute-api.eu-north-1.amazonaws.com/prod/add-bulk-items-to-search-index';

async function fetchItemsFromDynamoDB(lastEvaluatedKey = null) {
  const params = {
    TableName: tableNameProd,
    Limit: 50,
  };

  if (lastEvaluatedKey) {
    params.ExclusiveStartKey = lastEvaluatedKey;
  }

  try {
    const data = await docClient.scan(params).promise();
    return data;
  } catch (error) {
    console.error('Error fetching items from DynamoDB:', error);
    throw error;
  }
}

function transformEntry(entry) {
  console.log('Before transformation:', entry);

  let headlinesAndBlobs = '';
  if (entry.headlinesAndBlobs) {
    // Transform headlinesAndBlobs
    headlinesAndBlobs =
      typeof entry.headlinesAndBlobs === 'string' ? entry.headlinesAndBlobs : entry.headlinesAndBlobs.text;
  }

  const transformedEntry = {
    orgId: entry.orgId ? entry.orgId.replaceAll('-', '') : '1',
    slug: entry.slug,
    version: entry.version ? entry.version : '',
    headlinesAndBlobs: headlinesAndBlobs,
    user: entry.authorName ? entry.authorName : 'sesha systems',
    sourceType: entry.sourceType ? entry.sourceType : '',
    timestamp: entry.timestamp ? entry.timestamp : '',
    digest: entry.digest && entry.digest.result ? entry.digest.result : '',
    progress: entry.progress ? entry.progress : '',
  };

  console.log('After transformation:', transformedEntry);

  return transformedEntry;
}

async function sendBatchToAPI(batch) {
  const url = prodUrl;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(batch),
  });

  if (!response.ok) {
    throw new Error('Failed to send batch to API');
  }

  return response.json();
}

async function processBatches(lastEvaluatedKey = null) {
  try {
    const { Items, LastEvaluatedKey } = await fetchItemsFromDynamoDB(lastEvaluatedKey);

    const transformedBatch = Items.map(transformEntry);

    await sendBatchToAPI(transformedBatch);

    if (LastEvaluatedKey) {
      await processBatches(LastEvaluatedKey); // Recursively process the next batch
    }
  } catch (error) {
    console.error('Error processing batches:', error);
  }
}

// Start the process
processBatches().then(() => console.log('All batches processed successfully'));
