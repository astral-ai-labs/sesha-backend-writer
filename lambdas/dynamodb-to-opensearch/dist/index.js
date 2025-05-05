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
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const opensearch_1 = require("@opensearch-project/opensearch");
const handler = (event) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Processing DynamoDB Stream event', JSON.stringify(event, null, 2));
    const opensearchClient = new opensearch_1.Client({
        node: process.env.opensearchDomainEndpoint,
    });
    for (const record of event.Records) {
        if (record && record.dynamodb && record.dynamodb.NewImage) {
            console.log('🎏 Processing record', JSON.stringify(record, null, 2));
            if (record.eventName === 'MODIFY' || record.eventName === 'INSERT') {
                const newImage = aws_sdk_1.default.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
                const document = {
                    headlinesAndBlobs: newImage.headlinesAndBlobs.text,
                    digest: newImage.digest.result,
                    slug: newImage.slug,
                    version: newImage.version,
                };
                try {
                    yield opensearchClient.index({
                        index: `library-index-${process.env.env}`,
                        id: newImage.id,
                        body: document,
                    });
                    console.log('Document indexed successfully', document);
                }
                catch (error) {
                    console.error('Error indexing document', error);
                }
            }
        }
    }
});
exports.handler = handler;
