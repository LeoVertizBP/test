import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import net from 'net';
import { v4 as uuidv4 } from 'uuid';
import { Job } from 'bullmq'; // Import Job type for casting

// --- Mock External Services ---
// Jest will automatically use the mocks from __mocks__ directories
jest.mock('../../src/utils/prismaClient'); // Corrected path
jest.mock('../../src/services/gcsService'); // Corrected path
jest.mock('bullmq'); // Uses the mock from root __mocks__/bullmq.ts

// Import the *original* modules. Jest replaces them with mocks at runtime.
import prisma from '../../src/utils/prismaClient';
import { uploadBufferToGCS } from '../../src/services/gcsService';
// Import the mock controller AND the mock Queue constructor from the mock file
import { Queue as MockBullMQ, mockAdd as mockEvaluateQueueAdd } from '../../__mocks__/bullmq'; // Aliased Queue to MockBullMQ

// --- Import Worker Logic ---
// Import the refactored processor function and types
import { processCaptureJob, CaptureJobData } from '../../src/workers/captureWorker'; // Added comma

// --- Test Setup ---
const TEST_SITE_DIR = path.resolve(__dirname, 'test-site');
const SITEMAP_PATH = path.join(TEST_SITE_DIR, 'sitemap.xml');

let serverProcess: ChildProcess | null = null;
let serverPort: number;
let serverUrl: string;
let originalSitemapContent: string;

// Custom function to find an available port (replaces get-port)
function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

describe('E2E Test: Capture Worker', () => {

  beforeAll(async () => {
    // 1. Find an available port using our custom function
    serverPort = await findAvailablePort();
    serverUrl = `http://localhost:${serverPort}`;
    console.log(`Found available port: ${serverPort}`);

    // 2. Update sitemap.xml with the dynamic port
    try {
        originalSitemapContent = await fs.readFile(SITEMAP_PATH, 'utf-8');
        const updatedSitemapContent = originalSitemapContent.replace(/PORT/g, serverPort.toString());
        await fs.writeFile(SITEMAP_PATH, updatedSitemapContent);
        console.log(`Updated sitemap.xml with port ${serverPort}`);
    } catch (err) {
        console.error('Failed to update sitemap.xml:', err);
        throw err; // Fail setup if sitemap can't be updated
    }


    // 3. Start http-server
    console.log(`Starting http-server for ${TEST_SITE_DIR} on port ${serverPort}...`);
    serverProcess = spawn(
      'npx',
      ['http-server', TEST_SITE_DIR, '-p', serverPort.toString(), '-c-1', '--silent'], // -c-1 disables cache, --silent reduces noise
      { stdio: 'inherit', shell: true } // Inherit stdio to see server logs if needed, shell: true for npx on some systems
    );

    // Add error handling for server spawn
    serverProcess.on('error', (err) => {
      console.error('Failed to start http-server:', err);
      throw err; // Fail tests if server doesn't start
    });

    // Wait a moment for the server to start (can be improved with polling)
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`http-server should be running at ${serverUrl}`);
  });

  afterAll(async () => {
    // 1. Kill http-server process
    if (serverProcess) {
      console.log('Stopping http-server...');
      const killed = serverProcess.kill('SIGTERM'); // Send SIGTERM signal
       if (!killed) {
           console.warn('Failed to kill http-server process gracefully, attempting SIGKILL.');
           serverProcess.kill('SIGKILL');
       }
      console.log('http-server stopped.');
      serverProcess = null;
    }

     // 2. Restore original sitemap content
     if (originalSitemapContent) {
        try {
            await fs.writeFile(SITEMAP_PATH, originalSitemapContent);
            console.log('Restored original sitemap.xml');
        } catch (err) {
            console.error('Failed to restore sitemap.xml:', err);
        }
     }
  });

  beforeEach(() => {
    // Reset mocks before each test run
    jest.clearAllMocks();

    // Reset specific mock implementations if necessary (e.g., counters)
    // mockPrisma.content_items.create.mockClear(); // Example
  });

  // --- Test Cases ---
  it('should process a capture job, discover URLs, capture content, and interact with mocks', async () => {
    // 1. Define test job data
    const testPublisherId = uuidv4();
    const testScanJobId = uuidv4();
    const testPublisherChannelId = uuidv4();
    const testContentItemId = uuidv4(); // Pre-define for assertion
    const jobData: CaptureJobData = {
        publisherId: testPublisherId,
        scanJobId: testScanJobId,
        // maxPages: 3 // Optional: test limits - let's test without limit first
    };
    // Create a mock Job object structure
    const mockJob = { id: 'e2e-test-job-1', data: jobData } as Job<CaptureJobData>;

    // 2. Setup mock return values/implementations
    // Mock Prisma calls - Cast the imported prisma to access mock functions
    (prisma.publisher_channels.findFirst as jest.Mock).mockResolvedValue({
        id: testPublisherChannelId,
        publisher_id: testPublisherId,
        platform: 'website',
        channel_url: serverUrl, // Use the dynamic server URL
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
    });
    (prisma.content_items.create as jest.Mock).mockResolvedValue({
        id: testContentItemId, // Return a predictable ID
        scan_job_id: testScanJobId,
        publisher_id: testPublisherId,
        publisher_channel_id: testPublisherChannelId,
        platform: 'website',
        channel_url: serverUrl,
        url: '', // Will be filled by actual URL during create call check
        content_type: 'webpage',
        scan_date: new Date(),
        title: '', // Will be filled by actual title
        created_at: new Date(),
        updated_at: new Date(),
    });
    (prisma.content_files.createMany as jest.Mock).mockResolvedValue({ count: 2 }); // Expect 2 files (html, screenshot)

    // Mock GCS - Cast the imported function to access mock functions/assertions
    const mockedUpload = uploadBufferToGCS as jest.Mock;

    // Mock BullMQ add (already mocked to resolve, just need to check calls later)
    const mockedQueueAdd = mockEvaluateQueueAdd as jest.Mock;

    // Create an instance of the mocked Queue to pass to the function
    const mockEvalQueueInstance = new MockBullMQ('evaluate'); // Name doesn't strictly matter for mock


    // 3. Invoke the worker's processing logic, passing the mock queue instance
    const result = await processCaptureJob(mockJob, mockEvalQueueInstance);

    // 4. Assertions:
    // URLs discovered (based on test-site files and sitemap)
    // Sitemap: /index.html, /page1.html
    // BFS from /: /page1.html, /page2.html, /sitemap.xml
    // Combined unique: /, /index.html, /page1.html, /page2.html, /sitemap.xml (Note: / might resolve to /index.html depending on server)
    // Let's assume http-server serves index.html for /
    const expectedUrls = [
        `${serverUrl}/`, // or `${serverUrl}/index.html` - depends on how Playwright resolves/reports
        `${serverUrl}/index.html`,
        `${serverUrl}/page1.html`,
        `${serverUrl}/page2.html`,
        `${serverUrl}/sitemap.xml`,
    ];
    const expectedUrlCount = new Set(expectedUrls.map(u => u.replace(/\/$/, '/index.html'))).size; // Normalize trailing slash vs index.html

    expect(result.processedCount).toBe(expectedUrlCount); // Should process all unique discovered pages
    expect(result.errorCount).toBe(0);

    // Check Prisma calls using the imported (but mocked) prisma object
    expect(prisma.publisher_channels.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.content_items.create).toHaveBeenCalledTimes(expectedUrlCount);
    expect(prisma.content_files.createMany).toHaveBeenCalledTimes(expectedUrlCount);

    // Check GCS uploads (2 per page) using the cast mock function
    expect(mockedUpload).toHaveBeenCalledTimes(expectedUrlCount * 2);
    // Check a sample GCS call detail (e.g., first HTML upload)
    expect(mockedUpload).toHaveBeenCalledWith(
        expect.any(Buffer), // HTML buffer
        expect.stringMatching(/^html\/[a-f0-9-]+\.html$/), // GCS path format
        process.env.GCS_BUCKET_NAME // Bucket name from env
    );
     // Check a sample GCS call detail (e.g., first Screenshot upload)
     expect(mockedUpload).toHaveBeenCalledWith(
        expect.any(Buffer), // Screenshot buffer
        expect.stringMatching(/^screenshots\/[a-f0-9-]+\.png$/), // GCS path format
        process.env.GCS_BUCKET_NAME // Bucket name from env
    );


    // Check BullMQ enqueue calls
    expect(mockedQueueAdd).toHaveBeenCalledTimes(expectedUrlCount);
    // Check the arguments of the first call to evaluateQueue.add
    expect(mockedQueueAdd).toHaveBeenCalledWith(
        'evaluateContentItem', // Queue name
        { contentItemId: expect.any(String) } // Payload with contentItemId
    );

  });

  // Add more test cases for different scenarios (errors, limits, etc.)
});
