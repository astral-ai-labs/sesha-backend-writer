import AWS from 'aws-sdk';
import { DynamoDBStreamEvent } from 'aws-lambda';
import { Client } from '@opensearch-project/opensearch';

export const handler = async (event: DynamoDBStreamEvent) => {
  console.log('Processing DynamoDB Stream event', JSON.stringify(event, null, 2));

  const opensearchClient = new Client({
    node: process.env.opensearchDomainEndpoint,
  });

  for (const record of event.Records) {
    if (record && record.dynamodb && record.dynamodb.NewImage) {
      console.log('🎏 Processing record', JSON.stringify(record, null, 2));

      if (record.eventName === 'MODIFY' || record.eventName === 'INSERT') {
        const newImage = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

        const document = {
          headlinesAndBlobs: newImage.headlinesAndBlobs.text,
          digest: newImage.digest.result,
          slug: newImage.slug,
          version: newImage.version,
        };

        try {
          await opensearchClient.index({
            index: `library-index-${process.env.env}`,
            id: newImage.id,
            body: document,
          });
          console.log('Document indexed successfully', document);
        } catch (error) {
          console.error('Error indexing document', error);
        }
      }
    }
  }
};
