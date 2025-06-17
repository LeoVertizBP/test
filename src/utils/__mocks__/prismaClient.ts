// src/utils/__mocks__/prismaClient.ts

// Mock the Prisma client methods used by captureWorker
const mockPrisma = {
  publisher_channels: {
    findFirst: jest.fn(),
  },
  content_items: {
    create: jest.fn(),
  },
  content_files: {
    createMany: jest.fn(),
  },
  // Add other models/methods here if needed by other tests or worker logic
};

// Export the mock object as the default export, mimicking the real client
export default mockPrisma;
