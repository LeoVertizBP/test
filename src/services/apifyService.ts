import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

if (!APIFY_API_TOKEN) {
  console.warn('APIFY_API_TOKEN environment variable is not set. APIFY functionality will be disabled.');
  // Optionally throw an error if APIFY is critical:
  // throw new Error('APIFY_API_TOKEN environment variable is required');
}

// Initialize the ApifyClient with token from environment variables
// We only initialize if the token exists to avoid errors during startup if it's not yet configured.
const apifyClient = APIFY_API_TOKEN ? new ApifyClient({ token: APIFY_API_TOKEN }) : null;

/**
 * Runs a specific Apify Actor (scraper).
 * @param actorId The ID or name of the Actor to run (e.g., 'apify/instagram-scraper').
 * @param runInput The input object for the Actor run.
 * @returns The unique ID of the started Actor run.
 */
export const runApifyActor = async (actorId: string, runInput: any): Promise<string> => {
  if (!apifyClient) {
    throw new Error('Apify client is not initialized. Check APIFY_API_TOKEN.');
  }

  console.log(`Starting Apify actor ${actorId} with input:`, runInput);
  try {
    const run = await apifyClient.actor(actorId).start(runInput, {
      // Optional: Set memory, timeout, build etc.
      // memory: 512,
      // timeout: 300, // seconds
    });
    console.log(`Apify actor run started: ${run.id}`);
    return run.id; // Return only the run ID
  } catch (error) {
    console.error(`Error starting Apify actor ${actorId}:`, error);
    throw error; // Re-throw the error to be handled by the caller
  }
};

/**
 * Retrieves the results dataset from a completed Apify Actor run.
 * @param runId The ID of the Actor run.
 * @returns The items from the dataset.
 */
export const getApifyRunResults = async (runId: string) => {
  if (!apifyClient) {
    throw new Error('Apify client is not initialized. Check APIFY_API_TOKEN.');
  }

  console.log(`Fetching results for Apify run ${runId}`);
  try {
    // Get the run details first to find the correct dataset ID
    const runDetails = await apifyClient.run(runId).get();
    if (!runDetails || !runDetails.defaultDatasetId) {
        throw new Error(`Could not find default dataset ID for run ${runId}`);
    }
    const datasetId = runDetails.defaultDatasetId;
    console.log(`Found dataset ID ${datasetId} for run ${runId}`);

    // Use the correct dataset ID to fetch items
    const datasetClient = apifyClient.dataset(datasetId);
    const { items } = await datasetClient.listItems();
    console.log(`Retrieved ${items.length} items from dataset ${datasetId} (run ${runId})`);
    return items;
  } catch (error) {
    console.error(`Error fetching results for Apify run ${runId}:`, error);
    throw error;
  }
};

// Add more functions as needed, e.g., checking run status, getting logs, etc.

/**
 * Checks the status of an Apify Actor run.
 * @param runId The ID of the Actor run.
 * @returns The run object containing status and other details.
 */
export const checkApifyRunStatus = async (runId: string) => {
    if (!apifyClient) {
        throw new Error('Apify client is not initialized. Check APIFY_API_TOKEN.');
    }

    console.log(`Checking status for Apify run ${runId}`);
    try {
        const run = await apifyClient.run(runId).get();
        console.log(`Status for run ${runId}: ${run?.status}`);
        return run; // Returns the full run object (includes status like SUCCEEDED, FAILED, RUNNING)
    } catch (error) {
        console.error(`Error checking status for Apify run ${runId}:`, error);
        throw error;
    }
};

/**
 * Fetches the content of a record from an Apify Key-Value Store using its URL.
 * Assumes the URL format is like: https://api.apify.com/v2/key-value-stores/{storeId}/records/{recordKey}
 * @param recordUrl The direct URL to the Key-Value Store record.
 * @returns The content of the record (likely string), or null if fetching fails or URL is invalid.
 */
export const getApifyKeyValueStoreRecordContent = async (recordUrl: string): Promise<string | null> => {
    console.log(`[KVS Fetch] Attempting to fetch content from Apify KVS URL: ${recordUrl}`); // Added log prefix
    if (!apifyClient) {
        console.error('[KVS Fetch] Apify client is not initialized. Cannot fetch KVS record.'); // Added log prefix
        return null;
    }
    if (!recordUrl) {
        console.warn('[KVS Fetch] No record URL provided.'); // Added log prefix
        return null;
    }

    // console.log(`Attempting to fetch content from Apify KVS URL: ${recordUrl}`); // Redundant log removed

    try {
        console.log('[KVS Fetch] Parsing URL...'); // Added log
        // Basic parsing to extract storeId and recordKey from the URL
        // Example URL: https://api.apify.com/v2/key-value-stores/N2ZMeYMg2gA70fGYJ/records/subtitles_aqEt9XZIeE4_en_auto_generated
        const urlParts = recordUrl.split('/');
        const recordsIndex = urlParts.indexOf('records');
        const storesIndex = urlParts.indexOf('key-value-stores');

        if (storesIndex === -1 || recordsIndex === -1 || recordsIndex !== storesIndex + 2 || urlParts.length <= recordsIndex + 1) {
            console.error(`[KVS Fetch] Invalid Apify KVS record URL format: ${recordUrl}`); // Added log
            throw new Error(`Invalid Apify KVS record URL format: ${recordUrl}`);
        }

        const storeId = urlParts[storesIndex + 1];
        const recordKey = urlParts[recordsIndex + 1]; // Assumes key doesn't contain '/'

        if (!storeId || !recordKey) {
             console.error(`[KVS Fetch] Could not parse storeId or recordKey from URL: ${recordUrl}`); // Added log
             throw new Error(`Could not parse storeId or recordKey from URL: ${recordUrl}`);
        }

        console.log(`[KVS Fetch] Parsed KVS details - Store ID: ${storeId}, Record Key: ${recordKey}`); // Added log prefix

        // Use the Apify client to get the record
        console.log(`[KVS Fetch] Calling apifyClient.keyValueStore(${storeId}).getRecord(${recordKey})...`); // Added log
        const record = await apifyClient.keyValueStore(storeId).getRecord(recordKey);
        console.log('[KVS Fetch] Call to getRecord completed.'); // Added log

        if (!record) {
            console.warn(`[KVS Fetch] Record not found in KVS - Store ID: ${storeId}, Record Key: ${recordKey}`); // Added log prefix
            return null;
        } else {
            console.log(`[KVS Fetch] Record found. Type of record.value: ${typeof record.value}`); // Added log
        }

        // Assuming the record value is the content we want (e.g., SRT string)
        // The actual content might be nested depending on how the actor saved it.
        // Adjust if necessary based on actual record structure.
        // For SRT, it's usually the direct value.
        const content = record.value;

        // Check if content is a string (or buffer, etc., adjust as needed)
        if (typeof content === 'string') {
            console.log(`[KVS Fetch] Successfully fetched KVS record content as string (length: ${content.length}) for key ${recordKey}`);
            return content;
        } else if (Buffer.isBuffer(content)) {
             console.log(`[KVS Fetch] Successfully fetched KVS record content as Buffer (length: ${content.length}) for key ${recordKey}. Converting to UTF-8 string.`);
             return content.toString('utf-8');
        } else if (content !== null && typeof content === 'object') {
            // Handle object type - look for common properties that might contain the SRT text
            console.log(`[KVS Fetch] Record is an object. Looking for SRT content in properties...`);
            console.log(`[KVS Fetch] Object structure:`, JSON.stringify(content).substring(0, 500)); // Log the structure

            const contentObj = content as Record<string, unknown>;

            // Prioritize 'subtitles' key based on observed KVS structure for YouTube SRTs
            if ('subtitles' in contentObj && typeof contentObj.subtitles === 'string') {
                console.log(`[KVS Fetch] Found 'subtitles' property with string content (length: ${(contentObj.subtitles as string).length})`);
                return contentObj.subtitles as string;
            }
            // Fallback to checking 'srt' key
            else if ('srt' in contentObj && typeof contentObj.srt === 'string') {
                console.log(`[KVS Fetch] Found 'srt' property with string content (length: ${(contentObj.srt as string).length})`);
                return contentObj.srt as string;
            }
            // Fallback to checking other common property names if neither 'subtitles' nor 'srt' is found
            else {
                const possibleProperties = ['content', 'text', 'subtitle', 'value', 'data']; // Removed 'subtitles' and 'srt' as they were checked
                for (const prop of possibleProperties) {
                    if (prop in contentObj && typeof contentObj[prop] === 'string') {
                        const stringValue = contentObj[prop] as string; // Define stringValue here
                        console.log(`[KVS Fetch] Found string content in fallback object property '${prop}' (length: ${stringValue.length})`);
                        return stringValue; // Return the found stringValue
                    }
                }
                // If no suitable string property found after checking fallbacks
                console.log(`[KVS Fetch] No suitable string property ('subtitles', 'srt', or fallbacks) found in object. Converting entire object to JSON string.`);
                return JSON.stringify(content);
            }
        } else {
             // Handle cases where content is not a string, Buffer, or recognizable object
            console.warn(`[KVS Fetch] KVS record content for key ${recordKey} is not a string, Buffer, or processable object. Type: ${typeof content}. Value:`, content);
            return null;
        }

    } catch (error: unknown) { // Explicitly type error as unknown
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Log the error with more context
        console.error(`[KVS Fetch] Error fetching or parsing Apify KVS record from URL ${recordUrl}. Error: ${errorMessage}`, error); // Added log prefix and full error object
        return null; // Return null on any error
    }
};
