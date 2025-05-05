export enum Role {
  system = 'system',
  assistant = 'assistant',
  user = 'user',
}
export const Tables = {
  settingsPresets: 'settingsPresets' + `-${process.env.env}`,
  users: 'users' + `-${process.env.env}`,
  docConvertToken: 'doc-convert-token' + `-${process.env.env}`,
  library: 'library' + `-${process.env.env}`,
  organizations: 'organizations' + `-${process.env.env}`,
  connections: 'connections' + `-${process.env.env}`,
  articleAnalytics: 'article-analytics' + `-${process.env.env}`,
};
export enum TablesIndexes {
  orgId = 'orgId-index',
  id = 'id-index',
  userEmail = 'email-index',
  articleId = 'article-id-index',
  ownerId = 'ownerId-index',

  orgIdAuthorName = 'orgId-authorName-index',
  orgIdSlug = 'orgId-slug-index',
  orgIdSourceType = 'orgId-sourceType-index',
  orgIdStatus = 'orgId-status-index',
  orgIdTimestamp = 'orgId-timestamp-index',
  orgIdVersion = 'orgId-version-index',
  orgNameIndex = 'name-index',
  orgNameTimeOfCreation = 'orgName-timeOfCreation-index',
  timeOfCreation = 'timeOfCreation-index',

  slugTimestamp = 'slug-timestamp-index',
  slugVersion = 'slug-version-index',
}
export enum AiSheets {
  config = 'config',
  pricing = 'pricing',
  aggregator_prompts = 'aggregator_prompts_1106',
  digest_prompts = 'digest_prompts_1106',
  digest_prompts_verbatim = 'digest_verbatim_prompts_1106',
  aggregator_prompts_dev = 'aggregator_prompts_1106_dev',
  digest_prompts_dev = 'digest_prompts_1106_dev',
  digest_prompts_verbatim_dev = 'digest_verbatim_prompts_1106_dev',
}
export enum AiCSVs {
  config = 'config',
  pricing = 'pricing',
  aggregator_prompts = 'aggregator_prompts',
  digest_prompts = 'digest_prompts',
  digest_prompts_verbatim = 'digest_verbatim_prompts',
  aggregator_prompts_dev = 'aggregator_prompts_dev',
  digest_prompts_dev = 'digest_prompts_dev',
  digest_prompts_verbatim_dev = 'digest_verbatim_prompts_dev',
}

export enum Prompts {
  factsBitSplitting = 'factsBitSplitting',
  factsBitSplitting2 = 'factsBitSplitting2',
  paraphrasingFacts = 'paraphrasingFacts',
  articlePreparationOne = 'articlePreparationOne',
  headlinesAndBlobs = 'headlinesAndBlobs',
  articlePreparationTwo = 'articlePreparationTwo',
  quotesPicking = 'quotesPicking',
  writing = 'writing',
  rewriting = 'rewriting',
  finalizationOne = 'finalizationOne',
  finalizationTwo = 'finalizationTwo',
  attribution = 'attribution',
}
