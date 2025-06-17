import { Storage, CreateWriteStreamOptions } from '@google-cloud/storage';
import dotenv from 'dotenv';
import path from 'path';
import { Readable } from 'stream';
import * as logger from '../utils/logUtil'; // Correct relative path to utils directory
import prisma from '../utils/prismaClient'; // Import prisma client

dotenv.config(); // Load environment variables from .env file

const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;
// GOOGLE_APPLICATION_CREDENTIALS env var should point to the key file path *inside the container*
// as mounted by docker-compose.yml
const GCS_CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS; 


const MODULE_NAME = 'GcsService';
let storage: Storage | null = null;
let bucketName: string | null = null;

// Initialize storage if bucket name is set
if (GCS_BUCKET_NAME) {
  try {
    // If GCS_CREDENTIALS_PATH (process.env.GOOGLE_APPLICATION_CREDENTIALS) is set,
    // new Storage() will use it. Otherwise, it will use ADC.
    storage = new Storage(); 
    bucketName = GCS_BUCKET_NAME;
    if (GCS_CREDENTIALS_PATH) {
        logger.info(MODULE_NAME, `Google Cloud Storage initialized for bucket: ${bucketName} using credentials from GOOGLE_APPLICATION_CREDENTIALS.`);
    } else {
        logger.info(MODULE_NAME, `Google Cloud Storage initialized for bucket: ${bucketName} using Application Default Credentials.`);
    }
  } catch (error: any) {
    logger.error(MODULE_NAME, 'Error initializing Google Cloud Storage', error);
    storage = null; // Ensure storage is null if initialization fails
  }
} else {
  // Only warn if GCS_BUCKET_NAME is not set, as it's essential.
  logger.warn(MODULE_NAME, 'GCS_BUCKET_NAME environment variable is not set. Google Cloud Storage functionality will be disabled.');
}

/**
 * Uploads a file stream to Google Cloud Storage with specified metadata and cache control.
 * @param sourceStream A readable stream containing the file content.
 * @param destinationFileName The desired name for the file in the GCS bucket (e.g., 'frames/org123/vid1_10.png').
 * @param contentType The MIME type of the file (e.g., 'image/png').
 * @param customMetadata Optional key-value pairs for custom metadata (e.g., { sha256: '...', captured_at: '...' }).
 * @param cacheControl Optional Cache-Control header value (defaults to 'public, max-age=31536000, immutable').
 * @returns The public URL of the uploaded file.
 */
export const uploadStreamToGCS = async (
  sourceStream: Readable,
  destinationFileName: string,
  contentType: string,
  customMetadata?: { [key: string]: string },
  cacheControl: string = 'public, max-age=31536000, immutable' // Default cache control for screenshots
): Promise<string> => {
  if (!storage || !bucketName) {
    throw new Error('Google Cloud Storage is not initialized. Check configuration.');
  }

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(destinationFileName);

  logger.info(MODULE_NAME, `Uploading ${destinationFileName} to GCS bucket ${bucketName}...`);

  const writeStreamOptions: CreateWriteStreamOptions = {
    metadata: {
      contentType: contentType,
      cacheControl: cacheControl, // Set cache control
      metadata: customMetadata // Add custom metadata here
    },
    // Assuming files should be private by default unless explicitly made public
    // public: false,
    resumable: false, // Use simple upload for smaller files/streams like screenshots
  };

  return new Promise((resolve, reject) => {
    const writeStream = file.createWriteStream(writeStreamOptions);

    sourceStream.pipe(writeStream)
      .on('error', (error) => {
        logger.error(MODULE_NAME, `Error uploading ${destinationFileName} to GCS`, error);
        reject(error);
      })
      .on('finish', async () => {
        logger.info(MODULE_NAME, `${destinationFileName} uploaded successfully to GCS.`);
        // Files are private by default based on bucket settings.
        // If public access is needed, manage permissions separately or set `public: true` in options.

        // Construct the standard HTTPS URL
        // Note: This URL might not be publicly accessible depending on bucket/object ACLs
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${destinationFileName}`;
        resolve(publicUrl);
      });
  });
};

/**
 * Checks if a file exists in the GCS bucket.
 * @param destinationFileName The name of the file in the GCS bucket.
 * @returns A Promise resolving to true if the file exists, false otherwise.
 */
export const checkFileExists = async (destinationFileName: string): Promise<boolean> => {
    if (!storage || !bucketName) {
        logger.warn(MODULE_NAME, 'GCS not initialized, cannot check file existence.');
        return false; // Or throw error? Returning false seems safer.
    }

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(destinationFileName);

    try {
        const [exists] = await file.exists();
        logger.debug(MODULE_NAME, `Checked existence for ${destinationFileName}: ${exists}`);
        return exists;
    } catch (error) {
        logger.error(MODULE_NAME, `Error checking existence for ${destinationFileName}`, error);
        return false; // Assume not exists on error
    }
};

/**
 * Helper function to convert a Buffer into a Readable stream.
 * @param buffer The buffer containing the data.
 * @returns A Readable stream.
 */
const bufferToStream = (buffer: Buffer): Readable => {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null); // Signal end of stream
  return stream;
};

/**
 * Uploads a buffer (e.g., image data) to Google Cloud Storage with metadata and cache control.
 * @param buffer The buffer containing the file content.
 * @param destinationFileName The desired name for the file in the GCS bucket.
 * @param contentType The MIME type of the file.
 * @param customMetadata Optional key-value pairs for custom metadata.
 * @param cacheControl Optional Cache-Control header value.
 * @returns The public URL of the uploaded file.
 */
export const uploadBufferToGCS = async (
  buffer: Buffer,
  destinationFileName: string,
  contentType: string,
  customMetadata?: { [key: string]: string },
  cacheControl?: string
): Promise<string> => {
  const stream = bufferToStream(buffer);
  // Pass metadata and cacheControl through
  return uploadStreamToGCS(stream, destinationFileName, contentType, customMetadata, cacheControl);
};

/**
 * Downloads a file from Google Cloud Storage as a Buffer.
 * @param gcsFilePath The path to the file within the GCS bucket (e.g., 'images/profile.jpg').
 * @returns A Promise that resolves with the file content as a Buffer.
 */
export const downloadFileFromGCSAsBuffer = async (
  gcsFilePath: string
): Promise<Buffer> => {
  if (!storage || !bucketName) {
    throw new Error('Google Cloud Storage is not initialized. Check configuration.');
  }

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(gcsFilePath);

  logger.info(MODULE_NAME, `Downloading ${gcsFilePath} from GCS bucket ${bucketName}...`);

  try {
    // The download method returns an array where the first element is the buffer
    const [buffer] = await file.download();
    logger.info(MODULE_NAME, `${gcsFilePath} downloaded successfully.`);
    return buffer;
  } catch (error: any) {
    logger.error(MODULE_NAME, `Error downloading ${gcsFilePath} from GCS`, error);
    // Rethrow the error or handle it as needed
    // Check for common errors like 'Not Found'
    if (error.code === 404) {
        throw new Error(`File not found in GCS: ${gcsFilePath}`);
    }
    throw new Error(`Failed to download file from GCS: ${gcsFilePath}. Reason: ${error.message}`);
  }
};

/**
 * Converts a standard GCS HTTPS URL to a GCS URI (gs://...).
 * @param httpsUrl The HTTPS URL (e.g., https://storage.googleapis.com/bucket-name/path/to/file.ext).
 * @returns The GCS URI (e.g., gs://bucket-name/path/to/file.ext) or null if conversion fails.
 */
export const getGcsUriFromHttpsUrl = (httpsUrl: string): string | null => {
  try {
    const url = new URL(httpsUrl);
    if (url.hostname !== 'storage.googleapis.com') {
      logger.warn(MODULE_NAME, `URL ${httpsUrl} is not a standard GCS HTTPS URL.`);
      return null;
    }
    // Pathname usually starts with '/', so remove it. Then the first part is the bucket name.
    const pathParts = url.pathname.substring(1).split('/');
    const bucket = pathParts.shift(); // Remove the first part (bucket name)
    if (!bucket) {
      logger.warn(MODULE_NAME, `Could not extract bucket name from URL ${httpsUrl}.`);
      return null;
    }
    const objectPath = pathParts.join('/'); // Join the remaining parts for the object path
    return `gs://${bucket}/${objectPath}`;
  } catch (error: any) {
    logger.error(MODULE_NAME, `Error converting HTTPS URL to GCS URI for ${httpsUrl}`, error);
    return null;
  }
};

/**
 * Fetches GCS file details from the database and streams the file to the client response.
 * 
 * @param contentItemId The ID of the content item.
 * @param mediaId The ID of the media file (content_images record).
 * @param res The Express response object to pipe the stream to.
 * @throws Error if media not found, GCS interaction fails, or bucket not configured.
 */
export const getGcsFileDetailsAndStream = async (contentItemId: string, mediaId: string, res: any): Promise<void> => {
  logger.info(MODULE_NAME, `[PROXY_SERVICE_START] Attempting to stream file for contentItemId: ${contentItemId}, mediaId: ${mediaId}`);

  if (!storage || !bucketName) {
    logger.error(MODULE_NAME, '[PROXY_SERVICE_ERROR] GCS not initialized. Check GCS_BUCKET_NAME and GOOGLE_APPLICATION_CREDENTIALS.');
    throw new Error('Google Cloud Storage is not initialized.');
  }
  logger.debug(MODULE_NAME, `[PROXY_SERVICE_CONFIG] Using GCS Bucket: ${bucketName}`);

  const mediaFile = await prisma.content_images.findUnique({
      where: {
          id: mediaId,
          content_item_id: contentItemId,
      },
      select: {
          file_path: true,
          image_type: true, // Used to determine Content-Type
      },
  });

  if (!mediaFile || !mediaFile.file_path) {
      logger.warn(MODULE_NAME, `[PROXY_SERVICE_DB_FAIL] Media file record not found in DB or file_path is null for mediaId: ${mediaId}, contentItemId: ${contentItemId}`);
      const err = new Error('Media not found in database or file path missing.');
      (err as any).statusCode = 404;
      throw err;
  }

  logger.info(MODULE_NAME, `[PROXY_SERVICE_DB_SUCCESS] Found mediaFile record in DB. Path: ${mediaFile.file_path}, DB image_type: ${mediaFile.image_type}`);

  let objectPath = mediaFile.file_path;
  if (bucketName) { // Ensure bucketName is not null
    const gcsHttpsPrefix = `https://storage.googleapis.com/${bucketName}/`;
    const gcsGsPrefix = `gs://${bucketName}/`;

    if (objectPath.startsWith(gcsHttpsPrefix)) {
      objectPath = objectPath.substring(gcsHttpsPrefix.length);
      logger.debug(MODULE_NAME, `[PROXY_SERVICE_PATH_ADJUST] Stripped GCS HTTPS prefix. Using object path: ${objectPath}`);
    } else if (objectPath.startsWith(gcsGsPrefix)) {
      objectPath = objectPath.substring(gcsGsPrefix.length);
      logger.debug(MODULE_NAME, `[PROXY_SERVICE_PATH_ADJUST] Stripped GCS gs:// prefix. Using object path: ${objectPath}`);
    }
  } else {
    // This case should ideally not be reached if GCS is initialized properly
    logger.error(MODULE_NAME, '[PROXY_SERVICE_ERROR] bucketName is null, cannot reliably adjust object path.');
    throw new Error('Google Cloud Storage bucket name is not configured.');
  }

  let determinedContentType = 'application/octet-stream'; // Default
  if (mediaFile.image_type) {
      const typeLower = mediaFile.image_type.toLowerCase();
      if (typeLower.includes('jpeg') || typeLower.includes('jpg')) {
        determinedContentType = 'image/jpeg';
      } else if (typeLower.includes('png')) {
        determinedContentType = 'image/png';
      } else if (typeLower.includes('gif')) {
        determinedContentType = 'image/gif';
      } else if (typeLower.includes('webp')) {
        determinedContentType = 'image/webp';
      } else if (typeLower.includes('mp4')) {
        determinedContentType = 'video/mp4';
      } else if (typeLower.includes('webm')) {
        determinedContentType = 'video/webm';
      } else if (typeLower.includes('video')) { // Broader check for video
        determinedContentType = 'video/mp4'; // Default to mp4 if just 'video'
      } else if (typeLower.includes('image')) { // Broader check for image
        determinedContentType = 'image/jpeg'; // Default to jpeg if just 'image'
      }
  } else {
      const extension = objectPath.split('.').pop()?.toLowerCase(); // Use adjusted objectPath
      if (extension === 'jpg' || extension === 'jpeg') determinedContentType = 'image/jpeg';
      else if (extension === 'png') determinedContentType = 'image/png';
      else if (extension === 'gif') determinedContentType = 'image/gif';
      else if (extension === 'webp') determinedContentType = 'image/webp';
      else if (extension === 'mp4') determinedContentType = 'video/mp4';
      else if (extension === 'webm') determinedContentType = 'video/webm';
  }
  
  logger.info(MODULE_NAME, `[PROXY_SERVICE_CONTENT_TYPE] Determined Content-Type: ${determinedContentType} for GCS file: ${objectPath}`);

  try {
      const bucket = storage.bucket(bucketName); 
      const gcsFile = bucket.file(objectPath); // Use adjusted objectPath

      logger.debug(MODULE_NAME, `[PROXY_SERVICE_GCS_CHECK] Checking existence of GCS file: gs://${bucketName}/${objectPath}`);
      const [exists] = await gcsFile.exists();
      
      if (!exists) {
          logger.warn(MODULE_NAME, `[PROXY_SERVICE_GCS_FAIL] File not found in GCS: gs://${bucketName}/${objectPath}`);
          const err = new Error('File not found in cloud storage.');
          (err as any).statusCode = 404;
          throw err;
      }
      logger.info(MODULE_NAME, `[PROXY_SERVICE_GCS_EXISTS] File exists in GCS: gs://${bucketName}/${objectPath}`);

      logger.info(MODULE_NAME, `[PROXY_SERVICE_STREAM_START] Attempting to stream file from GCS: ${objectPath}`);
      res.setHeader('Content-Type', determinedContentType);
      
      const readStream = gcsFile.createReadStream();
      
      readStream.on('error', (err: Error) => {
          logger.error(MODULE_NAME, `[PROXY_SERVICE_STREAM_ERROR] Error during GCS stream for ${objectPath}`, err);
          if (!res.headersSent) {
            // This error will be caught by asyncHandler in the controller if not handled here
            // Forcing a 500 if stream errors after headers might be too late or cause issues.
            // Let controller's asyncHandler handle it by not sending response here.
          }
          readStream.destroy(); 
      });

      readStream.on('end', () => {
        logger.info(MODULE_NAME, `[PROXY_SERVICE_STREAM_END] GCS stream ended for ${objectPath}`);
      });

      readStream.pipe(res);

  } catch (error) {
      logger.error(MODULE_NAME, `[PROXY_SERVICE_GCS_CATCH_ALL] GCS interaction error for ${objectPath}`, error);
      throw error; // Re-throw for asyncHandler in controller to catch
  }
};
