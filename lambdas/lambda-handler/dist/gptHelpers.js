"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendChatCompletion = exports.aggregatorAttribution = exports.digestAttribution = exports.rewriting = exports.writing = exports.quotesPicking = exports.articlePrepTwo = exports.headlinesAndBlobs = exports.articlePrepOne = exports.paraphrasingFacts = exports.factsBitSplitting = exports.factBitsAggregator = exports.summarizeSource = exports.createSummaryContentSystemPrompt = exports.createQuarterSummaryContentPrompt = exports.prompts = void 0;
const axios_1 = __importDefault(require("axios"));
const sheetHelpers_1 = require("./sheetHelpers");
const enums_1 = require("./enums");
// ANCHOR prompts
exports.prompts = {
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
const createQuarterSummaryContentPrompt = (options) => {
    return `Information about the content to summarize:
    ${options.description}
    
    Editor notes (if applicable, use editor notes to inform the summary or quotes pulled):
    ${options.editorNotes}
    
    IMPORTANT: Make sure to pull the most newsworthy and interesting information.
    
    ###
    ${options.quarterPlace} quarter of the content to summarize:
    ${options.sourceQuarter}`;
};
exports.createQuarterSummaryContentPrompt = createQuarterSummaryContentPrompt;
const createSummaryContentSystemPrompt = (options) => {
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
exports.createSummaryContentSystemPrompt = createSummaryContentSystemPrompt;
const getParsedMessages = (systemMessage, userMessage, options) => {
    systemMessage = (0, sheetHelpers_1.parsePromptDate)(systemMessage);
    systemMessage = (0, sheetHelpers_1.parsePrompt)(systemMessage, options);
    userMessage = (0, sheetHelpers_1.parsePromptDate)(userMessage);
    userMessage = (0, sheetHelpers_1.parsePrompt)(userMessage, options);
    return { systemMessage, userMessage };
};
// ANCHOR pipeline functions
// NOTE - MOST OF THESE ARE THE SAME FUNCTIONS OVER AND OVER AGAIN Q_Q
const summarizeSource = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { source, instructions } = input;
    const quarterLength = source.length / 4;
    const summaries = [];
    for (let i = 1; i <= 4; i++) {
        const sourceQuarter = source.substring(quarterLength * (i - 1), quarterLength * i);
        let quarterPlace = 'first';
        let summaryPrompt = exports.prompts.firstQuarterSummaryPrompt;
        if (i === 2) {
            quarterPlace = 'second';
            summaryPrompt = exports.prompts.secondQuarterSummaryPrompt;
        }
        if (i === 3) {
            quarterPlace = 'third';
            summaryPrompt = exports.prompts.thirdQuarterSummaryPrompt;
        }
        if (i === 4) {
            quarterPlace = 'fourth';
            summaryPrompt = exports.prompts.fourthQuarterSummaryPrompt;
        }
        //summarize quarter via open ai
        const gptResponse = yield (0, exports.sendChatCompletion)({
            messages: [
                { role: enums_1.Role.system, content: summaryPrompt },
                {
                    role: enums_1.Role.user,
                    content: (0, exports.createQuarterSummaryContentPrompt)({
                        description: ' ',
                        editorNotes: instructions,
                        sourceQuarter,
                        quarterPlace,
                    }),
                },
            ],
            maxTokens: 1500,
            temperature: 0.2,
        });
        //push summary to summaries array
        summaries.push(gptResponse.choices[0].message.content);
    }
    // update source with the finalized summary
    const finalSummary = yield (0, exports.sendChatCompletion)({
        messages: [
            {
                role: enums_1.Role.system,
                content: (0, exports.createSummaryContentSystemPrompt)({
                    description: ' ',
                    editorNotes: instructions,
                    source: source,
                    summaries,
                }),
            },
            {
                role: enums_1.Role.user,
                content: `${summaries[0]} ${summaries[1]} ${summaries[2]} ${summaries[3]}`,
            },
        ],
    });
    return JSON.stringify(finalSummary.choices[0].message.content);
});
exports.summarizeSource = summarizeSource;
const factBitsAggregator = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { source, prompt, settings, instructions } = input;
    const options = {
        input: Object.assign(Object.assign({}, instructions), settings),
        source: source,
    };
    const { systemMessage, userMessage } = getParsedMessages(prompt.systemMessage, prompt.userMessage, options);
    const parsedPrompts = { systemMessage, userMessage };
    const gptResponse = yield (0, exports.sendChatCompletion)({
        messages: [
            { role: enums_1.Role.system, content: systemMessage },
            { role: enums_1.Role.user, content: userMessage },
        ],
        maxTokens: parseFloat(prompt.maxTokens),
        temperature: parseFloat(prompt.temperature),
        model: prompt.model !== '' ? prompt.model : undefined,
    });
    return {
        result: JSON.stringify(gptResponse.choices[0].message.content),
        parsedPrompts,
    };
});
exports.factBitsAggregator = factBitsAggregator;
const factsBitSplitting = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { source, prompt, instructions, settings, initialSources } = input;
    const options = {
        input: Object.assign(Object.assign(Object.assign({}, instructions), settings), { noOfBlobs: settings === null || settings === void 0 ? void 0 : settings.blobs }),
        source: source,
        initialSources: initialSources,
    };
    const { systemMessage, userMessage } = getParsedMessages(prompt.systemMessage, prompt.userMessage, options);
    const parsedPrompts = { systemMessage, userMessage };
    const gptResponse = yield (0, exports.sendChatCompletion)({
        messages: [
            { role: enums_1.Role.system, content: systemMessage },
            { role: enums_1.Role.user, content: userMessage },
        ],
        maxTokens: parseFloat(prompt.maxTokens),
        temperature: parseFloat(prompt.temperature),
        model: prompt.model !== '' ? prompt.model : undefined,
    });
    return {
        result: JSON.stringify(gptResponse.choices[0].message.content),
        parsedPrompts,
    };
});
exports.factsBitSplitting = factsBitSplitting;
const paraphrasingFacts = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { source, prompt, stepOutputs, initialSources, settings, instructions } = input;
    const options = {
        input: Object.assign(Object.assign(Object.assign({}, instructions), settings), { noOfBlobs: settings === null || settings === void 0 ? void 0 : settings.blobs }),
        source: source,
        initialSources: initialSources,
        stepOutputs: stepOutputs,
    };
    const { systemMessage, userMessage } = getParsedMessages(prompt.systemMessage, prompt.userMessage, options);
    const parsedPrompts = { systemMessage, userMessage };
    const gptResponse = yield (0, exports.sendChatCompletion)({
        messages: [
            { role: enums_1.Role.system, content: systemMessage },
            { role: enums_1.Role.user, content: userMessage },
        ],
        maxTokens: parseFloat(prompt.maxTokens),
        temperature: parseFloat(prompt.temperature),
        model: prompt.model !== '' ? prompt.model : undefined,
    });
    return {
        result: JSON.stringify(gptResponse.choices[0].message.content),
        parsedPrompts,
    };
});
exports.paraphrasingFacts = paraphrasingFacts;
const articlePrepOne = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { source, settings, instructions, prompt, stepOutputs, initialSources } = input;
    const options = {
        input: Object.assign(Object.assign(Object.assign({}, instructions), settings), { noOfBlobs: settings === null || settings === void 0 ? void 0 : settings.blobs }),
        source: source,
        initialSources: initialSources,
        stepOutputs: stepOutputs,
    };
    const { systemMessage, userMessage } = getParsedMessages(prompt.systemMessage, prompt.userMessage, options);
    const parsedPrompts = { systemMessage, userMessage };
    const gptResponse = yield (0, exports.sendChatCompletion)({
        messages: [
            { role: enums_1.Role.system, content: systemMessage },
            { role: enums_1.Role.user, content: userMessage },
        ],
        maxTokens: parseFloat(prompt.maxTokens),
        temperature: parseFloat(prompt.temperature),
        model: prompt.model !== '' ? prompt.model : undefined,
    });
    return {
        result: JSON.stringify(gptResponse.choices[0].message.content),
        parsedPrompts,
    };
});
exports.articlePrepOne = articlePrepOne;
const headlinesAndBlobs = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { source, settings, instructions, prompt, stepOutputs, initialSources } = input;
    const options = {
        input: Object.assign(Object.assign(Object.assign({}, instructions), settings), { noOfBlobs: settings === null || settings === void 0 ? void 0 : settings.blobs }),
        source: source,
        initialSources: initialSources,
        stepOutputs: stepOutputs,
    };
    const { systemMessage, userMessage } = getParsedMessages(prompt.systemMessage, prompt.userMessage, options);
    const parsedPrompts = { systemMessage, userMessage };
    const gptResponse = yield (0, exports.sendChatCompletion)({
        messages: [
            { role: enums_1.Role.system, content: systemMessage },
            { role: enums_1.Role.user, content: userMessage },
        ],
        maxTokens: parseFloat(prompt.maxTokens),
        temperature: parseFloat(prompt.temperature),
        outputFormat: 'json_object',
        model: prompt.model !== '' ? prompt.model : undefined,
    });
    return {
        result: JSON.stringify(gptResponse.choices[0].message.content),
        parsedPrompts,
    };
});
exports.headlinesAndBlobs = headlinesAndBlobs;
const articlePrepTwo = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { source, settings, instructions, prompt, stepOutputs, initialSources } = input;
    const options = {
        input: Object.assign(Object.assign(Object.assign({}, instructions), settings), { noOfBlobs: settings === null || settings === void 0 ? void 0 : settings.blobs }),
        source: source,
        initialSources: initialSources,
        stepOutputs: stepOutputs,
    };
    const { systemMessage, userMessage } = getParsedMessages(prompt.systemMessage, prompt.userMessage, options);
    const parsedPrompts = { systemMessage, userMessage };
    const gptResponse = yield (0, exports.sendChatCompletion)({
        messages: [
            { role: enums_1.Role.system, content: systemMessage },
            { role: enums_1.Role.user, content: userMessage },
        ],
        maxTokens: parseFloat(prompt.maxTokens),
        temperature: parseFloat(prompt.temperature),
        model: prompt.model !== '' ? prompt.model : undefined,
    });
    return {
        result: JSON.stringify(gptResponse.choices[0].message.content),
        parsedPrompts,
    };
});
exports.articlePrepTwo = articlePrepTwo;
const quotesPicking = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { source, settings, instructions, prompt, stepOutputs, initialSources } = input;
    const options = {
        input: Object.assign(Object.assign(Object.assign({}, instructions), settings), { noOfBlobs: settings === null || settings === void 0 ? void 0 : settings.blobs }),
        source: source,
        initialSources: initialSources,
        stepOutputs: stepOutputs,
    };
    const { systemMessage, userMessage } = getParsedMessages(prompt.systemMessage, prompt.userMessage, options);
    const parsedPrompts = { systemMessage, userMessage };
    const gptResponse = yield (0, exports.sendChatCompletion)({
        messages: [
            { role: enums_1.Role.system, content: systemMessage },
            { role: enums_1.Role.user, content: userMessage },
        ],
        maxTokens: parseFloat(prompt.maxTokens),
        temperature: parseFloat(prompt.temperature),
        model: prompt.model !== '' ? prompt.model : undefined,
    });
    return {
        result: JSON.stringify(gptResponse.choices[0].message.content),
        parsedPrompts,
    };
});
exports.quotesPicking = quotesPicking;
const writing = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { source, instructions, settings, prompt, stepOutputs, initialSources } = input;
    const options = {
        input: Object.assign(Object.assign(Object.assign({}, instructions), settings), { noOfBlobs: settings === null || settings === void 0 ? void 0 : settings.blobs }),
        source: source,
        initialSources: initialSources,
        stepOutputs: stepOutputs,
    };
    const { systemMessage, userMessage } = getParsedMessages(prompt.systemMessage, prompt.userMessage, options);
    const parsedPrompts = { systemMessage, userMessage };
    const gptResponse = yield (0, exports.sendChatCompletion)({
        messages: [
            { role: enums_1.Role.system, content: systemMessage },
            { role: enums_1.Role.user, content: userMessage },
        ],
        maxTokens: parseFloat(prompt.maxTokens),
        temperature: parseFloat(prompt.temperature),
        model: prompt.model !== '' ? prompt.model : undefined,
    });
    return {
        result: JSON.stringify(gptResponse.choices[0].message.content),
        parsedPrompts,
    };
});
exports.writing = writing;
const rewriting = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { source, settings, instructions, prompt, stepOutputs, initialSources } = input;
    const options = {
        input: Object.assign(Object.assign(Object.assign({}, instructions), settings), { noOfBlobs: settings === null || settings === void 0 ? void 0 : settings.blobs }),
        source: source,
        initialSources: initialSources,
        stepOutputs: stepOutputs,
    };
    const { systemMessage, userMessage } = getParsedMessages(prompt.systemMessage, prompt.userMessage, options);
    const parsedPrompts = { systemMessage, userMessage };
    const gptResponse = yield (0, exports.sendChatCompletion)({
        messages: [
            { role: enums_1.Role.system, content: systemMessage },
            { role: enums_1.Role.user, content: userMessage },
        ],
        maxTokens: parseFloat(prompt.maxTokens),
        temperature: parseFloat(prompt.temperature),
        model: prompt.model !== '' ? prompt.model : undefined,
    });
    return {
        result: JSON.stringify(gptResponse.choices[0].message.content),
        parsedPrompts,
    };
});
exports.rewriting = rewriting;
const digestAttribution = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { source, instructions, settings, prompt, stepOutputs, initialSources } = input;
    const options = {
        input: Object.assign(Object.assign(Object.assign({}, instructions), settings), { noOfBlobs: settings === null || settings === void 0 ? void 0 : settings.blobs }),
        source: source,
        initialSources: initialSources,
        stepOutputs: stepOutputs,
    };
    const { systemMessage, userMessage } = getParsedMessages(prompt.systemMessage, prompt.userMessage, options);
    const parsedPrompts = { systemMessage, userMessage };
    const gptResponse = yield (0, exports.sendChatCompletion)({
        messages: [
            { role: enums_1.Role.system, content: systemMessage },
            { role: enums_1.Role.user, content: userMessage },
        ],
        maxTokens: parseFloat(prompt.maxTokens),
        temperature: parseFloat(prompt.temperature),
        model: prompt.model !== '' ? prompt.model : undefined,
    });
    return {
        result: JSON.stringify(gptResponse.choices[0].message.content),
        parsedPrompts,
    };
});
exports.digestAttribution = digestAttribution;
const aggregatorAttribution = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { source, instructions, settings, prompt, stepOutputs, initialSources } = input;
    const options = {
        input: Object.assign(Object.assign(Object.assign({}, instructions), settings), { noOfBlobs: settings === null || settings === void 0 ? void 0 : settings.blobs }),
        source: source,
        initialSources: initialSources,
        stepOutputs: stepOutputs,
    };
    const { systemMessage, userMessage } = getParsedMessages(prompt.systemMessage, prompt.userMessage, options);
    const parsedPrompts = { systemMessage, userMessage };
    const gptResponse = yield (0, exports.sendChatCompletion)({
        messages: [
            { role: enums_1.Role.system, content: systemMessage },
            { role: enums_1.Role.user, content: userMessage },
        ],
        maxTokens: parseFloat(prompt.maxTokens),
        temperature: parseFloat(prompt.temperature),
        model: prompt.model !== '' ? prompt.model : undefined,
    });
    return {
        result: JSON.stringify(gptResponse.choices[0].message.content),
        parsedPrompts,
    };
});
exports.aggregatorAttribution = aggregatorAttribution;
//send request to openAi chat completion endpoint
const sendChatCompletion = (options) => __awaiter(void 0, void 0, void 0, function* () {
    if (!options.model)
        options.model = 'gpt-4-1106-preview';
    if (options.temperature && options.temperature > 2)
        return 'temperature must be less than or equal to 2';
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.openAIKey}`,
    };
    console.log('🌌 data being sent to open ai 🌌:', {
        model: options.model,
        messages: options.messages,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        response_format: {
            type: options.outputFormat ? options.outputFormat : 'text',
        },
    });
    try {
        const response = yield axios_1.default.post('https://api.openai.com/v1/chat/completions', {
            model: options.model,
            messages: options.messages,
            max_tokens: options.maxTokens,
            temperature: options.temperature,
            response_format: {
                type: options.outputFormat ? options.outputFormat : 'text',
            },
        }, { headers });
        return response.data;
    }
    catch (error) {
        console.log('🔴', error, '🔴');
        throw error;
    }
});
exports.sendChatCompletion = sendChatCompletion;
