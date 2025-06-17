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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApifyKeyValueStoreRecordContent = exports.checkApifyRunStatus = exports.getApifyRunResults = exports.runApifyActor = void 0;
var apify_client_1 = require("apify-client");
var dotenv = require("dotenv");
dotenv.config(); // Load environment variables from .env file
var APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
if (!APIFY_API_TOKEN) {
    console.warn('APIFY_API_TOKEN environment variable is not set. APIFY functionality will be disabled.');
    // Optionally throw an error if APIFY is critical:
    // throw new Error('APIFY_API_TOKEN environment variable is required');
}
// Initialize the ApifyClient with token from environment variables
// We only initialize if the token exists to avoid errors during startup if it's not yet configured.
var apifyClient = APIFY_API_TOKEN ? new apify_client_1.ApifyClient({ token: APIFY_API_TOKEN }) : null;
/**
 * Runs a specific Apify Actor (scraper).
 * @param actorId The ID or name of the Actor to run (e.g., 'apify/instagram-scraper').
 * @param runInput The input object for the Actor run.
 * @returns The unique ID of the started Actor run.
 */
var runApifyActor = function (actorId, runInput) { return __awaiter(void 0, void 0, void 0, function () {
    var run, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!apifyClient) {
                    throw new Error('Apify client is not initialized. Check APIFY_API_TOKEN.');
                }
                console.log("Starting Apify actor ".concat(actorId, " with input:"), runInput);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, apifyClient.actor(actorId).start(runInput, {
                    // Optional: Set memory, timeout, build etc.
                    // memory: 512,
                    // timeout: 300, // seconds
                    })];
            case 2:
                run = _a.sent();
                console.log("Apify actor run started: ".concat(run.id));
                return [2 /*return*/, run.id]; // Return only the run ID
            case 3:
                error_1 = _a.sent();
                console.error("Error starting Apify actor ".concat(actorId, ":"), error_1);
                throw error_1; // Re-throw the error to be handled by the caller
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.runApifyActor = runApifyActor;
/**
 * Retrieves the results dataset from a completed Apify Actor run.
 * @param runId The ID of the Actor run.
 * @returns The items from the dataset.
 */
var getApifyRunResults = function (runId) { return __awaiter(void 0, void 0, void 0, function () {
    var runDetails, datasetId, datasetClient, items, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!apifyClient) {
                    throw new Error('Apify client is not initialized. Check APIFY_API_TOKEN.');
                }
                console.log("Fetching results for Apify run ".concat(runId));
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                return [4 /*yield*/, apifyClient.run(runId).get()];
            case 2:
                runDetails = _a.sent();
                if (!runDetails || !runDetails.defaultDatasetId) {
                    throw new Error("Could not find default dataset ID for run ".concat(runId));
                }
                datasetId = runDetails.defaultDatasetId;
                console.log("Found dataset ID ".concat(datasetId, " for run ").concat(runId));
                datasetClient = apifyClient.dataset(datasetId);
                return [4 /*yield*/, datasetClient.listItems()];
            case 3:
                items = (_a.sent()).items;
                console.log("Retrieved ".concat(items.length, " items from dataset ").concat(datasetId, " (run ").concat(runId, ")"));
                return [2 /*return*/, items];
            case 4:
                error_2 = _a.sent();
                console.error("Error fetching results for Apify run ".concat(runId, ":"), error_2);
                throw error_2;
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.getApifyRunResults = getApifyRunResults;
// Add more functions as needed, e.g., checking run status, getting logs, etc.
/**
 * Checks the status of an Apify Actor run.
 * @param runId The ID of the Actor run.
 * @returns The run object containing status and other details.
 */
var checkApifyRunStatus = function (runId) { return __awaiter(void 0, void 0, void 0, function () {
    var run, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!apifyClient) {
                    throw new Error('Apify client is not initialized. Check APIFY_API_TOKEN.');
                }
                console.log("Checking status for Apify run ".concat(runId));
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, apifyClient.run(runId).get()];
            case 2:
                run = _a.sent();
                console.log("Status for run ".concat(runId, ": ").concat(run === null || run === void 0 ? void 0 : run.status));
                return [2 /*return*/, run]; // Returns the full run object (includes status like SUCCEEDED, FAILED, RUNNING)
            case 3:
                error_3 = _a.sent();
                console.error("Error checking status for Apify run ".concat(runId, ":"), error_3);
                throw error_3;
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.checkApifyRunStatus = checkApifyRunStatus;
/**
 * Fetches the content of a record from an Apify Key-Value Store using its URL.
 * Assumes the URL format is like: https://api.apify.com/v2/key-value-stores/{storeId}/records/{recordKey}
 * @param recordUrl The direct URL to the Key-Value Store record.
 * @returns The content of the record (likely string), or null if fetching fails or URL is invalid.
 */
var getApifyKeyValueStoreRecordContent = function (recordUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var urlParts, recordsIndex, storesIndex, storeId, recordKey, record, content, contentObj, possibleProperties, _i, possibleProperties_1, prop, stringValue, error_4, errorMessage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("[KVS Fetch] Attempting to fetch content from Apify KVS URL: ".concat(recordUrl)); // Added log prefix
                if (!apifyClient) {
                    console.error('[KVS Fetch] Apify client is not initialized. Cannot fetch KVS record.'); // Added log prefix
                    return [2 /*return*/, null];
                }
                if (!recordUrl) {
                    console.warn('[KVS Fetch] No record URL provided.'); // Added log prefix
                    return [2 /*return*/, null];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                console.log('[KVS Fetch] Parsing URL...'); // Added log
                urlParts = recordUrl.split('/');
                recordsIndex = urlParts.indexOf('records');
                storesIndex = urlParts.indexOf('key-value-stores');
                if (storesIndex === -1 || recordsIndex === -1 || recordsIndex !== storesIndex + 2 || urlParts.length <= recordsIndex + 1) {
                    console.error("[KVS Fetch] Invalid Apify KVS record URL format: ".concat(recordUrl)); // Added log
                    throw new Error("Invalid Apify KVS record URL format: ".concat(recordUrl));
                }
                storeId = urlParts[storesIndex + 1];
                recordKey = urlParts[recordsIndex + 1];
                if (!storeId || !recordKey) {
                    console.error("[KVS Fetch] Could not parse storeId or recordKey from URL: ".concat(recordUrl)); // Added log
                    throw new Error("Could not parse storeId or recordKey from URL: ".concat(recordUrl));
                }
                console.log("[KVS Fetch] Parsed KVS details - Store ID: ".concat(storeId, ", Record Key: ").concat(recordKey)); // Added log prefix
                // Use the Apify client to get the record
                console.log("[KVS Fetch] Calling apifyClient.keyValueStore(".concat(storeId, ").getRecord(").concat(recordKey, ")...")); // Added log
                return [4 /*yield*/, apifyClient.keyValueStore(storeId).getRecord(recordKey)];
            case 2:
                record = _a.sent();
                console.log('[KVS Fetch] Call to getRecord completed.'); // Added log
                if (!record) {
                    console.warn("[KVS Fetch] Record not found in KVS - Store ID: ".concat(storeId, ", Record Key: ").concat(recordKey)); // Added log prefix
                    return [2 /*return*/, null];
                }
                else {
                    console.log("[KVS Fetch] Record found. Type of record.value: ".concat(typeof record.value)); // Added log
                }
                content = record.value;
                // Check if content is a string (or buffer, etc., adjust as needed)
                if (typeof content === 'string') {
                    console.log("[KVS Fetch] Successfully fetched KVS record content as string (length: ".concat(content.length, ") for key ").concat(recordKey));
                    return [2 /*return*/, content];
                }
                else if (Buffer.isBuffer(content)) {
                    console.log("[KVS Fetch] Successfully fetched KVS record content as Buffer (length: ".concat(content.length, ") for key ").concat(recordKey, ". Converting to UTF-8 string."));
                    return [2 /*return*/, content.toString('utf-8')];
                }
                else if (content !== null && typeof content === 'object') {
                    // Handle object type - look for common properties that might contain the SRT text
                    console.log("[KVS Fetch] Record is an object. Looking for SRT content in properties...");
                    console.log("[KVS Fetch] Object structure:", JSON.stringify(content).substring(0, 500)); // Log the structure
                    contentObj = content;
                    // Prioritize 'subtitles' key based on observed KVS structure for YouTube SRTs
                    if ('subtitles' in contentObj && typeof contentObj.subtitles === 'string') {
                        console.log("[KVS Fetch] Found 'subtitles' property with string content (length: ".concat(contentObj.subtitles.length, ")"));
                        return [2 /*return*/, contentObj.subtitles];
                    }
                    // Fallback to checking 'srt' key
                    else if ('srt' in contentObj && typeof contentObj.srt === 'string') {
                        console.log("[KVS Fetch] Found 'srt' property with string content (length: ".concat(contentObj.srt.length, ")"));
                        return [2 /*return*/, contentObj.srt];
                    }
                    // Fallback to checking other common property names if neither 'subtitles' nor 'srt' is found
                    else {
                        possibleProperties = ['content', 'text', 'subtitle', 'value', 'data'];
                        for (_i = 0, possibleProperties_1 = possibleProperties; _i < possibleProperties_1.length; _i++) {
                            prop = possibleProperties_1[_i];
                            if (prop in contentObj && typeof contentObj[prop] === 'string') {
                                stringValue = contentObj[prop];
                                console.log("[KVS Fetch] Found string content in fallback object property '".concat(prop, "' (length: ").concat(stringValue.length, ")"));
                                return [2 /*return*/, stringValue]; // Return the found stringValue
                            }
                        }
                        // If no suitable string property found after checking fallbacks
                        console.log("[KVS Fetch] No suitable string property ('subtitles', 'srt', or fallbacks) found in object. Converting entire object to JSON string.");
                        return [2 /*return*/, JSON.stringify(content)];
                    }
                }
                else {
                    // Handle cases where content is not a string, Buffer, or recognizable object
                    console.warn("[KVS Fetch] KVS record content for key ".concat(recordKey, " is not a string, Buffer, or processable object. Type: ").concat(typeof content, ". Value:"), content);
                    return [2 /*return*/, null];
                }
                return [3 /*break*/, 4];
            case 3:
                error_4 = _a.sent();
                errorMessage = error_4 instanceof Error ? error_4.message : String(error_4);
                // Log the error with more context
                console.error("[KVS Fetch] Error fetching or parsing Apify KVS record from URL ".concat(recordUrl, ". Error: ").concat(errorMessage), error_4); // Added log prefix and full error object
                return [2 /*return*/, null]; // Return null on any error
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.getApifyKeyValueStoreRecordContent = getApifyKeyValueStoreRecordContent;
