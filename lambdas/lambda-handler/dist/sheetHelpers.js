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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePrompt = exports.parseInitialSources = exports.parseStepOutput = exports.parseSourceInput = exports.parseInputSettings = exports.parsePromptDate = exports.getRawPrompts = exports.readSpreadsheet = void 0;
const google_auth_library_1 = require("google-auth-library");
const sheets_1 = require("@googleapis/sheets");
const spreadsheetId = process.env.promptSheetId;
// Function to read data from Google Spreadsheet
function readSpreadsheet(sheet) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        // Configure a JWT auth client
        const jwtClient = new google_auth_library_1.JWT(process.env.googleServiceAccountEmail, undefined, '-----BEGIN PRIVATE KEY-----' +
            ((_a = process.env.googleServiceAccountPrivateKey) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, '\n')) +
            '-----END PRIVATE KEY-----\n', ['https://www.googleapis.com/auth/spreadsheets.readonly']);
        // Authenticate request
        yield jwtClient.authorize();
        // Google Sheets API
        const sheets = (0, sheets_1.sheets)({ version: 'v4', auth: jwtClient });
        try {
            // Specify the spreadsheet ID and range
            const range = sheet; // Adjust as needed
            // Read data from the spreadsheet
            const response = yield sheets.spreadsheets.values.get({
                spreadsheetId,
                range,
            });
            // Output the rows
            return response.data.values;
        }
        catch (error) {
            return error;
        }
    });
}
exports.readSpreadsheet = readSpreadsheet;
//function which reads the entire sheet and maps out and object for the cells on the basis of the step title
const getRawPrompts = (type) => __awaiter(void 0, void 0, void 0, function* () {
    const prompts = {};
    let sheetData;
    sheetData = yield readSpreadsheet(type);
    if (!sheetData)
        return;
    const rows = sheetData;
    if (!rows || rows.length === 0)
        return;
    // Extracting the header row to create a mapping of column names to their indexes
    const headers = rows[0];
    const columnIndex = headers.reduce((acc, name, index) => {
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
                temperature: row[columnIndex['temperature']],
                maxTokens: row[columnIndex['maxTokens']],
                model: row[columnIndex['model']],
            };
        }
    }
    return prompts;
});
exports.getRawPrompts = getRawPrompts;
//ANCHOR - prompt parsers
const parsePromptDate = (prompt) => {
    return prompt.replace('{date}', new Date().toLocaleDateString());
};
exports.parsePromptDate = parsePromptDate;
const parseInputSettings = (prompt, inputSettings) => {
    return prompt.replace(/\{input\.([^}]+)\}/g, (match, key) => {
        return inputSettings.hasOwnProperty(key) ? inputSettings[key] : match;
    });
};
exports.parseInputSettings = parseInputSettings;
const parseSourceInput = (prompt, source) => {
    return prompt.replace(/\{source\.([^}]+)\}/g, (match, key) => {
        return source.hasOwnProperty(key) ? source[key] : match;
    });
};
exports.parseSourceInput = parseSourceInput;
const parseStepOutput = (prompt, stepOutputs) => {
    return prompt.replace(/\{stepOutputs\.([^}]+)\}/g, (match, key) => {
        return stepOutputs.hasOwnProperty(key) ? stepOutputs[key] : match;
    });
};
exports.parseStepOutput = parseStepOutput;
const parseInitialSources = (prompt, initialSources) => {
    return prompt.replace(/\{initialSources\[(\d+)\]\.([^}.]+)\}/g, (match, index, prop) => {
        var _a;
        const sourceIndex = parseInt(index, 10);
        if (sourceIndex < initialSources.length && ((_a = initialSources[sourceIndex]) === null || _a === void 0 ? void 0 : _a.hasOwnProperty(prop))) {
            return initialSources[sourceIndex][prop];
        }
        return match;
    });
};
exports.parseInitialSources = parseInitialSources;
const parsePrompt = (inputString, options) => {
    console.log('🔠 input string: ', inputString);
    console.log('🤚 if statement options: ', options);
    // Function to resolve a value from the options
    const resolveValue = (keyOrValue) => {
        if (keyOrValue && keyOrValue.includes('.')) {
            const keys = keyOrValue.split(/\.|\[|\]/).filter(Boolean);
            return keys.reduce((acc, key) => (acc && !isNaN(key) ? acc[Number(key)] : acc && acc[key]), options);
        }
        return keyOrValue && !isNaN(keyOrValue) ? Number(keyOrValue) : keyOrValue;
    };
    // Function to parse placeholders in a string
    const parsePlaceholders = (content) => content.replace(/{([^}]+)}/g, (_, key) => { var _a; return (_a = resolveValue(key)) !== null && _a !== void 0 ? _a : _; });
    // Function to perform comparison
    const performComparison = (value, operator, comparisonValue) => {
        switch (operator) {
            case '==':
                return value == comparisonValue;
            case '>':
                return value > comparisonValue;
            case '<':
                return value < comparisonValue;
            default:
                return false;
        }
    };
    // Function to evaluate if conditions
    const evaluateIfConditions = (content) => content.replace(/{if ([^}<>\s]+)\s*(==|>|<)?\s*([^}]*)?}([\s\S]*?){endIf}/g, (_, keysString, operator, comparisonValueString, ifContent) => {
        const value = resolveValue(keysString);
        const comparisonValue = operator ? resolveValue(comparisonValueString) : null;
        const conditionMet = operator ? performComparison(value, operator, comparisonValue) : Boolean(value);
        return conditionMet ? parsePlaceholders(ifContent) : '';
    });
    // Parse if conditions and then parse the rest of the placeholders
    return parsePlaceholders(evaluateIfConditions(inputString));
};
exports.parsePrompt = parsePrompt;
