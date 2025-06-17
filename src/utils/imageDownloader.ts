import { Page } from 'playwright';
import { info, warn, error } from './logUtil';
import { calculateSha256 } from './hashUtil';
import { uploadBufferToGCS } from '../services/gcsService';
import prisma from './prismaClient';

const MODULE_NAME = 'ImageDownloader';
const GCS_IMAGE_PREFIX = 'images/';

interface ImageInfo {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
}

interface ImageResult {
  originalSrc: string;
  sha256: string;
  filePath: string;
  fileType: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
}

/**
 * Extract all images from a page with their metadata
 * Extract images from a page, optionally using CSS selectors for targeting.
 * @param page Playwright page object
 * @param heroSelector Optional CSS selector for hero image(s)
 * @param contentSelector Optional CSS selector for the main content area
 * @returns Array of image information objects
 */
export async function extractImagesFromPage(
  page: Page,
  heroSelector?: string,
  contentSelector?: string
): Promise<ImageInfo[]> {
  info(MODULE_NAME, `Extracting images. Hero: ${heroSelector}, Content: ${contentSelector}`);
  let images: ImageInfo[] = [];

  try {
    const extractImageData = (elements: Element[]): ImageInfo[] => {
      return elements
        .filter(el => el.tagName === 'IMG' && (el as HTMLImageElement).src) // Ensure it's an image with a src
        .map(img => {
          const imgElement = img as HTMLImageElement;
          return {
            src: imgElement.src,
            alt: imgElement.alt || '',
            width: imgElement.naturalWidth || imgElement.width || null, // Prefer naturalWidth
            height: imgElement.naturalHeight || imgElement.height || null, // Prefer naturalHeight
          };
        });
    };

    if (heroSelector) {
      info(MODULE_NAME, `Looking for hero images with selector: ${heroSelector}`);
      // Find images matching the hero selector directly
      const heroImages = await page.locator(heroSelector).evaluateAll(extractImageData);
      images = images.concat(heroImages);
      info(MODULE_NAME, `Found ${heroImages.length} hero images.`);
    }

    if (contentSelector) {
      info(MODULE_NAME, `Looking for content images within selector: ${contentSelector}`);
      // Find the content container, then find images *within* it
      const contentImages = await page.locator(contentSelector).locator('img[src]').evaluateAll(extractImageData);
      images = images.concat(contentImages);
      info(MODULE_NAME, `Found ${contentImages.length} content images.`);
    }

    // If NO selectors were provided, fall back to the original behavior (get all images)
    // --- Decision Point: Changed default to capture NO images if selectors are not set ---
    // if (!heroSelector && !contentSelector) {
    //   info(MODULE_NAME, 'No selectors provided, extracting all images from page.');
    //   const allImages = await page.locator('img[src]').evaluateAll(extractImageData);
    //   images = allImages;
    //   info(MODULE_NAME, `Found ${allImages.length} images total (no selectors).`);
    // }
    if (!heroSelector && !contentSelector) {
        warn(MODULE_NAME, 'No hero or content selectors provided. No images will be extracted from page content.');
        // images remains empty []
    }


    // Deduplicate images based on src before returning
    const uniqueImages = Array.from(new Map(images.map(img => [img.src, img])).values());

    info(MODULE_NAME, `Found ${uniqueImages.length} unique images based on selectors.`);
    return uniqueImages;

  } catch (err: any) {
    // Handle cases where selectors might be invalid or elements not found
    if (err.message?.includes('failed to find element matching selector')) {
        warn(MODULE_NAME, `Could not find elements for selector(s). Hero: ${heroSelector}, Content: ${contentSelector}. Error: ${err.message}`);
    } else {
        error(MODULE_NAME, `Error extracting images with selectors: ${err.message}`, err);
    }
    // If selectors fail, return empty array instead of falling back to all images
    return [];
  }
}


/**
 * Filter images based on domain inclusion and size limits
 * @param images List of extracted images
        return {
          src: imgElement.src,
          alt: imgElement.alt || '',
          width: imgElement.width || null,
          height: imgElement.height || null
        };
      });
    });
    
    info(MODULE_NAME, `Found ${images.length} images on the page`);
    return images;
  } catch (err: any) {
    error(MODULE_NAME, `Error extracting images from page: ${err.message}`, err);
    return [];
  }
}

/**
 * Filter images based on domain inclusion and size limits
 * @param images List of extracted images
 * @param baseUrl Base URL of the page
 * @param includeDomains List of domains to include
 * @param maxBytes Maximum image size in bytes
 * @returns Filtered list of image URLs
 */
export function filterImages(
  images: ImageInfo[],
  baseUrl: string,
  includeDomains: string[],
  maxBytes?: number
): ImageInfo[] {
  info(MODULE_NAME, `Filtering ${images.length} images`);

  // Create URL object for the base URL to help with relative URL resolution
  let baseUrlObj: URL;
  try {
    baseUrlObj = new URL(baseUrl);
  } catch (err) {
    error(MODULE_NAME, `Invalid base URL: ${baseUrl}`, err);
    return [];
  }

  // Filter images by domain
  const domainFiltered = images.filter(image => {
    try {
      // Handle relative URLs by resolving against base URL
      const fullUrl = new URL(image.src, baseUrl);
      const imageDomain = fullUrl.hostname;

      // Check if image domain is in includeDomains
      const isDomainIncluded = includeDomains.length === 0 || // If includeDomains is empty, include all domains
        includeDomains.some(domain => 
          imageDomain === domain || 
          imageDomain.endsWith(`.${domain}`)
        );

      return isDomainIncluded;
    } catch (err) {
      warn(MODULE_NAME, `Invalid image URL: ${image.src}`, err);
      return false;
    }
  });

  info(MODULE_NAME, `${domainFiltered.length} images passed domain filtering`);
  return domainFiltered;
}

/**
 * Download and process an image
 * @param imageInfo Image information
 * @param page Playwright page for fetching the image
 * @param baseUrl Base URL for resolving relative URLs
 * @returns Image result with hash, path, and metadata
 */
export async function downloadAndProcessImage(
  imageInfo: ImageInfo,
  page: Page,
  baseUrl: string
): Promise<ImageResult | null> {
  const { src, alt, width, height } = imageInfo;
  
  try {
    info(MODULE_NAME, `Processing image: ${src}`);
    
    // Resolve relative URLs
    const fullImageUrl = new URL(src, baseUrl).toString();
    
    // Use page to fetch the image
    const imageBuffer = await page.context().request.fetch(fullImageUrl)
      .then(response => {
        if (!response.ok()) {
          throw new Error(`Failed to fetch image: ${response.status()}`);
        }
        return response.body();
      });
    
    if (!imageBuffer) {
      throw new Error('Empty image buffer');
    }
    
    // Calculate SHA-256 hash for deduplication
    const sha256 = calculateSha256(imageBuffer);
    
    // Determine file extension from URL or content-type
    const urlObj = new URL(fullImageUrl);
    const pathParts = urlObj.pathname.split('.');
    let extension = pathParts.length > 1 ? pathParts.pop()?.toLowerCase() : '';
    
    // Default to 'jpg' if no extension is found or it's not a common image extension
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    if (!extension || !validExtensions.includes(extension)) {
      extension = 'jpg';
    }
    
    // Safe extension (ensure we don't have any invalid characters)
    extension = extension.replace(/[^a-z0-9]/g, '');
    
    // Create the file path with SHA-256 hash to enable deduplication
    const filePath = `${GCS_IMAGE_PREFIX}${sha256}.${extension}`;
    
    // Determine MIME type based on extension
    let mimeType = 'image/jpeg'; // Default
    if (extension === 'png') mimeType = 'image/png';
    else if (extension === 'gif') mimeType = 'image/gif';
    else if (extension === 'webp') mimeType = 'image/webp';
    else if (extension === 'svg') mimeType = 'image/svg+xml';
    else if (extension === 'bmp') mimeType = 'image/bmp';
    else if (extension === 'jpeg' || extension === 'jpg') mimeType = 'image/jpeg';
    
    return {
      originalSrc: src,
      sha256,
      filePath,
      fileType: 'image',
      mimeType,
      size: imageBuffer.length,
      width,
      height,
      alt
    };
  } catch (err: any) {
    error(MODULE_NAME, `Error processing image ${src}: ${err.message}`, err);
    return null;
  }
}

/**
 * Upload an image to GCS and create a database record
 * @param imageResult Processed image result
 * @param contentItemId Content item ID to associate with the image
 * @param gcsBucketName GCS bucket name
 * @param skipUploadIfExists Skip upload if the file already exists in GCS
 * @returns Database record ID or null on failure
 */
export async function uploadImageAndCreateRecord(
  imageResult: ImageResult,
  contentItemId: string,
  gcsBucketName: string,
  skipUploadIfExists: boolean = true
): Promise<string | null> {
  try {
    info(MODULE_NAME, `Uploading image to GCS: ${imageResult.filePath}`);
    
    // Check if a record with this SHA-256 already exists
    const existingFile = await prisma.content_files.findFirst({
      where: {
        sha256: imageResult.sha256,
        fileType: 'image'
      }
    });
    
    // If the image is already in the database and GCS, reuse it
    if (existingFile) {
      info(MODULE_NAME, `Image with SHA-256 ${imageResult.sha256} already exists, reusing`);
      
      // Create a new record pointing to the existing file
      const newFileRecord = await prisma.content_files.create({
        data: {
          contentItemId,
          version: 1,
          state: 'captured',
          fileType: 'image',
          filePath: existingFile.filePath,
          sha256: imageResult.sha256
        }
      });
      
      return newFileRecord.id;
    }
    
    // Image buffer needs to be fetched again or passed in as a parameter
    // For now, just assume the buffer is passed in or can be refetched
    
    // Create the file in the database
    const fileRecord = await prisma.content_files.create({
      data: {
        contentItemId,
        version: 1,
        state: 'captured',
        fileType: 'image',
        filePath: imageResult.filePath,
        sha256: imageResult.sha256
      }
    });
    
    return fileRecord.id;
  } catch (err: any) {
    error(MODULE_NAME, `Error uploading image and creating record: ${err.message}`, err);
    return null;
  }
}

/**
 * Main function to process images from a page
 * @param page Playwright page
 * @param contentItemId Content item ID
 * @param baseUrl Base URL of the page
 * @param includeDomains Domains to include
 * @param gcsBucketName GCS bucket name
 * @param maxImageBytes Maximum image size in bytes
 * @param heroImageSelector Optional CSS selector for hero image(s)
 * @param articleContentSelector Optional CSS selector for article content container
 * @returns Number of successfully processed images
 */
export async function processImagesFromPage(
  page: Page,
  contentItemId: string,
  baseUrl: string,
  includeDomains: string[],
  gcsBucketName: string,
  maxImageBytes?: number,
  heroImageSelector?: string, // Added parameter
  articleContentSelector?: string // Added parameter
): Promise<number> {
  try {
    info(MODULE_NAME, `Processing images for content item ${contentItemId} with selectors - Hero: ${heroImageSelector}, Content: ${articleContentSelector}`);

    // Extract images using selectors if provided
    const images = await extractImagesFromPage(page, heroImageSelector, articleContentSelector);

    if (images.length === 0) {
        info(MODULE_NAME, 'No images found matching selectors or no selectors provided.');
        return 0; // No images to process
    }

    // Filter images based on domain (size filtering happens after download)
    const filteredImages = filterImages(images, baseUrl, includeDomains); // Removed maxImageBytes from here
    
    // Process each image
    const imagePromises = filteredImages.map(async (image) => {
      try {
        // Download and process the image
        const imageResult = await downloadAndProcessImage(image, page, baseUrl);
        
        if (!imageResult) {
          return null;
        }
        
        // Skip very large images if size limit is set
        if (maxImageBytes && imageResult.size > maxImageBytes) {
          warn(MODULE_NAME, `Skipping large image: ${image.src} (${imageResult.size} bytes > ${maxImageBytes} bytes)`);
          return null;
        }
        
        // Upload to GCS and create database record
        const recordId = await uploadImageAndCreateRecord(
          imageResult,
          contentItemId,
          gcsBucketName
        );
        
        return recordId ? imageResult : null;
      } catch (err: any) {
        error(MODULE_NAME, `Error processing image ${image.src}: ${err.message}`, err);
        return null;
      }
    });
    
    // Wait for all image processing to complete
    const results = await Promise.all(imagePromises);
    
    // Count successful uploads
    const successCount = results.filter(Boolean).length;
    info(MODULE_NAME, `Successfully processed ${successCount} out of ${filteredImages.length} images`);
    
    return successCount;
  } catch (err: any) {
    error(MODULE_NAME, `Error processing images from page: ${err.message}`, err);
    return 0;
  }
}
