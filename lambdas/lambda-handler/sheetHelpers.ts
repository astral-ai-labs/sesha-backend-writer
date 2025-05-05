import { JWT } from 'google-auth-library';
import { AnalyticsInfo, ParseMessageOptions, SheetInputType, SourceType, StepOutputs } from './types';
import { sheets as googleSheets } from '@googleapis/sheets';
import { AiCSVs, AiSheets } from './enums';
import { runS3FileDownload } from '.';
import { S3 } from 'aws-sdk';
import { parse } from 'csv-parse/sync';

const aiSpreadSheetId = process.env.promptSheetId as string;
const analyticsSheetId = process.env.analyticsSheetId as string;

export async function readPromptCsv(csv: AiCSVs) {
  const bucketName = `prompt-csv-${process.env.env}`;
  const key = `${csv}.csv`;

  const s3 = new S3();
  const s3Content = await s3
    .getObject({
      Bucket: bucketName,
      Key: key,
    })
    .promise();

  const { Body } = s3Content;
  if (!Body) {
    console.error(`s3Content.Body is undefined`);
    return;
  }

  const returnData = Body.toString('utf-8');
  if (!returnData) {
    console.error(`s3Content.Body is empty`);
    return;
  }

  // Parse the CSV content
  const returnDataParsed = parse(returnData, {
    columns: true,
    skip_empty_lines: true,
  });

  return returnDataParsed;
}

// Function to read data from Google Spreadsheet
export async function readSpreadsheet(sheet: AiSheets) {
  // Configure a JWT auth client
  const jwtClient = new JWT(
    process.env.googleServiceAccountEmail,
    undefined,
    '-----BEGIN PRIVATE KEY-----' +
      process.env.googleServiceAccountPrivateKey?.replace(/\\n/g, '\n') +
      '-----END PRIVATE KEY-----\n',
    ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  );

  // Authenticate request
  await jwtClient.authorize();

  // Google Sheets API
  const sheets = googleSheets({ version: 'v4', auth: jwtClient });

  try {
    // Specify the spreadsheet ID and range
    const range = sheet; // Adjust as needed

    // Read data from the spreadsheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: aiSpreadSheetId,
      range,
    });

    // Output the rows
    return response.data.values;
  } catch (error) {
    return error;
  }
}

export const getPricing = async (type: AiSheets | AiCSVs, useS3?: boolean) => {
  const pricing: any = {};
  let sheetData: any;

  if (useS3) {
    //instead of gettting raw prompts from spreadsheet, get them from a csv file stored in s3
    sheetData = await readPromptCsv(type as AiCSVs);
  } else {
    sheetData = await readSpreadsheet(type as AiSheets);
  }
  if (!sheetData) return;

  const rows = sheetData;
  if (!rows || rows.length === 0) return;

  if (useS3) {
    // Process each row using the column names
    rows.forEach((row: any) => {
      const key = row['model'];
      if (key) {
        pricing[key] = {
          tokensInCostPerMillion: row['tokensInCostPerMillion'],
          tokensOutCostPerMillion: row['tokensOutCostPerMillion'],
          divisiorPerMillion: row['divisiorPerMillion'],
          tokensInCost: row['tokensInCost'],
          tokensOutCost: row['tokensOutCost'],
        };
      }
    });
  } else {
    // Extracting the header row to create a mapping of column names to their indexes
    const headers = rows[0];

    const columnIndex = headers.reduce((acc: any, name: string, index: number) => {
      acc[name] = index;
      return acc;
    }, {});

    // Process each row using the column name to index mapping
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const key = row[columnIndex['model']];
      if (key) {
        pricing[key] = {
          tokensInCostPerMillion: row[columnIndex['tokensInCostPerMillion']],
          tokensOutCostPerMillion: row[columnIndex['tokensOutCostPerMillion']],
          divisiorPerMillion: row[columnIndex['divisiorPerMillion']],
          tokensInCost: row[columnIndex['tokensInCost']],
          tokensOutCost: row[columnIndex['tokensOutCost']],
        };
      }
    }
  }

  return pricing;
};

export const insertArticleAnalyticsData = async (analyticsData: AnalyticsInfo) => {
  // Configure a JWT auth client
  const jwtClient = new JWT(
    process.env.googleServiceAccountEmail,
    undefined,
    '-----BEGIN PRIVATE KEY-----' +
      process.env.googleServiceAccountPrivateKey?.replace(/\\n/g, '\n') +
      '-----END PRIVATE KEY-----\n',
    ['https://www.googleapis.com/auth/spreadsheets'],
  );

  // Authenticate request
  await jwtClient.authorize();

  // Google Sheets API
  const sheets = googleSheets({ version: 'v4', auth: jwtClient });

  try {
    // Specify the spreadsheet ID and range
    const range = 'cost_tracking_master!A1'; // Adjust as needed
    console.log('🔴 spreadsheet Id', analyticsSheetId);
    // insert analytics data from the spreadsheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: analyticsSheetId,
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [
            new Date(new Date(analyticsData.timeOfCreation).valueOf()).toUTCString(),
            analyticsData.storyId,
            analyticsData.slug,
            analyticsData.articleUrl,
            analyticsData.version,
            analyticsData.headline,
            analyticsData.org,
            analyticsData.username,
            analyticsData.sourceType,
            analyticsData.numberOfInputs,
            analyticsData.totalInputWordLength,
            analyticsData.requestedLength,
            analyticsData.rerun,
            analyticsData.progress,
            analyticsData.modelLog.reduce((acc, log) => acc + log + '\n', ''),
            analyticsData.tokensOpenAiIn,
            analyticsData.tokensOpenAiOut,
            analyticsData.tokensAnthropicIn,
            analyticsData.tokensAnthropicOut,
            analyticsData.totalOpenAiCost,
            analyticsData.totalAnthropicCost,
            analyticsData.totalCost,
          ],
        ],
      },
    });

    console.log('🔴 sheet append response: ', response);
  } catch (error) {
    console.log('🔴 error writing to sheet', error);
    return error;
  }
};

//function which reads the entire sheet and maps out and object for the cells on the basis of the step title
export const getRawPrompts = async (type: AiSheets | AiCSVs, useS3?: boolean) => {
  const prompts: any = {};
  let sheetData: any;

  if (useS3) {
    //instead of gettting raw prompts from spreadsheet, get them from a csv file stored in s3
    sheetData = await readPromptCsv(type as AiCSVs);
  } else {
    sheetData = await readSpreadsheet(type as AiSheets);
  }

  if (!sheetData) return;

  const rows = sheetData;
  if (!rows || rows.length === 0) return;

  if (useS3) {
    // Process each row using the column names
    rows.forEach((row: any) => {
      const key = row['promptId'];
      if (key) {
        prompts[key] = {
          systemMessage: row['systemMessage'],
          userMessage: row['userMessage'],
          assistantMessage: row['assistantMessage'],
          temperature: row['temperature'],
          maxTokens: row['maxTokens'],
          model: row['model'],
        };
      }
    });
  } else {
    // Extracting the header row to create a mapping of column names to their indexes
    const headers = rows[0];

    const columnIndex = headers.reduce((acc: any, name: string, index: number) => {
      acc[name] = index;
      return acc;
    }, {});

    // Process each row using the column name to index mapping
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const key = row[columnIndex['promptId']];
      if (key) {
        prompts[key] = {
          systemMessage: row[columnIndex['systemMessage']],
          userMessage: row[columnIndex['userMessage']],
          assistantMessage: row[columnIndex['assistantMessage']],
          temperature: row[columnIndex['temperature']],
          maxTokens: row[columnIndex['maxTokens']],
          model: row[columnIndex['model']],
        };
      }
    }
  }
  return prompts;
};

//ANCHOR - prompt parsers
export const parsePromptDate = (prompt: string) => {
  return prompt.replaceAll('{date}', new Date().toLocaleDateString());
};

export const parseInputSettings = (prompt: string, inputSettings: SheetInputType | any) => {
  return prompt.replace(/\{input\.([^}]+)\}/g, (match, key) => {
    return inputSettings.hasOwnProperty(key) ? inputSettings[key] : match;
  });
};

export const parseSourceInput = (prompt: string, source: SourceType | any) => {
  return prompt.replace(/\{source\.([^}]+)\}/g, (match, key) => {
    return source.hasOwnProperty(key) ? source[key] : match;
  });
};

export const parseStepOutput = (prompt: string, stepOutputs: StepOutputs | any) => {
  return prompt.replace(/\{stepOutputs\.([^}]+)\}/g, (match, key) => {
    return stepOutputs.hasOwnProperty(key) ? stepOutputs[key] : match;
  });
};

export const parseInitialSources = (prompt: string, initialSources: any) => {
  return prompt.replace(/\{initialSources\[(\d+)\]\.([^}.]+)\}/g, (match, index, prop) => {
    const sourceIndex = parseInt(index, 10);
    if (sourceIndex < initialSources.length && initialSources[sourceIndex]?.hasOwnProperty(prop)) {
      return initialSources[sourceIndex][prop];
    }
    return match;
  });
};

// Function to resolve a value from the options
const resolveValue = (keyOrValue: any, options: any) => {
  if (keyOrValue && keyOrValue.includes('.')) {
    const keys = keyOrValue.split(/\.|\[|\]/).filter(Boolean);
    return keys.reduce((acc: any, key: any) => (acc && !isNaN(key) ? acc[Number(key)] : acc && acc[key]), options);
  }
  return keyOrValue && !isNaN(keyOrValue) ? Number(keyOrValue) : keyOrValue;
};
// Function to parse placeholders in a string
const parsePlaceholders = (content: any, options: any) =>
  content.replace(/{([^}]+)}/g, (_: any, key: any) => resolveValue(key, options) ?? _);

// Function to perform comparison
const performComparison = (value: any, operator: any, comparisonValue: any) => {
  switch (operator) {
    case '==':
      return value == comparisonValue;
    case '>':
      return value > comparisonValue;
    case '<':
      return value < comparisonValue;
    case '!':
      return !value;
    default:
      return false;
  }
};

// Function to evaluate if conditions
const evaluateIfContent = (content: any, options: any) =>
  content.replace(
    /{if (!)?([^}<>\s]+)\s*(==|>|<)?\s*([^}]*)?}([\s\S]*?){endIf}/g,
    (_: any, notOperator: any, keysString: any, operator: any, comparisonValueString: any, ifContent: any) => {
      const value = resolveValue(keysString, options);
      const isNotCondition = notOperator === '!';
      const comparisonValue = operator ? resolveValue(comparisonValueString, options) : null;
      let conditionMet;

      if (isNotCondition) {
        conditionMet = !value;
      } else {
        conditionMet = operator ? performComparison(value, operator, comparisonValue) : Boolean(value);
      }

      return conditionMet ? parsePlaceholders(ifContent, options) : '';
    },
  );

const extractIfBlocks = (content: any) => {
  const blocks = [];
  const stack = [];
  const depthCount: any = {};
  const regex = /{if\s+([^{}]*?)}|{endIf}/g;

  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match[0].startsWith('{if ')) {
      // Starting a new block
      stack.push({
        start: match.index,
        end: -1,
        condition: match[1],
      });
    } else if (match[0] === '{endIf}') {
      // Ending a block
      if (stack.length > 0) {
        const block: any = stack.pop();
        block.end = regex.lastIndex;

        // Determine depth and increment depth count
        const depth: any = stack.length;
        if (!depthCount[depth]) {
          depthCount[depth] = 0;
        }
        depthCount[depth]++;

        // Extract the content between the start and the end
        const blockContent = content.substring(block.start, block.end);
        const ifTagClose = blockContent.indexOf('}');
        const contentInsideBlock = blockContent.substring(ifTagClose + 1, blockContent.length - 7);

        // Determine parent
        const parentIdentifier = depth > 0 ? stack[stack.length - 1].start : null;

        blocks.push({
          ifBlockContent: blockContent,
          // contentInsideBlock: contentInsideBlock,
          blockStart: block.start,
          blockEnd: block.end,
          blockDepth: depth,
          blockParentIdentifier: parentIdentifier,
          order: depthCount[depth], // Added order of appearance
        });
      }
    }
  }

  // Sorting blocks by depth in ascending order, then by order of appearance in descending order
  return blocks.sort((a, b) => a.blockDepth - b.blockDepth || b.order - a.order);
};

const parseNestedIfBlocks = (input: any, options: any) => {
  const blocks = extractIfBlocks(input);
  let resultString = input;

  for (let i = blocks.length - 1; i >= 0; i--) {
    const block: any = blocks[i];
    if (block.blockParentIdentifier !== null) {
      //block is nested
      const parentBlock: any = blocks.find((b) => b.blockStart === block.blockParentIdentifier);

      const parsedContent = evaluateIfContent(block.ifBlockContent, options);

      // get parent blocks starting and ending if indexes after the first if
      const firstIfStartingIndex = parentBlock.ifBlockContent.indexOf('{if');
      const firstifEndingIndex = parentBlock.ifBlockContent.indexOf('}', firstIfStartingIndex);
      const nestedIfStartingIndex = parentBlock.ifBlockContent.indexOf('{if', firstifEndingIndex);
      const nestedIfEndingIndex = parentBlock.ifBlockContent.indexOf(nestedIfStartingIndex, '}');

      const nestedEndingIndex = parentBlock.ifBlockContent.indexOf('{endIf}', nestedIfEndingIndex) + 7;

      // get the content between the starting and ending if indexes
      const contentToReplace = parentBlock.ifBlockContent.slice(nestedIfStartingIndex, nestedEndingIndex);

      parentBlock.ifBlockContent = parentBlock.ifBlockContent.replace(contentToReplace, parsedContent);

      // mark the block as processed
      block.processed = true;
    } else {
      // Extract the content to be replaced from the result string using current block's boundaries
      const contentToReplace = resultString.slice(block.blockStart, block.blockEnd);

      // Evaluate the content within the current block with the provided options
      const replacementContent = evaluateIfContent(block.ifBlockContent, options);

      // Replace the original block content in the result string with the evaluated content
      resultString = resultString.slice(0, block.blockStart) + replacementContent + resultString.slice(block.blockEnd);

      // Calculate the length difference after the replacement to adjust future blocks
      const lengthDifference = replacementContent.length - contentToReplace.length;

      // Adjust the start and end positions of subsequent blocks to reflect the new length of the result string
      blocks.slice(0, i).forEach((subsequentBlock) => {
        if (subsequentBlock.blockStart > block.blockStart) {
          subsequentBlock.blockStart += lengthDifference;
          subsequentBlock.blockEnd += lengthDifference;
        }
      });
    }
  }

  return resultString;
};

export const parsePrompt = (
  inputString: string,
  options: { input: SheetInputType; source: SourceType; stepOutputs: StepOutputs; initialSources: SourceType[] } | any,
) => {
  return parsePlaceholders(evaluateIfContent(parseNestedIfBlocks(inputString, options), options), options);
};
