// __mocks__/bullmq.ts

// Create a mock function for the 'add' method that we can track
export const mockAdd = jest.fn().mockImplementation((queueName, data) => {
  console.log(`MOCK: Queue.add called with:`, queueName, data);
  return Promise.resolve({});
});

// Mock the Queue class constructor
export const Queue = jest.fn().mockImplementation((queueName) => {
  console.log(`MOCK: Creating Queue instance for:`, queueName);
  // The constructor returns an object with the mocked 'add' method
  return {
    add: mockAdd,
    name: queueName
  };
});

// Mock other exports from bullmq if needed (like Worker, Job)
export const Worker = jest.fn();
export const Job = jest.fn();
