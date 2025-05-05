import axios from 'axios';

export const handler = async (event: any) => {
  console.log(`----- Received event -----\n${JSON.stringify(event)}`);

  let body: any = {};

  if (event.body) {
    console.log('👂 event body:', event.body);
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      console.error('❌ this can be ignored ❌ event body parsing error:', e);
      body = event.body;
    }
  }

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', body, {
      headers: {
        // Put API key in environment variables
        'x-api-key': process.env.anthropicKey, // Make sure to replace the placeholder with your actual environment variable
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });

    console.log('🐜🐜 anthropic response: ', response.data);
    return {
      statusCode: 200,
      body: JSON.stringify(response.data),
    };
  } catch (error: any) {
    console.error('🐜🐜 anthropic response error: ', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: error.message,
        ...(error.response ? { responseData: error.response.data } : {}),
      }),
    };
  }
};
