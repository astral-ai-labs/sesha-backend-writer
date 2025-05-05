import { dynamodb } from '@pulumi/aws';
import { Prompts as PromptNames, Role } from './enums';

// types
export type DynamoDBData = {
  tableName: string;
  id: string;
  slug?: string;
  source?: string;
  timestamp?: number;
  orgId?: string;
  orgName?: string;
  authorId?: string;
  authorName?: string;
  authorEmail?: string;
  version?: string;
  sourceType?: string;
  progress?: string;
  originalInstructions?: {
    source: string;
    slug: string;
    settings: {
      tone: string;
      blobs: string;
      length: string;
    };
    instructions: {
      description: string;
      headlineSuggestion: string;
      instructions: string;
    };
  };
};
export type ParsedPrompt = {
  systemMessage: string;
  userMessage: string;
};
export type ArticleSettings = {
  tone: string;
  blobs?: number;
  noOfBlobs?: number;
  length: number;
};
export type ArticleInstructions = {
  description: string;
  headlineSuggestion: string;
  instructions: string;
};
export type stepOutput = {
  text: string;
  words: number;
  characters: number;
};
export type StepOutputs = {
  factsBitSplitting?: stepOutput | stepOutput[];
  factsBitSplitting2?: stepOutput | stepOutput[];
  paraphrasingFacts?: stepOutput;
  articlePreparationOne?: stepOutput;
  headlinesAndBlobs?: stepOutput;
  articlePreparationTwo?: stepOutput;
  quotesPicking?: stepOutput;
  writing?: stepOutput;
  rewriting?: stepOutput;
  finalizationOne?: stepOutput;
  finalizationTwo?: stepOutput;
  attribution?: stepOutput;
};

export type StepFunctionInput = {
  prompts: Record<PromptNames, any>;
  parsedPrompts?: any;
  settings: ArticleSettings;
  instructions: ArticleInstructions;
  slug: string;
  dynamodbData: DynamoDBData;
  headlinesAndBlobs?: string;
  initialSources?: SourceType[];
  articleType?: 'single' | 'multi';
  stepOutputs?: StepOutputs;
};

export type GenerateArticleBody = {
  slug: string;
  settings: ArticleSettings;
  instructions: ArticleInstructions;
  version?: string;
};

export type MessageType = {
  role: Role;
  content: string;
};

export type SourceType = {
  text: string;
  accredit: string;
  number: number;
  useVerbatim?: boolean;
  isBaseSource?: boolean;
  isPrimarySource?: boolean;
  words: number;
};

export type completionOptions = {
  provider: 'openai' | 'anthropic';
  model?: string;
  // messages: MessageType[];
  userMessages: string[];
  systemMessages: string[];
  assistantMessages?: string[];
  maxTokens?: number;
  temperature?: number;
  outputFormat?: 'text' | 'json_object';
  topP?: number;
  completionsToGenerate?: number;
  echo?: boolean;
};

export type PipelineInput = {
  prompt: any;
  source: SourceType;
  settings: ArticleSettings;
  instructions: ArticleInstructions;
  dynamodbData?: DynamoDBData;
  initialSources?: SourceType[];
  stepOutputs?: StepOutputs;
  // new inputs for factsBitSplitting and factsBitSplitting2
  factsBitSplitting?: SourceType;
  initialSource?: SourceType;
  openAiOutputFormat?: 'text' | 'json_object';
};

export type SingleSourceInput = StepFunctionInput & {
  source: SourceType;
};

export type MultiSourceInput = StepFunctionInput & {
  sources: SourceType[];
};

export type GenerateDigestBody = GenerateArticleBody & {
  source: SourceType;
};

export type GenerateAggregratorBody = GenerateArticleBody & {
  sources: SourceType[];
};

export type SheetInputType = {
  headlineSuggestion: string;
  instructions: string;
  tone: string;
  noOfBlobs: number;
  length: number;
};
export type ParseMessageOptions = {
  input: ArticleInstructions & ArticleSettings;
  source: SourceType;
  initialSources?: SourceType[];
  stepOutputs?: StepOutputs;
  // new inputs for factsBitSplitting and factsBitSplitting2
  factsBitSplitting?: SourceType;
  initialSource?: SourceType;
};

export type AnalyticsInfo = {
  id?: string;
  timeOfCreation: number;
  storyId: string;
  slug: string;
  articleUrl: string;
  version: string;
  headline: string;
  org: string;
  username: string;
  sourceType: string;
  numberOfInputs: number;
  totalInputWordLength: number;
  requestedLength: number;
  rerun: boolean;
  progress: string;
  modelLog: string[];
  tokensOpenAiIn: number;
  tokensOpenAiOut: number;
  tokensAnthropicIn: number;
  tokensAnthropicOut: number;
  totalOpenAiCost: number;
  totalAnthropicCost: number;
  totalCost: number;
};

export const searchPaths = {
  createMapping: '/create-mapping',
  createEntry: '/create-entry',
  search: '/search',
};
