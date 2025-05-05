import { Client } from '@opensearch-project/opensearch';

const opensearchDomainEndpoint = 'https://' + process.env.opensearchEndpoint;

// Configure the OpenSearch client
const osClient = new Client({
  node: opensearchDomainEndpoint,
  nodes: [opensearchDomainEndpoint],
});

const searchIndex = 'sesha-library-index';

export const handler = async (event: { body: any; path: string }) => {
  console.log(`----- Received event -----\n${JSON.stringify(event)}`);

  let body = event.body;
  let path = event.path;

  switch (path) {
    case `/test-function`:
    case `/test-function/`:
      return testFunction();
    case `/update-mapping`:
    case `/update-mapping/`:
      return await updateMapping(body);
    case `/create-entry`:
    case `/create-entry/`:
      return await createEntry(body);
    case `/create-bulk-entries`:
    case `/create-bulk-entries/`:
      return await createBulkEntries(body);
    case `/search`:
    case `/search/`:
      return await search(body);
    case `/filter`:
    case `/filter/`:
      return await filter(body);
    case `/get-item`:
    case `/get-item/`:
      return await getItem(body);
    case `/create-index`:
    case `/create-index/`:
      return await createIndex(body);
    case `/delete-index`:
    case `/delete-index/`:
      return await deleteIndex(body);
    default:
      return createResponse(404, JSON.stringify({ error: path + ' Not Found' }));
  }
};

const createResponse = (statusCode: number, body: any) => ({
  statusCode: statusCode,
  headers: {
    'Content-Type': 'application/json',
  },
  body: body,
});

const testFunction = () => {
  console.log('🎏 test function called!');
  return createResponse(200, JSON.stringify({ res: 'called' }));
};

const updateMapping = async (body: any) => {
  try {
    const response = await osClient.indices.create({
      index: searchIndex,
      body: {
        mappings: body.mappings, // Assuming the mappings are provided in the request body
      },
    });
    return createResponse(200, JSON.stringify(response.body));
  } catch (error) {
    console.error('Error creating mapping:', error);
    return createResponse(500, JSON.stringify({ error: 'Failed to create mapping' }));
  }
};

const getItem = async (body: any) => {
  const res = await osClient.get({
    index: searchIndex,
    id: body.id,
  });

  console.log('🔍 get item response: ', JSON.stringify(res));

  return createResponse(200, JSON.stringify(res));
};
const createEntry = async (body: any) => {
  try {
    const response = await osClient.bulk({
      refresh: true, // Ensure the index is immediately refreshed after the bulk operation, making all documents searchable
      body: [
        { index: { _index: searchIndex } },
        body, // The document to be indexed
      ],
    });
    return createResponse(200, JSON.stringify(response.body));
  } catch (error) {
    console.log('Error creating entry:', error);
    return createResponse(500, JSON.stringify({ error: 'Failed to create entry' }));
  }
};

const createBulkEntries = async (body: any) => {
  try {
    // Prepare the bulk request payload.
    // The bulk API expects a specific format where action and document pairs are defined line by line.
    const bulkBody: any = [];

    body.forEach((doc: any) => {
      // For each document, first specify the action/metadata line
      bulkBody.push({ index: { _index: searchIndex } });
      // Then specify the actual document to be indexed
      bulkBody.push(doc);
    });

    // Execute the bulk operation
    const response = await osClient.bulk({
      refresh: true, // Ensure the index is immediately refreshed after the bulk operation, making all documents searchable
      body: bulkBody,
    });

    // Check for errors in the bulk response
    if (response.body.errors) {
      // If there are errors, you might want to handle them appropriately in your application
      console.error('Bulk operation completed with errors', response.body);
      return createResponse(
        500,
        JSON.stringify({ error: 'Bulk operation completed with errors', details: response.body }),
      );
    }
    await osClient.indices.refresh({ index: searchIndex });

    // If everything went well, return a success response
    return createResponse(200, JSON.stringify({ result: 'success', details: response.body }));
  } catch (error) {
    console.error('Error during bulk entry creation:', error);
    return createResponse(500, JSON.stringify({ error: 'Failed to create bulk entries' }));
  }
};

async function createIndex(body: any) {
  try {
    const { indexName } = body;
    const response = await osClient.indices.create({
      index: indexName,
      body: {
        settings: {
          analysis: {
            analyzer: {
              custom_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['pattern_capture', 'lowercase'],
              },
            },
            filter: {
              pattern_capture: {
                type: 'pattern_capture',
                patterns: [
                  '([0-9]+)', // matches numbers
                  '([a-zA-Z]+)', // matches words
                  '(W+)', // matches non-word characters (symbols)
                ],
              },
            },
          },
        },
        mappings: {
          properties: {
            slug: { type: 'text', analyzer: 'custom_analyzer' },
            orgId: { type: 'text', analyzer: 'custom_analyzer' },
            version: { type: 'text', analyzer: 'custom_analyzer' },
            headlinesAndBlobs: { type: 'text', analyzer: 'custom_analyzer' },
            user: { type: 'text', analyzer: 'custom_analyzer' },
            sourceType: { type: 'text', analyzer: 'custom_analyzer' },
            timestamp: { type: 'date', format: 'epoch_millis' },
            digest: { type: 'text', analyzer: 'custom_analyzer' },
            progress: { type: 'text', analyzer: 'custom_analyzer' },
          },
        },
      },
    });
    console.log('🖖 response from index creation step:', response);
    return { message: `Index ${indexName} created successfully` };
  } catch (error: any) {
    console.error(`Error creating index: ${error.message}`);
    return { error: `Error creating index: ${error.message}` };
  }
}

async function deleteIndex(body: { indexName: string }) {
  try {
    const { indexName } = body;
    await osClient.indices.delete({ index: indexName });
    return { message: `Index ${indexName} deleted successfully` };
  } catch (error: any) {
    console.error(error);
    return { error: `Error deleting index: ${error.message}` };
  }
}
const search = async (body: any) => {
  try {
    const searchTerm = body.input;
    const fieldsToSearch = body.fieldsToSearch;
    const from = body.from || 0;
    const size = body.size || 50;
    const orgId = body.orgId.replaceAll('-', '');
    const isSingleWord = !/\s/.test(searchTerm);
    let boolShouldQueries: any[] = [];

    fieldsToSearch.forEach((field: string) => {
      let fieldBoolMustQueries = [];
      if (isSingleWord) {
        // For a single word, create a wildcard query for the field
        fieldBoolMustQueries.push({
          wildcard: { [field]: `*${searchTerm}*` },
        });
      } else {
        // For multiple words, create wildcard queries for each word in the field
        const words = searchTerm.match(/([0-9]+)|([a-zA-Z]+)|(\W+)/g) || [];

        if (words.length === 0) {
          console.log('No words found in search term.');
        }
        words.forEach((word: string) => {
          word = word.trim(); // Remove leading and trailing spaces
          if (word.length > 0) {
            // Check if the word is not empty
            console.log('word: 🔤', word);
            fieldBoolMustQueries.push({
              wildcard: { [field]: `*${word}*` },
            });
          }
        });
      }
      if (fieldBoolMustQueries.length > 0) {
        boolShouldQueries.push({
          bool: {
            must: fieldBoolMustQueries,
          },
        });
      }
    });

    let query: any = {
      bool: {
        must: [
          {
            bool: {
              should: boolShouldQueries,
            },
          },
          {
            term: { orgId: orgId }, // Ensure the entry's orgId matches the provided orgId
          },
        ],
      },
    };

    const response = await osClient.search({
      index: searchIndex,
      body: {
        query: query,
      },
      from,
      size,
    });

    console.log('🔍 Search response : ', response.body.hits.hits);

    return createResponse(200, JSON.stringify(response.body.hits.hits));
  } catch (error) {
    console.error('Error performing search:', error);
    return createResponse(500, JSON.stringify({ error: 'Failed to perform search' }));
  }
};

const filter = async (body: any) => {
  try {
    const filters: {
      orgId: string;
      slug?: string;
      contains?: string;
      user?: string;
      date?: { startDate: number; endDate: number };
      sourceType?: string;
    } = body.filters;
    const from = body.from || 0;
    const size = body.size || 50;

    const mustQueries: any[] = [];

    if (filters.orgId) {
      mustQueries.push({ term: { orgId: filters.orgId.replaceAll('-', '') } });
    }

    if (filters.slug) {
      const isSingleWord = !/\s/.test(filters.slug);
      if (isSingleWord) {
        mustQueries.push({ wildcard: { slug: `*${filters.slug}*` } });
      } else {
        const words = filters.slug.match(/([0-9]+)|([a-zA-Z]+)|(W+)/g);
        words?.forEach((word: string) => {
          word = word.trim(); // Remove leading and trailing spaces
          if (word.length > 0) {
            // Check if the word is not empty
            mustQueries.push({
              wildcard: { slug: `*${word}*` },
            });
          }
        });
      }
    }
    if (filters.contains) {
      const isSingleWord = !/\s/.test(filters.contains);
      const digestQueries = [];
      const headlinesAndBlobsQueries = [];
      if (isSingleWord) {
        digestQueries.push({ wildcard: { digest: `*${filters.contains}*` } });
        headlinesAndBlobsQueries.push({ wildcard: { headlinesAndBlobs: `*${filters.contains}*` } });
      } else {
        const words = filters.contains.match(/([0-9]+)|([a-zA-Z]+)|(W+)/g);
        words?.forEach((word: string) => {
          word = word.trim(); // Remove leading and trailing spaces
          if (word.length > 0) {
            // Check if the word is not  empty
            digestQueries.push({ wildcard: { digest: `*${word}*` } });
            headlinesAndBlobsQueries.push({ wildcard: { headlinesAndBlobs: `*${word}*` } });
          }
        });
      }
      mustQueries.push({
        bool: {
          should: [
            {
              bool: {
                must: digestQueries,
              },
            },
            {
              bool: {
                must: headlinesAndBlobsQueries,
              },
            },
          ],
        },
      });
    }
    if (filters.user) {
      const isSingleWord = !/\s/.test(filters.user);
      if (isSingleWord) {
        mustQueries.push({ wildcard: { user: `*${filters.user}*` } });
      } else {
        const words = filters.user.match(/([0-9]+)|([a-zA-Z]+)|(W+)/g);
        words?.forEach((word: string) => {
          word = word.trim(); // Remove leading and trailing spaces
          if (word.length > 0) {
            // Check if the word is not empty
            mustQueries.push({
              wildcard: { user: `*${word}*` },
            });
          }
        });
      }
    }
    if (filters.date) {
      mustQueries.push({
        range: {
          timestamp: {
            gte: filters.date.startDate,
            lte: filters.date.endDate,
          },
        },
      });
    }
    if (filters.sourceType && filters.sourceType !== 'both') {
      // Add a term query for the sourceType
      mustQueries.push({ term: { sourceType: filters.sourceType } });
    }

    const response = await osClient.search({
      index: searchIndex,
      body: {
        query: {
          bool: {
            must: mustQueries,
          },
        },
      },
      from: from,
      size: size,
    });

    const hits = response.body.hits.hits;

    console.log('🖊️ filter response: ', hits);

    return createResponse(200, JSON.stringify(hits));
  } catch (error) {
    console.error('Error performing filtering:', error);
    return createResponse(500, JSON.stringify({ error: 'Failed to perform filtering' }));
  }
};
