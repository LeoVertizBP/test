import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import dotenv from 'dotenv';

dotenv.config(); // Ensure environment variables are loaded

// --- Configuration ---
const accessorKeyPath = process.env.GOOGLE_SECRET_MANAGER_CREDENTIALS_PATH; // For READ access (crawler)
const managerKeyPath = process.env.GOOGLE_SECRET_ADDER_CREDENTIALS_PATH;    // For WRITE/MANAGE access (API)
const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;

// --- Validate Configuration ---
let isAccessorClientAvailable = false;
let isManagerClientAvailable = false;

if (!GCLOUD_PROJECT_ID) {
    console.warn("WARN: GCLOUD_PROJECT_ID environment variable not set. Secret Manager functions require it for all authentication methods.");
}
// Warnings for specific key paths will be handled implicitly by the initialization logic below.
// If GCLOUD_PROJECT_ID is set, we will attempt ADC.

// --- Initialize Clients ---
let accessorClient: SecretManagerServiceClient | null = null;
let managerClient: SecretManagerServiceClient | null = null;

if (accessorKeyPath && GCLOUD_PROJECT_ID) {
    try {
        accessorClient = new SecretManagerServiceClient({
            keyFilename: accessorKeyPath,
        });
        console.log("Secret Manager Accessor Client initialized using keyfile.");
        isAccessorClientAvailable = true;
    } catch (error) {
        console.error("Failed to initialize Secret Manager Accessor Client with keyfile:", error);
    }
} else if (GCLOUD_PROJECT_ID) { // Fallback to ADC if no key path, but project ID exists
    try {
        accessorClient = new SecretManagerServiceClient({}); // Initialize without keyFilename to use ADC
        console.log("Secret Manager Accessor Client initialized using Application Default Credentials.");
        isAccessorClientAvailable = true;
    } catch (error) {
        console.error("Failed to initialize Secret Manager Accessor Client with ADC:", error);
    }
} else {
    console.warn("WARN: Secret Manager Accessor Client could not be initialized. GCLOUD_PROJECT_ID is not set, and no specific keyfile path (GOOGLE_SECRET_MANAGER_CREDENTIALS_PATH) was provided.");
}

if (managerKeyPath && GCLOUD_PROJECT_ID) {
    try {
        managerClient = new SecretManagerServiceClient({
            keyFilename: managerKeyPath,
        });
        console.log("Secret Manager Manager Client initialized using keyfile.");
        isManagerClientAvailable = true;
    } catch (error) {
        console.error("Failed to initialize Secret Manager Manager Client with keyfile:", error);
    }
} else if (GCLOUD_PROJECT_ID) { // Fallback to ADC
    try {
        managerClient = new SecretManagerServiceClient({}); // Initialize without keyFilename to use ADC
        console.log("Secret Manager Manager Client initialized using Application Default Credentials.");
        isManagerClientAvailable = true;
    } catch (error) {
        console.error("Failed to initialize Secret Manager Manager Client with ADC:", error);
    }
} else {
    console.warn("WARN: Secret Manager Manager Client could not be initialized. GCLOUD_PROJECT_ID is not set, and no specific keyfile path (GOOGLE_SECRET_ADDER_CREDENTIALS_PATH) was provided.");
}

// --- Helper Functions ---
const buildSecretName = (projectId: string, secretId: string): string => {
    return `projects/${projectId}/secrets/${secretId}`;
};

const buildSecretVersionName = (projectId: string, secretId: string, versionId: string = 'latest'): string => {
    return `projects/${projectId}/secrets/${secretId}/versions/${versionId}`;
};


// --- Service Functions ---

/**
 * Retrieves the value of a secret version. Uses the Accessor client.
 * @param secretId The short ID of the secret (e.g., 'my-db-password').
 * @param versionId The version to access (defaults to 'latest').
 * @returns The secret value as a string, or null if not found or error occurs.
 */
export const getSecret = async (secretId: string, versionId: string = 'latest'): Promise<string | null> => {
    if (!accessorClient || !GCLOUD_PROJECT_ID) {
        console.error("Accessor client or GCLOUD_PROJECT_ID not available for getSecret.");
        throw new Error("Secret Manager accessor not configured properly.");
    }
    const name = buildSecretVersionName(GCLOUD_PROJECT_ID, secretId, versionId);
    console.log(`Accessing secret version: ${name}`);
    try {
        const [version] = await accessorClient.accessSecretVersion({ name });
        const payload = version.payload?.data?.toString();
        if (!payload) {
             console.warn(`No payload data found for secret version ${name}`);
             return null;
        }
        return payload;
    } catch (error: any) {
        console.error(`Failed to access secret version ${name}:`, error.message || error);
        // Handle "not found" specifically? GCP error codes might be useful here.
        return null; // Return null on error for simplicity, or re-throw
    }
};

/**
 * Creates a secret container if it doesn't exist, then adds a new version with the given payload.
 * Uses the Manager client.
 * @param secretId The short ID of the secret to create or update (e.g., 'my-website-login').
 * @param payload The sensitive data to store (e.g., JSON string with username/password).
 * @returns The secretId if successful, null otherwise.
 */
export const createOrUpdateSecret = async (secretId: string, payload: string): Promise<string | null> => {
    if (!managerClient || !GCLOUD_PROJECT_ID) {
        console.error("Manager client or GCLOUD_PROJECT_ID not available for createOrUpdateSecret.");
        throw new Error("Secret Manager manager not configured properly.");
    }
    const secretName = buildSecretName(GCLOUD_PROJECT_ID, secretId);
    console.log(`Creating or updating secret: ${secretId}`);

    try {
        // Try adding a version first (most common case - secret exists)
        console.log(`Attempting to add version to existing secret: ${secretName}`);
        const [addedVersion] = await managerClient.addSecretVersion({
            parent: secretName,
            payload: { data: Buffer.from(payload, 'utf8') },
        });
        console.log(`Added secret version: ${addedVersion.name}`);
        return secretId; // Success
    } catch (error: any) {
        // Check if error is because the secret container doesn't exist (NOT_FOUND, code 5)
        if (error.code === 5) {
            console.log(`Secret container ${secretName} not found, attempting to create...`);
            try {
                // Create the secret container
                const [createdSecret] = await managerClient.createSecret({
                    parent: `projects/${GCLOUD_PROJECT_ID}`,
                    secretId: secretId,
                    secret: { replication: { automatic: {} } }, // Simple replication
                });
                console.log(`Created secret container: ${createdSecret.name}`);

                // Now add the first version to the newly created secret
                const [firstVersion] = await managerClient.addSecretVersion({
                    parent: createdSecret.name!, // Use name from created secret
                    payload: { data: Buffer.from(payload, 'utf8') },
                });
                console.log(`Added first secret version: ${firstVersion.name}`);
                return secretId; // Success
            } catch (createError: any) {
                console.error(`Failed to create secret container or add first version for ${secretId}:`, createError.message || createError);
                return null; // Failure during creation
            }
        } else {
            // Log and re-throw other errors during addSecretVersion
            console.error(`Failed to add secret version to ${secretName}:`, error.message || error);
            throw error; // Or return null
        }
    }
};


/**
 * Deletes a secret container and all its versions. Use with caution!
 * Uses the Manager client.
 * @param secretId The short ID of the secret to delete.
 */
export const deleteSecret = async (secretId: string): Promise<void> => {
    if (!managerClient || !GCLOUD_PROJECT_ID) {
        console.error("Manager client or GCLOUD_PROJECT_ID not available for deleteSecret.");
        throw new Error("Secret Manager manager not configured properly.");
    }
    const name = buildSecretName(GCLOUD_PROJECT_ID, secretId);
    console.log(`Attempting to delete secret container: ${name}`);
    try {
        await managerClient.deleteSecret({ name });
        console.log(`Deleted secret container ${name}`);
    } catch (error: any) {
        // Handle "not found" gracefully - if it doesn't exist, it's already deleted.
        if (error.code === 5) {
             console.log(`Secret container ${name} not found, considered deleted.`);
             return;
        }
        console.error(`Failed to delete secret container ${name}:`, error.message || error);
        throw error; // Re-throw other errors
    }
};
