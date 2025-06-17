import { Request, Response, NextFunction } from 'express';
import * as secretManagerService from '../services/secretManagerService'; // Import the new service
import prisma from '../utils/prismaClient'; // Import shared prisma client

// Placeholder implementation - replace with actual logic

// GET /api/publishers/:id/channels/:channelId/config
export const getConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => { // Explicit return type
    const { channelId, id: publisherId } = req.params;
    console.log(`[getConfig] START - Params: publisherId=${publisherId}, channelId=${channelId}`);
    try {
        console.log(`[getConfig] Fetching config for channel ID: ${channelId}`);
        const config = await prisma.publisher_channel_configs.findUnique({
            where: {
                publisher_channel_id: channelId,
            },
        });
        console.log(`[getConfig] Prisma findUnique result: ${config ? 'Found' : 'Not Found'}`);

        if (!config) {
            console.log(`[getConfig] Config not found for channel ${channelId}, returning 404.`);
            res.status(404).json({ message: 'Configuration not found for this channel.' });
            return;
        }

        console.log(`[getConfig] Successfully fetched config for channel ${channelId}, returning 200.`);
        res.status(200).json(config);
    } catch (error) {
        console.error(`[getConfig] ERROR fetching config for channel ${channelId}:`, error);
        next(error);
    }
};

// POST /api/publishers/:id/channels/:channelId/config
export const createConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { channelId, id: publisherId } = req.params;
    console.log(`[createConfig] START - Params: publisherId=${publisherId}, channelId=${channelId}`);
    // Add new fields to destructuring
    const { name, sitemapUrl, loginCredentials, includeDomains, excludePatterns, maxPages, maxDepth, imageMaxBytes, heroImageSelector, articleContentSelector } = req.body;
    console.log(`[createConfig] Request body:`, req.body);

    if (!name) {
        console.log(`[createConfig] Validation failed: Name is required.`);
        res.status(400).json({ message: 'Configuration name is required.' });
        return;
    }

    try {
        console.log(`[createConfig] Step 1: Verifying channel ${channelId}...`);
        const channel = await prisma.publisher_channels.findUnique({
            where: { id: channelId },
        });
        console.log(`[createConfig] Channel query result: ${channel ? 'Found' : 'Not Found'}`);

        if (!channel) {
            console.log(`[createConfig] Channel ${channelId} not found, returning 404.`);
            res.status(404).json({ message: `Publisher channel with ID ${channelId} not found.` });
            return;
        }
        if (channel.platform !== 'Website') {
            console.log(`[createConfig] Channel ${channelId} platform is not 'Website', returning 400.`);
            res.status(400).json({ message: 'Configuration can only be created for channels with platform "Website".' });
            return;
        }
        console.log(`[createConfig] Channel ${channelId} verified.`);

        console.log(`[createConfig] Step 2: Checking for existing config for channel ${channelId}...`);
        const existingConfig = await prisma.publisher_channel_configs.findUnique({
             where: { publisher_channel_id: channelId },
        });
        console.log(`[createConfig] Existing config check result: ${existingConfig ? 'Found' : 'Not Found'}`);
        if (existingConfig) {
            console.log(`[createConfig] Config already exists for channel ${channelId}, returning 409.`);
            res.status(409).json({ message: 'Configuration already exists for this channel. Use PUT to update.' });
             return;
        }
        console.log(`[createConfig] No existing config found.`);

        console.log(`[createConfig] Step 3: Handling Secret Manager...`);
        let secretShortId: string | undefined = undefined; // This is the short ID we use
        let dbLoginSecretId: string | undefined = undefined; // This is what we store in DB (could be full path or short ID)

        if (loginCredentials && typeof loginCredentials === 'object' && loginCredentials.username && loginCredentials.password) {
            // Define a consistent secret ID format
            secretShortId = `publisher-${channel.publisher_id}-channel-${channelId}-creds`;
            const payload = JSON.stringify(loginCredentials); // Store as JSON string

            try {
                console.log(`[createConfig] Attempting to store credentials in Secret Manager with ID: ${secretShortId}`);
                const storedSecretId = await secretManagerService.createOrUpdateSecret(secretShortId, payload);
                console.log(`[createConfig] Secret Manager createOrUpdateSecret result: ${storedSecretId}`);

                if (storedSecretId) {
                    dbLoginSecretId = secretShortId;
                    console.log(`[createConfig] Successfully stored/updated secret, using ID for DB: ${dbLoginSecretId}`);
                } else {
                    console.warn(`[createConfig] Failed to store secret ${secretShortId}, continuing without credential storage.`);
                }
            } catch (secretError) {
                console.error(`[createConfig] ERROR storing secret ${secretShortId} in Secret Manager:`, secretError);
                console.warn('[createConfig] Continuing configuration creation without storing credentials.');
            }
        } else if (loginCredentials) {
            console.warn("[createConfig] loginCredentials provided but not in expected format {username, password}");
            res.status(400).json({ message: 'Invalid format for loginCredentials. Expected {username, password}.' });
            return;
        } else {
            console.log(`[createConfig] No login credentials provided or needed.`);
        }
        console.log(`[createConfig] Secret Manager handling complete. dbLoginSecretId: ${dbLoginSecretId}`);

        console.log(`[createConfig] Step 4: Creating configuration record in DB...`);
        const configDataToCreate = {
            publisher_channel_id: channelId,
            name: name,
            sitemapUrl: sitemapUrl,
            loginSecretId: dbLoginSecretId, // Store the short ID (or full path if preferred)
            includeDomains: includeDomains || [],
            excludePatterns: excludePatterns || [],
            maxPages: maxPages ? parseInt(maxPages, 10) : undefined,
            maxDepth: maxDepth ? parseInt(maxDepth, 10) : undefined,
            imageMaxBytes: imageMaxBytes ? parseInt(imageMaxBytes, 10) : undefined,
            heroImageSelector: heroImageSelector, // Add new field
            articleContentSelector: articleContentSelector, // Add new field
        };
        console.log(`[createConfig] Data for Prisma create:`, configDataToCreate);
        const newConfig = await prisma.publisher_channel_configs.create({
            data: configDataToCreate,
        });
        console.log(`[createConfig] Successfully created config record with ID: ${newConfig.id}`);

        res.status(201).json(newConfig);

    } catch (error) {
        console.error(`[createConfig] ERROR creating config for channel ${channelId}:`, error);
        // Handle potential unique constraint violation if config was created concurrently
        if (error instanceof Error && (error as any).code === 'P2002') { // Prisma unique constraint error code
             console.log(`[createConfig] Conflict: Configuration already exists (P2002).`);
             res.status(409).json({ message: 'Configuration already exists for this channel.' });
        } else {
            next(error); // Pass other errors to the global error handler
        }
    }
};

// PUT /api/publishers/:id/channels/:channelId/config
export const updateConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { channelId, id: publisherId } = req.params;
    console.log(`[updateConfig] START - Params: publisherId=${publisherId}, channelId=${channelId}`);
    // Add new fields to destructuring
    const { name, sitemapUrl, loginCredentials, includeDomains, excludePatterns, maxPages, maxDepth, imageMaxBytes, heroImageSelector, articleContentSelector } = req.body;
    console.log(`[updateConfig] Request body:`, req.body);

    if (Object.keys(req.body).length === 0) {
        console.log(`[updateConfig] Validation failed: No update data provided.`);
        res.status(400).json({ message: 'No update data provided.' });
        return;
    }

    try {
        console.log(`[updateConfig] Step 1: Handling Secret Manager...`);
        let loginSecretId: string | null | undefined = undefined; // Use undefined to signal no change unless explicitly set

        console.log(`[updateConfig] Fetching existing config for channel ${channelId} to check current secret ID...`);
        const existingConfig = await prisma.publisher_channel_configs.findUnique({
            where: { publisher_channel_id: channelId },
            select: { loginSecretId: true }
        });
        console.log(`[updateConfig] Existing config secret ID: ${existingConfig?.loginSecretId}`);

        if (loginCredentials === null) {
            console.log(`[updateConfig] loginCredentials explicitly null. Attempting to delete existing secret.`);
            if (existingConfig?.loginSecretId) {
                try {
                    console.log(`[updateConfig] Deleting secret: ${existingConfig.loginSecretId}`);
                    await secretManagerService.deleteSecret(existingConfig.loginSecretId);
                    console.log(`[updateConfig] Successfully deleted secret: ${existingConfig.loginSecretId}`);
                } catch (secretError) {
                    console.error(`[updateConfig] ERROR deleting secret ${existingConfig.loginSecretId}:`, secretError);
                    // Log error but continue, DB will be updated to null anyway
                }
            } else {
                 console.log(`[updateConfig] No existing secret ID found to delete.`);
            }
            loginSecretId = null; // Explicitly set to null for DB update
        } else if (loginCredentials && typeof loginCredentials === 'object' &&
                   loginCredentials.username && loginCredentials.password) {
            console.log(`[updateConfig] Valid loginCredentials provided. Attempting to update/create secret.`);
            const secretShortId = `publisher-${publisherId}-channel-${channelId}-creds`;
            const payload = JSON.stringify(loginCredentials);

            try {
                console.log(`[updateConfig] Calling Secret Manager createOrUpdateSecret with ID: ${secretShortId}`);
                const storedSecretId = await secretManagerService.createOrUpdateSecret(secretShortId, payload);
                console.log(`[updateConfig] Secret Manager createOrUpdateSecret result: ${storedSecretId}`);

                if (storedSecretId) {
                    loginSecretId = secretShortId;
                    console.log(`[updateConfig] Successfully stored/updated secret. DB will use ID: ${loginSecretId}`);
                } else {
                    console.warn(`[updateConfig] Failed to store/update secret ${secretShortId}. Config update will proceed without changing secret ID.`);
                    // Do not set loginSecretId, so it won't be included in the updateData unless already set to null above
                }
            } catch (secretError) {
                console.error(`[updateConfig] ERROR managing secret ${secretShortId}:`, secretError);
                console.warn('[updateConfig] Continuing configuration update without changing credentials.');
                 // Do not set loginSecretId
            }
        } else if (loginCredentials) {
            console.warn(`[updateConfig] Invalid format for loginCredentials.`);
            res.status(400).json({
                message: 'Invalid format for loginCredentials. Expected {username, password} or null to remove.'
            });
            return;
        } else {
             console.log(`[updateConfig] No login credentials provided in update request. Existing secret (if any) will be kept.`);
             // loginSecretId remains undefined, so it won't be included in updateData
        }
        console.log(`[updateConfig] Secret Manager handling complete. loginSecretId to use for update (if defined): ${loginSecretId}`);

        console.log(`[updateConfig] Step 2: Preparing update data...`);
        const updateData: any = {};
        // Only add fields to updateData if they were actually provided in the request body
        if (req.body.hasOwnProperty('name')) updateData.name = name;
        if (req.body.hasOwnProperty('sitemapUrl')) updateData.sitemapUrl = sitemapUrl;
        if (loginSecretId !== undefined) updateData.loginSecretId = loginSecretId; // Use the value determined above (could be null or a string)
        if (req.body.hasOwnProperty('includeDomains')) updateData.includeDomains = includeDomains;
        if (req.body.hasOwnProperty('excludePatterns')) updateData.excludePatterns = excludePatterns;
        if (req.body.hasOwnProperty('maxPages')) updateData.maxPages = maxPages ? parseInt(maxPages, 10) : null;
        if (req.body.hasOwnProperty('maxDepth')) updateData.maxDepth = maxDepth ? parseInt(maxDepth, 10) : null;
        if (req.body.hasOwnProperty('imageMaxBytes')) updateData.imageMaxBytes = imageMaxBytes ? parseInt(imageMaxBytes, 10) : null;
        // Add new fields if they exist in the request body
        if (req.body.hasOwnProperty('heroImageSelector')) updateData.heroImageSelector = heroImageSelector;
        if (req.body.hasOwnProperty('articleContentSelector')) updateData.articleContentSelector = articleContentSelector;
        console.log(`[updateConfig] Data for Prisma update:`, updateData);

        if (Object.keys(updateData).length === 0) {
             console.log(`[updateConfig] No actual data fields to update after processing. Returning 200 OK without DB change.`);
             // If only loginCredentials were provided but failed/resulted in no change,
             // we might end up here. Return the existing config? Or just 200? Let's return existing.
             const currentConfig = await prisma.publisher_channel_configs.findUnique({ where: { publisher_channel_id: channelId } });
             res.status(200).json(currentConfig);
             return;
        }

        console.log(`[updateConfig] Step 3: Updating configuration record in DB...`);
        const updatedConfig = await prisma.publisher_channel_configs.update({
            where: {
                publisher_channel_id: channelId,
            },
            data: updateData,
        });
        console.log(`[updateConfig] Successfully updated config record for channel ${channelId}.`);

        res.status(200).json(updatedConfig);

    } catch (error) {
        console.error(`[updateConfig] ERROR updating config for channel ${channelId}:`, error);
        if (error instanceof Error && (error as any).code === 'P2025') { // Prisma record not found error
             console.log(`[updateConfig] Config not found for channel ${channelId} (P2025).`);
             res.status(404).json({ message: `Configuration not found for channel ID ${channelId}. Cannot update.` });
        } else {
            next(error);
        }
    }
};

// DELETE /api/publishers/:id/channels/:channelId/config
export const deleteConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { channelId, id: publisherId } = req.params;
    console.log("deleteConfig - Request params:", req.params); // Debug: Log all parameters

    try {
        console.log(`Attempting to delete config for channel ID: ${channelId}`);

        // 1. Fetch the config first to potentially get the loginSecretId for cleanup
        const configToDelete = await prisma.publisher_channel_configs.findUnique({
             where: { publisher_channel_id: channelId },
             select: { loginSecretId: true } // Only select the secret ID
        });

        // If config doesn't exist, we can consider it successfully deleted (idempotent)
        if (!configToDelete) {
             res.status(204).send();
             return;
        }

        // 2. Delete the configuration record from the database
        await prisma.publisher_channel_configs.delete({
            where: {
                publisher_channel_id: channelId,
            },
        });

        // 3. Delete the secret from Google Secret Manager if it exists
        if (configToDelete?.loginSecretId) {
            console.log(`Deleting secret from Secret Manager with ID: ${configToDelete.loginSecretId}`);
            try {
                await secretManagerService.deleteSecret(configToDelete.loginSecretId);
                 console.log(`Successfully deleted secret: ${configToDelete.loginSecretId}`);
            } catch (secretError) {
                 // Log the error but proceed with DB deletion - maybe the secret was already gone
                 console.error(`Error deleting secret ${configToDelete.loginSecretId} from Secret Manager (proceeding with DB deletion):`, secretError);
            }
        }

        res.status(204).send(); // Send No Content on successful deletion

    } catch (error) {
        console.error(`Error deleting config for channel ${channelId}:`, error);
         // Handle case where the config to delete doesn't exist (though checked above, good practice)
         if (error instanceof Error && (error as any).code === 'P2025') { // Prisma record not found error
             res.status(404).json({ message: `Configuration not found for channel ID ${channelId}. Cannot delete.` });
        } else {
            next(error); // Pass other errors to the global error handler
        }
    }
};

// POST /api/publishers/:id/channels/:channelId/test-crawl
export const runTestCrawl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { channelId, id: publisherId } = req.params;
    console.log("runTestCrawl - Request params:", req.params); // Debug: Log all parameters
    console.log(`Running test crawl simulation for channel ID: ${channelId}`);
    
    try {
        // 1. Fetch channel and its config
        const channel = await prisma.publisher_channels.findUnique({
            where: { id: channelId }
        });

        if (!channel) {
            res.status(404).json({ message: `Publisher channel with ID ${channelId} not found.` });
            return;
        }

        const config = await prisma.publisher_channel_configs.findUnique({
            where: { publisher_channel_id: channelId }
        });

        if (!config) {
            res.status(404).json({ message: `Configuration for channel ID ${channelId} not found.` });
            return;
        }

        // 2. Determine crawl settings
        const baseUrl = channel.channel_url;
        const sitemapUrl = config.sitemapUrl;
        const includeDomains = config.includeDomains || [];
        const excludePatterns = config.excludePatterns || [];
        
        // Use smaller limits for the test crawl - this should be fast (under 10s)
        const maxTestPages = Math.min(config.maxPages || 100, 50); // Cap at 50 for the test
        const maxTestDepth = Math.min(config.maxDepth || 3, 2);    // Cap at depth 2 for the test
        
        // 3. Estimate total pages by either:
        //    a) Fetch and count sitemap entries if a sitemap URL is provided
        //    b) Use BFS crawler with limited depth/count to estimate pages
        let estimatedPages = 0;
        let estimatedImages = 0;
        
        // Import utilities
        const sitemapUtil = await import('../utils/sitemap');
        const bfsUtil = await import('../utils/bfsCrawler');
        // Use playwright's chromium instead of puppeteer directly
        const { chromium } = await import('playwright'); 
        
        // For image estimation, we need to sample a few pages to get an average
        const MAX_SAMPLE_PAGES = 3;
        const samplePages: string[] = [];
        
        // Launch a headless browser for the test, using playwright's chromium
        const browser = await chromium.launch({
            headless: true, 
            // Align args with captureWorker.ts which is known to work on M1
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        
        try {
            if (sitemapUrl) {
                // Approach A: Use Sitemap
                console.log(`Test crawl using sitemap: ${sitemapUrl}`);
                const urls = await sitemapUtil.parseSitemap(sitemapUrl);
                
                // Filter URLs based on includeDomains and excludePatterns
                const filteredUrls = urls.filter((url: string) => {
                    const urlObj = new URL(url);
                    const domain = urlObj.hostname;
                    
                    // Check if domain is in includeDomains
                    const isDomainIncluded = includeDomains.some(include => 
                        domain === include || domain.endsWith(`.${include}`)
                    );
                    
                    if (!isDomainIncluded) return false;
                    
                    // Check if URL matches any excludePattern
                    const isExcluded = excludePatterns.some(pattern => {
                        // Simple wildcard pattern matching logic
                        if (pattern.startsWith('*')) {
                            return url.endsWith(pattern.substring(1));
                        } else if (pattern.endsWith('*')) {
                            return url.startsWith(pattern.substring(0, pattern.length - 1));
                        } else {
                            return url.includes(pattern);
                        }
                    });
                    
                    return !isExcluded;
                });
                
                estimatedPages = Math.min(filteredUrls.length, maxTestPages || 500);
                
                // Get a sample of pages to check for images
                for (let i = 0; i < Math.min(MAX_SAMPLE_PAGES, filteredUrls.length); i++) {
                    samplePages.push(filteredUrls[i]);
                }
                
            } else {
                // Approach B: Use BFS Crawler
                console.log(`Test crawl using BFS from: ${baseUrl}`);
                // Use the BFS crawler with limited depth/count
                // Note: bfsCrawler only accepts startUrl, maxPages, maxDepth
                // We'll need to do domain and pattern filtering afterwards
                const discoveredUrls = await bfsUtil.bfsCrawler(
                    baseUrl,
                    maxTestPages,
                    maxTestDepth
                );
                
                // Apply domain and pattern filtering
                const filteredUrls = discoveredUrls.filter((url: string) => {
                    const urlObj = new URL(url);
                    const domain = urlObj.hostname;
                    
                    // Check if domain is in includeDomains
                    const isDomainIncluded = includeDomains.some(include => 
                        domain === include || domain.endsWith(`.${include}`)
                    );
                    
                    if (!isDomainIncluded) return false;
                    
                    // Check if URL matches any excludePattern
                    const isExcluded = excludePatterns.some(pattern => {
                        // Simple wildcard pattern matching logic
                        if (pattern.startsWith('*')) {
                            return url.endsWith(pattern.substring(1));
                        } else if (pattern.endsWith('*')) {
                            return url.startsWith(pattern.substring(0, pattern.length - 1));
                        } else {
                            return url.includes(pattern);
                        }
                    });
                    
                    return !isExcluded;
                });
                
                // Adjust the estimation based on the limited BFS result
                const foundPagesCount = discoveredUrls.length;
                
                // If we reached the limit, make a higher estimate based on the depth & branching
                if (foundPagesCount >= maxTestPages) {
                    // Use a simple formula to estimate total pages if we hit the limit
                    const depthMultiplier = config.maxDepth ? Math.pow(2, config.maxDepth - maxTestDepth) : 2;
                    estimatedPages = Math.min(foundPagesCount * depthMultiplier, config.maxPages || 500);
                } else {
                    estimatedPages = foundPagesCount;
                }
                
                // Get a sample of pages to check for images
                for (let i = 0; i < Math.min(MAX_SAMPLE_PAGES, discoveredUrls.length); i++) {
                    samplePages.push(discoveredUrls[i]);
                }
            }
            
            // Check sample pages for images to get an average count
            let totalImageCount = 0;
            
            for (const pageUrl of samplePages) {
                try {
                    const page = await browser.newPage();
                    await page.goto(pageUrl, { timeout: 20000, waitUntil: 'domcontentloaded' });
                    
                    // Check image count on the page
                    const imageCount = await page.$$eval('img[src]', (imgs: Element[]) => {
                        return imgs.length;
                    });
                    
                    totalImageCount += imageCount;
                    await page.close();
                } catch (pageError) {
                    console.error(`Error checking images on ${pageUrl}:`, pageError);
                    // Continue with other samples despite errors
                }
            }
            
            // Estimate total images based on sample pages
            const avgImagesPerPage = samplePages.length > 0 ? totalImageCount / samplePages.length : 0;
            estimatedImages = Math.round(estimatedPages * avgImagesPerPage);
            
            // Apply image size filter if specified
            if (config.imageMaxBytes) {
                // Assume 20% of images might be filtered out due to size
                estimatedImages = Math.round(estimatedImages * 0.8);
            }
            
        } finally {
            // Always close the browser
            await browser.close();
        }
        
        // 4. Return the estimates
        res.status(200).json({
            estimatedPages,
            estimatedImages
        });
        
    } catch (error) {
        console.error(`Error during test crawl for channel ${channelId}:`, error);
        next(error);
    }
};
