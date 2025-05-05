import axios from 'axios';
import {
  parsePrompt,
  parseInitialSources,
  parseInputSettings,
  parsePromptDate,
  parseSourceInput,
  parseStepOutput,
  getPricing,
} from './sheetHelpers';
import AWS from 'aws-sdk';
import {
  AnalyticsInfo,
  ArticleInstructions,
  ArticleSettings,
  ParseMessageOptions,
  PipelineInput,
  SourceType,
  StepOutputs,
  completionOptions,
} from './types';
import { Role, AiSheets, Tables } from './enums';
import Mixpanel from 'mixpanel';
// import Anthropic from '@anthropic-ai/sdk';
// import { MessageParam } from '@anthropic-ai/sdk/resources';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import { databaseFunctions } from '.';

//initialize mixpanel
// TODO change token to proper sesha mixpanel projects
const mixpanel = Mixpanel.init(process.env.mixpanelToken as string);

// ANCHOR prompts
export const prompts = {
  firstQuarterSummaryPrompt: `Summarize the text in 750 words. preserve all quotes. Summarize the text in the style of a news article briefing. 

    The summarization must be completely accurate and rooted in the text. Do not reference any names or informaiton outside of the given text.
    
    After sumarizing the text, provide the most interesting or dramatic 10 quotes or lines from the text line by line (no bullets). Do not use double quote marks, only use single quotes.
    
    Format:
    [accurate line describing document or section]
    [750 word summary of text]
    [top 10 quotes or lines as line by line text]
    Do not use double quote marks, only use single quotes.
    
    This is only the first quarter of the full document to summarize.`,
  secondQuarterSummaryPrompt: `Summarize the text in 750 words. preserve all quotes. Summarize the text in the style of a news article briefing. 

    The summarization must be completely accurate and rooted in the text. Do not reference any names or informaiton outside of the given text.
    
    After sumarizing the text, provide the most interesting or dramatic 10 quotes or lines from the text line by line (no bullets). Do not use double quote marks, only use single quotes.
    
    Format:
    [accurate line describing document or section]
    [750 word summary of text]
    [top 10 quotes or lines as line by line text]
    Do not use double quote marks, only use single quotes.
    
    This is the second quarter of the full document to summarize.`,
  thirdQuarterSummaryPrompt: `Summarize the text in 750 words. preserve all quotes. Summarize the text in the style of a news article briefing. 

    The summarization must be completely accurate and rooted in the text. Do not reference any names or informaiton outside of the given text.
    
    After sumarizing the text, provide the most interesting or dramatic 10 quotes or lines from the text line by line (no bullets). Do not use double quote marks, only use single quotes.
    
    Format:
    [accurate line describing document or section]
    [750 word summary of text]
    [top 10 quotes or lines as line by line text]
    Do not use double quote marks, only use single quotes.
    
    This is the third quarter of the full document to summarize.`,
  fourthQuarterSummaryPrompt: `Summarize the text in 750 words. preserve all quotes. Summarize the text in the style of a news article briefing. 

    The summarization must be completely accurate and rooted in the text. Do not reference any names or informaiton outside of the given text.
    
    After sumarizing the text, provide the most interesting or dramatic 10 quotes or lines from the text line by line (no bullets). Do not use double quote marks, only use single quotes.
    
    Format:
    [accurate line describing document or section]
    [750 word summary of text]
    [top 10 quotes or lines as line by line text]
    Do not use double quote marks, only use single quotes.
    
    This is only the fourth quarter of the full document to summarize.`,
};

// ANCHOR prompt functions
export const createQuarterSummaryContentPrompt = (options: {
  description: string;
  editorNotes: string;
  sourceQuarter: string;
  quarterPlace: string;
}) => {
  return `Information about the content to summarize:
    ${options.description}
    
    Editor notes (if applicable, use editor notes to inform the summary or quotes pulled):
    ${options.editorNotes}
    
    IMPORTANT: Make sure to pull the most newsworthy and interesting information.
    
    ###
    ${options.quarterPlace} quarter of the content to summarize:
    ${options.sourceQuarter}`;
};
export const createSummaryContentSystemPrompt = (options: {
  description: string;
  editorNotes: string;
  source: string;
  summaries: string[];
}) => {
  return `Combine the four chunks of text. Rewrite the text as is, unless minor changes are needed to connect them. Remove duplicate information, but leave any quotes and the general text as is. The text you are combine is a summary of chunks of a larger document/article.

    Then include the interesting lines (which are currently at the end of each summarized section). Don't edit the lines, just leave them as line by line text.
    
    Ensure that it is 100% accurate.
    
    Format:
    DESCRIPTION: [accurate description of full document]
    SUMMARY: [combined chunks of text]
    INTERESTING LINES: [list of Interesting quotes/facts as line by line text (no bullets)]
    
    Important: Do not use double quotation marks, only single quotation marks.  Do not wrap the interesting lines in quotes.
    
    Format example:
    DESCRIPTION: The document summarized is a statement by... outlining the deal.
    SUMMARY: On February 14th, the White House... upcoming trial.
    INTERESTING LINES: 
    Trump said 'It was bad,' calling it all a big 'secret.'
    This was the third offense. 
    ...
    Guinn hurled himself in front of the bear, according to onlookers.
    
    ####
    
    Information about the content to summarize:
    ${options.description}
    
    Editor notes (if applicable, use editor notes to inform the summary or quotes pulled):
    ${options.editorNotes}
    
    IMPORTANT: Make sure to pull the most newsworthy and interesting information.
    
    Here is a snippet of the first part of the document/article that was summarized:
    ${options.source.substring(0, 2000)}`;
};

const getParsedMessages = (
  messages: { systemMessage: string; userMessage: string; assistantMessage?: string },
  options: ParseMessageOptions,
) => {
  let { systemMessage, userMessage, assistantMessage } = messages;
  systemMessage = parsePromptDate(systemMessage);
  systemMessage = parsePrompt(systemMessage, options);

  userMessage = parsePromptDate(userMessage);
  userMessage = parsePrompt(userMessage, options);

  if (assistantMessage) {
    assistantMessage = parsePromptDate(assistantMessage);
    assistantMessage = parsePrompt(assistantMessage, options);

    return { systemMessage, userMessage, assistantMessage };
  }

  return { systemMessage, userMessage };
};

const getAnthropicResponse = async (body: any) => {
  try {
    const lambda = new AWS.Lambda({ region: 'us-east-1' });
    lambda.config.update({ httpOptions: { timeout: 600000 } });
    const response = lambda.invoke({
      InvocationType: 'RequestResponse',
      FunctionName: 'anthropic-handler-' + process.env.env,
      Payload: JSON.stringify({ body: body }),
    });

    const res = await response.promise();
    return res.Payload;
  } catch (e) {
    console.log('🛑 error talking to anthropic lambda: ', e);
    return 'error. check lambda handler logs';
  }
};

// ANCHOR pipeline functions
export const processPipelineInput = async (input: PipelineInput) => {
  const {
    source,
    prompt,
    instructions,
    dynamodbData,
    settings,
    initialSources,
    stepOutputs,
    openAiOutputFormat,
    // new inputs for factsBitSplitting and factsBitSplitting2
    factsBitSplitting,
    initialSource,
  } = input;

  // Consolidate input options
  const options: ParseMessageOptions = {
    input: {
      ...instructions,
      ...settings,
      noOfBlobs: settings?.blobs,
    },
    source,
  };
  // initialSources
  if (initialSources) {
    options.initialSources = initialSources;
  }
  // stepOutputs
  if (stepOutputs) {
    options.stepOutputs = stepOutputs;
  }
  // factsBitSplitting
  if (factsBitSplitting) {
    options.factsBitSplitting = factsBitSplitting;
  }
  // initialSources
  if (initialSource) {
    options.initialSource = initialSource;
  }
  // Parse system and user messages
  try {
    // empty out the error message in case this function is being called again by the state machine
    await databaseFunctions.updateDBEntry(
      dynamodbData?.tableName as string,
      { id: dynamodbData?.id },
      { errorMessage: '' },
    );

    const { systemMessage, userMessage, assistantMessage } = getParsedMessages(
      {
        systemMessage: prompt.systemMessage,
        userMessage: prompt.userMessage,
        assistantMessage: prompt.assistantMessage,
      },
      options,
    );

    // Create parsed prompts
    const parsedPrompts = { systemMessage, userMessage, assistantMessage };

    console.log('📰 parsed prompts: ', JSON.stringify(parsedPrompts));

    let provider = undefined;
    let model = undefined;
    try {
      provider = prompt.model.split('|')[0].trim() === 'anthropic' ? 'anthropic' : 'openai';
      model = prompt.model.split('|')[1].trim();
    } catch (e) {
      throw new Error('Invalid model format. Must be "provider | model"');
    }

    // Send chat completion request
    let gptResponse: any | undefined = undefined;
    gptResponse = await sendChatCompletion({
      systemMessages: [systemMessage],
      userMessages: [userMessage],
      assistantMessages: assistantMessage ? [assistantMessage] : undefined,
      maxTokens: parseFloat(prompt.maxTokens),
      temperature: parseFloat(prompt.temperature),
      outputFormat: openAiOutputFormat,
      model: model,
      provider: provider as any,
    });

    console.log('gpt response : 📃📃📃📃 ', gptResponse);

    // fetch token pricing from sheet
    let pricing = await getPricing(AiSheets.pricing, true);
    console.log('💰 pricing object: ', pricing);
    let modelName: string = prompt.model;
    console.log('🤖 model name: ', modelName);
    //clean up modelName for finetuned models
    if (modelName.includes('ft:')) {
      modelName = modelName.split(':ai-foundation')[0];
    }
    let pricingInfo = pricing[modelName];
    if (pricingInfo === undefined) {
      pricingInfo = pricing['default'];
      console.log('🤖 model not found in pricing sheet, using default pricing');
    }
    console.log('💰 pricing object for model: ', pricingInfo);

    let tokenInCost = pricingInfo.tokensInCost * gptResponse.tokens.input;
    let tokenOutCost = pricingInfo.tokensOutCost * gptResponse.tokens.output;

    mixpanel.track('tokens', {
      orgId: dynamodbData?.orgId,
      orgName: dynamodbData?.orgName,
      userId: dynamodbData?.authorId,
      username: dynamodbData?.authorName,
      tokens_in: gptResponse.tokens.input,
      tokens_in_cost: tokenInCost,
      tokens_out: gptResponse.tokens.output,
      tokens_out_cost: tokenOutCost,
      ai_model: prompt.model,
    });

    const modelSummary = `${prompt.model}: ${gptResponse.tokens.input} in ${gptResponse.tokens.output} out | $${tokenInCost} in $${tokenOutCost} out`;
    // Update dynamodb entry with token cost
    const analyticsInfo: AnalyticsInfo = await databaseFunctions.readDBEntry(Tables.articleAnalytics, {
      id: dynamodbData?.id,
    });
    if (analyticsInfo['modelLog']) {
      analyticsInfo['modelLog'].push(modelSummary);
    } else {
      analyticsInfo['modelLog'] = [modelSummary];
    }
    if (provider === 'openai') {
      if (analyticsInfo['tokensOpenAiIn'] && analyticsInfo['tokensOpenAiOut']) {
        analyticsInfo['tokensOpenAiIn'] += gptResponse.tokens.input;
        analyticsInfo['tokensOpenAiOut'] += gptResponse.tokens.output;
      } else {
        analyticsInfo['tokensOpenAiIn'] = gptResponse.tokens.input;
        analyticsInfo['tokensOpenAiOut'] = gptResponse.tokens.output;
      }

      if (analyticsInfo['totalOpenAiCost']) {
        analyticsInfo['totalOpenAiCost'] += tokenInCost + tokenOutCost;
      } else {
        analyticsInfo['totalOpenAiCost'] = tokenInCost + tokenOutCost;
      }
    } else if (provider === 'anthropic') {
      if (analyticsInfo['tokensAnthropicIn'] && analyticsInfo['tokensAnthropicOut']) {
        analyticsInfo['tokensAnthropicIn'] += gptResponse.tokens.input;
        analyticsInfo['tokensAnthropicOut'] += gptResponse.tokens.output;
      } else {
        analyticsInfo['tokensAnthropicIn'] = gptResponse.tokens.input;
        analyticsInfo['tokensAnthropicOut'] = gptResponse.tokens.output;
      }

      if (analyticsInfo['totalAnthropicCost']) {
        analyticsInfo['totalAnthropicCost'] += tokenInCost + tokenOutCost;
      } else {
        analyticsInfo['totalAnthropicCost'] = tokenInCost + tokenOutCost;
      }
    }

    delete analyticsInfo['id'];

    await databaseFunctions.updateDBEntry(Tables.articleAnalytics, { id: dynamodbData?.id }, analyticsInfo);
    // Return structured result
    return {
      result: gptResponse ? JSON.stringify(gptResponse.message) : 'failed to get response from anthropic or openai',
      parsedPrompts,
    };
  } catch (e) {
    console.log('🛑 ', e);
    console.log('😁 After');
    await databaseFunctions.updateDBEntry(
      dynamodbData?.tableName as string,
      { id: dynamodbData?.id },
      { errorMessage: 'Apologies, there was an error generating this article. Please try again.' },
    );
    console.log('😒 After');
    throw e;
  }
};
//No longer being used
export const summarizeSource = async (input: { source: string; instructions: string }) => {
  const { source, instructions } = input;
  const quarterLength = source.length / 4;
  const summaries: string[] = [];

  for (let i = 1; i <= 4; i++) {
    const sourceQuarter = source.substring(quarterLength * (i - 1), quarterLength * i);
    let quarterPlace = 'first';
    let summaryPrompt = prompts.firstQuarterSummaryPrompt;

    if (i === 2) {
      quarterPlace = 'second';
      summaryPrompt = prompts.secondQuarterSummaryPrompt;
    }
    if (i === 3) {
      quarterPlace = 'third';
      summaryPrompt = prompts.thirdQuarterSummaryPrompt;
    }
    if (i === 4) {
      quarterPlace = 'fourth';
      summaryPrompt = prompts.fourthQuarterSummaryPrompt;
    }
    //summarize quarter via open ai
    const gptResponse = await sendChatCompletion({
      // messages: [
      //   { role: Role.system, content: summaryPrompt },

      //   {
      //     role: Role.user,
      //     content: createQuarterSummaryContentPrompt({
      //       description: ' ',
      //       editorNotes: instructions,
      //       sourceQuarter,
      //       quarterPlace,
      //     }),
      //   },
      // ],
      provider: 'openai',
      systemMessages: [summaryPrompt],
      userMessages: [
        createQuarterSummaryContentPrompt({
          description: ' ',
          editorNotes: instructions,
          sourceQuarter,
          quarterPlace,
        }),
      ],
      maxTokens: 1500,
      temperature: 0.2,
    });

    //push summary to summaries array
    summaries.push(gptResponse.message);
  }

  // update source with the finalized summary
  const finalSummary = await sendChatCompletion({
    // messages: [
    //   {
    //     role: Role.system,
    //     content: createSummaryContentSystemPrompt({
    //       description: ' ',
    //       editorNotes: instructions,
    //       source: source,
    //       summaries,
    //     }),
    //   },
    //   {
    //     role: Role.user,
    //     content: `${summaries[0]} ${summaries[1]} ${summaries[2]} ${summaries[3]}`,
    //   },
    // ],
    provider: 'openai',
    systemMessages: [
      createSummaryContentSystemPrompt({
        description: ' ',
        editorNotes: instructions,
        source: source,
        summaries,
      }),
    ],
    userMessages: [`${summaries[0]} ${summaries[1]} ${summaries[2]} ${summaries[3]}`],
  });

  return JSON.stringify(finalSummary.message);
};

//send request to openAi or anthropic
export const sendChatCompletion = async (
  options: completionOptions,
): Promise<{ message: string; tokens: { input: number; output: number } }> => {
  if (options.provider === 'anthropic') {
    // TEMPORARY make.com proxy request DISABLED
    // const anthropic = new Anthropic({
    //   apiKey: process.env.anthropicKey,
    // });

    if (!options.model) options.model = 'claude-3-opus-20240229';

    const messages = [];

    messages.push({ role: 'user', content: [{ type: 'text', text: options.userMessages[0] }] });

    if (options.assistantMessages) {
      messages.push({ role: 'assistant', content: [{ type: 'text', text: options.assistantMessages[0].trim() }] });
    }

    const anthropicRequestBody = {
      model: options.model as any,
      messages: messages,
      system: options.systemMessages[0],
      max_tokens: 4096,
      temperature: options.temperature,
    };

    console.log('🌌 data being sent to anthropic🌌:', JSON.stringify(anthropicRequestBody));

    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
    let attempt = 0;
    let retryDelay = 60000; // Start with 5 seconds delay

    while (attempt < 10) {
      try {
        let anthropicResponse: any = await getAnthropicResponse(anthropicRequestBody);
        anthropicResponse = JSON.parse(anthropicResponse as string);

        console.log('🫎🫎🫎 anthropic response: ', anthropicResponse);

        if (anthropicResponse && anthropicResponse.statusCode !== 200) {
          throw 'error in anthropic response: ' + anthropicResponse.body;
        }

        anthropicResponse = anthropicResponse.body;
        anthropicResponse = JSON.parse(anthropicResponse);

        return {
          message: anthropicResponse.content[0].text,
          tokens: { input: anthropicResponse.usage.input_tokens, output: anthropicResponse.usage.output_tokens },
        };
      } catch (error) {
        attempt++;
        console.log(`🔴 Attempt ${attempt}: Failed with the following error: `, error);
        console.log(`⌚ retrying after ${retryDelay / 1000} seconds...`);
        await delay(retryDelay);
        retryDelay = retryDelay + 60000; // Double the delay for the next retry, but do not exceed 30 seconds
      }
    }
  } else if (options.provider === 'openai') {
    const openai = new OpenAI({
      apiKey: process.env.openAIKey,
    });

    if (!options.model) options.model = 'gpt-4-1106-preview';

    if (options.temperature && options.temperature > 2)
      return { message: 'temperature must be less than or equal to 2', tokens: { input: 0, output: 0 } };

    let messages: {
      role: string;
      content: string;
    }[] = [];

    const systemMessage = options.systemMessages.map((message) => {
      return { role: 'system', content: message };
    });

    messages = [...messages, ...systemMessage];

    const userMessage = options.userMessages.map((message) => {
      return { role: 'user', content: message };
    });

    messages = [...messages, ...userMessage];

    if (options.assistantMessages) {
      const assistantMessage = options.assistantMessages.map((message) => {
        return { role: 'assistant', content: message.trim() };
      });

      messages = [...messages, ...assistantMessage];
    }

    const requestData = {
      model: options.model,
      messages: messages as ChatCompletionMessageParam[],
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      response_format: {
        type: options.outputFormat ? options.outputFormat : 'text',
      },
    };

    console.log('🌌 data being sent to open ai 🌌:', requestData);

    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
    let attempt = 0;
    let retryDelay = 5000; // Start with 5 seconds delay

    while (attempt < 10) {
      try {
        const chatCompletion = await openai.chat.completions.create(requestData);

        console.log('💫💫 open ai response: ', JSON.stringify(chatCompletion));

        return {
          message: chatCompletion.choices[0].message.content as string,
          tokens: {
            input: chatCompletion.usage?.prompt_tokens as number,
            output: chatCompletion.usage?.completion_tokens as number,
          },
        };
      } catch (error) {
        attempt++;
        console.log(`🔴 Attempt ${attempt}: Failed with the following error: `, error);
        console.log(`⌚ retrying after ${retryDelay / 1000} seconds...`);
        await delay(retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000); // Double the delay for the next retry, but do not exceed 30 seconds
      }
    }
  }
  throw new Error('Failed to get a successful response after 10 attempts');
};
