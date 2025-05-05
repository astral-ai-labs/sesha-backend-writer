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
exports.handler = void 0;
const axios_1 = __importDefault(require("axios"));
const handler = (event) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`----- Received event -----\n${JSON.stringify(event)}`);
    let method = event.requestContext.http.method;
    let body = {};
    //handle preflight - cors issue
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': '*',
                'Access-Control-Allow-Headers': '*',
            },
        };
    }
    if (event.body) {
        body = JSON.parse(event.body);
    }
    try {
        const response = yield axios_1.default.post('https://api.anthropic.com/v1/messages', body, {
            headers: {
                // Put API key in environment variables
                'x-api-key': process.env.ANTHROPIC_API_KEY, // Make sure to replace the placeholder with your actual environment variable
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
        });
        console.log('🐜🐜 anthropic response: ', response.data);
        return {
            statusCode: 200,
            body: JSON.stringify(response.data),
        };
    }
    catch (error) {
        console.error('🐜🐜 anthropic response error: ', error);
        return {
            statusCode: 500,
            body: JSON.stringify(Object.assign({ message: error.message }, (error.response ? { responseData: error.response.data } : {}))),
        };
    }
});
exports.handler = handler;
