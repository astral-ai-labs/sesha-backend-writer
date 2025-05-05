import { Table } from '@pulumi/aws/dynamodb';
import * as pulumi from '@pulumi/pulumi';

export function setupDynamoDbResources() {
  const config = new pulumi.Config();
  const env = config.require('env');

  // users table
  new Table(`users-${env}`, {
    name: `users-${env}`,
    attributes: [
      {
        name: 'id',
        type: 'S',
      },
      {
        name: 'email',
        type: 'S',
      },
      {
        name: 'firstName',
        type: 'S',
      },
      {
        name: 'lastName',
        type: 'S',
      },
      {
        name: 'organizationId',
        type: 'S',
      },
    ],
    billingMode: 'PAY_PER_REQUEST',
    hashKey: 'id',
    tableClass: 'STANDARD',
    // readCapacity: 10,
    // writeCapacity: 10,
    globalSecondaryIndexes: [
      {
        hashKey: 'organizationId',
        name: 'orgId-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
      {
        hashKey: 'email',
        name: 'email-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
      {
        hashKey: 'firstName',
        rangeKey: 'lastName',
        name: 'firstName-lastName-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
    ],
  });

  // doc convert auth token table
  new Table(`doc-convert-token-${env}`, {
    name: `doc-convert-token-${env}`,
    attributes: [
      {
        name: 'id',
        type: 'S',
      },
    ],
    billingMode: 'PAY_PER_REQUEST',
    hashKey: 'id',
    tableClass: 'STANDARD',
  });

  // connections table
  new Table(`connections-${env}`, {
    name: `connections-${env}`,
    attributes: [
      {
        name: 'connectionId',
        type: 'S',
      },
      {
        name: 'orgId',
        type: 'S',
      },
    ],
    billingMode: 'PAY_PER_REQUEST',
    hashKey: 'connectionId',
    tableClass: 'STANDARD',
    // readCapacity: 10,
    // writeCapacity: 10,
    globalSecondaryIndexes: [
      {
        hashKey: 'orgId',
        name: 'orgId-index',
        projectionType: 'ALL',
        readCapacity: 10,
        writeCapacity: 10,
      },
    ],
  });

  // library table
  new Table(`library-${env}`, {
    name: `library-${env}`,
    attributes: [
      {
        name: 'id',
        type: 'S',
      },
      {
        name: 'orgId',
        type: 'S',
      },
      {
        name: 'slug',
        type: 'S',
      },
      {
        name: 'timestamp',
        type: 'N',
      },
      {
        name: 'version',
        type: 'S',
      },
      {
        name: 'sourceType',
        type: 'S',
      },
      {
        name: 'authorName',
        type: 'S',
      },
      {
        name: 'progress',
        type: 'S',
      },
    ],
    billingMode: 'PAY_PER_REQUEST',
    hashKey: 'id',
    tableClass: 'STANDARD',
    streamEnabled: true,
    streamViewType: 'NEW_AND_OLD_IMAGES', // This ensures both new and old versions of items are captured
    // readCapacity: 10,
    // writeCapacity: 10,
    globalSecondaryIndexes: [
      {
        hashKey: 'id',
        name: 'article-id-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
      {
        hashKey: 'slug',
        rangeKey: 'version',
        name: 'slug-version-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
      {
        hashKey: 'orgId',
        rangeKey: 'timestamp',
        name: 'orgId-timestamp-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
      {
        hashKey: 'slug',
        rangeKey: 'timestamp',
        name: 'slug-timestamp-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
      {
        hashKey: 'orgId',
        rangeKey: 'slug',
        name: 'orgId-slug-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
      {
        hashKey: 'orgId',
        rangeKey: 'version',
        name: 'orgId-version-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
      {
        hashKey: 'orgId',
        rangeKey: 'authorName',
        name: 'orgId-authorName-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
      {
        hashKey: 'orgId',
        rangeKey: 'sourceType',
        name: 'orgId-sourceType-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
      {
        hashKey: 'orgId',
        rangeKey: 'progress',
        name: 'orgId-progress-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
    ],
  });

  // organizations table
  new Table(`organizations-${env}`, {
    name: `organizations-${env}`,
    attributes: [
      {
        name: 'id',
        type: 'S',
      },
      {
        name: 'name',
        type: 'S',
      },
    ],
    billingMode: 'PAY_PER_REQUEST',
    hashKey: 'id',
    tableClass: 'STANDARD',
    // readCapacity: 10,
    // writeCapacity: 10,
    globalSecondaryIndexes: [
      {
        hashKey: 'id',
        name: 'id-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
      {
        hashKey: 'name',
        name: 'name-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
    ],
  });

  // settingsPresets table
  new Table(`settingsPresets-${env}`, {
    name: `settingsPresets-${env}`,
    attributes: [
      {
        name: 'id',
        type: 'S',
      },
      {
        name: 'ownerId',
        type: 'S',
      },
      {
        name: 'orgId',
        type: 'S',
      },
    ],
    billingMode: 'PAY_PER_REQUEST',
    hashKey: 'id',
    tableClass: 'STANDARD',
    // readCapacity: 10,
    // writeCapacity: 10,
    globalSecondaryIndexes: [
      {
        hashKey: 'ownerId',
        name: 'ownerId-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
      {
        hashKey: 'orgId',
        name: 'orgId-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
    ],
  });

  // article analytics table
  new Table(`article-analytics-${env}`, {
    name: `article-analytics-${env}`,
    attributes: [
      {
        name: 'id',
        type: 'S',
      },
      {
        name: 'org',
        type: 'S',
      },
      {
        name: 'timeOfCreation',
        type: 'N',
      },
    ],
    billingMode: 'PAY_PER_REQUEST',
    hashKey: 'id',
    tableClass: 'STANDARD',
    // readCapacity: 10,
    // writeCapacity: 10,
    globalSecondaryIndexes: [
      {
        hashKey: 'org',
        rangeKey: 'timeOfCreation',
        name: 'orgName-timeOfCreation-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
      {
        hashKey: 'timeOfCreation',
        name: 'timeOfCreation-index',
        projectionType: 'ALL',
        // readCapacity: 10,
        // writeCapacity: 10,
      },
    ],
  });
}
