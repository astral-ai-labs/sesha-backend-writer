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
exports.handler = void 0;
//this lambda will be directly invoked via lambda-handler
const handler = (event) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`----- Received event -----\n${JSON.stringify(event)}`);
    let body = event.body;
    let path = event.path;
    // Define the handlers for different paths
    switch (path) {
        case `/create-mapping`:
        case `/create-mapping/`:
            return yield searchFunctions.createMapping(body);
        case `/create-entry`:
        case `/create-entry/`:
            return yield searchFunctions.createEntry(body);
        case `/search`:
        case `/search/`:
            return yield searchFunctions.createEntry(body);
        default:
            return helperFunctions.createResponse(404, JSON.stringify({ error: path + ' Not Found' }));
    }
});
exports.handler = handler;
const helperFunctions = {
    createResponse: (statusCode, body) => {
        return {
            statusCode: statusCode,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body,
        };
    },
};
const searchFunctions = {
    createMapping: (body) => __awaiter(void 0, void 0, void 0, function* () { }), // implement this
    createEntry: (body) => __awaiter(void 0, void 0, void 0, function* () { }), // implement this
    search: (body) => __awaiter(void 0, void 0, void 0, function* () { }), // implement this
};
