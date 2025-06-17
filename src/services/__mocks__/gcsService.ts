// src/services/__mocks__/gcsService.ts

// Mock the specific function used by the worker
export const uploadBufferToGCS = jest.fn().mockResolvedValue(undefined);

// If other functions from gcsService were used, mock them here too.
