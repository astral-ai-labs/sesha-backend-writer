"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Prompts = exports.Sheets = exports.TablesIndexes = exports.Tables = exports.Role = void 0;
var Role;
(function (Role) {
    Role["system"] = "system";
    Role["assistant"] = "assistant";
    Role["user"] = "user";
})(Role || (exports.Role = Role = {}));
exports.Tables = {
    settingsPresets: 'settingsPresets' + `-${process.env.env}`,
    users: 'users' + `-${process.env.env}`,
    library: 'library' + `-${process.env.env}`,
    organizations: 'organizations' + `-${process.env.env}`,
    connections: 'connections' + `-${process.env.env}`,
};
var TablesIndexes;
(function (TablesIndexes) {
    TablesIndexes["orgId"] = "orgId-index";
    TablesIndexes["orgIdTimestamp"] = "orgId-timestamp-index";
    TablesIndexes["slugTimestamp"] = "slug-timestamp-index";
    TablesIndexes["id"] = "id-index";
    TablesIndexes["userEmail"] = "email-index";
    TablesIndexes["articleId"] = "article-id-index";
    TablesIndexes["ownerId"] = "ownerId-index";
    TablesIndexes["slugVersion"] = "slug-version-index";
})(TablesIndexes || (exports.TablesIndexes = TablesIndexes = {}));
var Sheets;
(function (Sheets) {
    Sheets["config"] = "config";
    Sheets["aggregator_prompts"] = "aggregator_prompts_1106";
    Sheets["digest_prompts"] = "digest_prompts_1106";
    Sheets["aggregator_prompts_dev"] = "aggregator_prompts_1106_dev";
    Sheets["digest_prompts_dev"] = "digest_prompts_1106_dev";
})(Sheets || (exports.Sheets = Sheets = {}));
var Prompts;
(function (Prompts) {
    Prompts["factsBitSplitting"] = "factsBitSplitting";
    Prompts["paraphrasingFacts"] = "paraphrasingFacts";
    Prompts["articlePreparationOne"] = "articlePreparationOne";
    Prompts["headlinesAndBlobs"] = "headlinesAndBlobs";
    Prompts["articlePreparationTwo"] = "articlePreparationTwo";
    Prompts["quotesPicking"] = "quotesPicking";
    Prompts["writing"] = "writing";
    Prompts["rewriting"] = "rewriting";
    Prompts["attribution"] = "attribution";
})(Prompts || (exports.Prompts = Prompts = {}));
