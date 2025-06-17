# Testing Guidelines

## End-to-End (E2E) Tests

The project includes end-to-end tests to verify the functionality of workers and other components. These tests use a combination of real services (like a local HTTP server) and mocked dependencies.

### Running E2E Tests

```bash
npm run test -- tests/e2e/capture-worker.e2e.test.ts
```

To run with verbose output and disable coverage for faster execution:

```bash
npm run test -- tests/e2e/capture-worker.e2e.test.ts --verbose --no-coverage
```

### E2E Test Structure

E2E tests follow this general structure:

1. **Setup**: Prepare the test environment, including starting any needed services
2. **Execution**: Run the component under test with appropriate test data
3. **Verification**: Assert on the expected outcomes, both in terms of returned values and side effects
4. **Cleanup**: Ensure all services are stopped and temporary resources removed

### Mocking Best Practices

The project uses Jest's mocking capabilities to replace external dependencies. Key points:

- Place module mocks in `__mocks__/` directories
- Use `jest.mock()` to mock modules
- Cast imported mocks to `jest.Mock` for TypeScript compatibility
- For complex mocks, consider exporting the mock implementations to reference in tests

### Example: Capture Worker E2E Test

The capture worker E2E test follows these steps:

1. Starts a local HTTP server serving test HTML pages
2. Creates mock implementations for Prisma, GCS, and BullMQ
3. Executes the worker with test data
4. Verifies the worker correctly:
   - Discovers URLs via sitemap and crawling
   - Captures page content
   - Creates appropriate database records
   - Uploads files to GCS
   - Enqueues items for evaluation

### Troubleshooting E2E Tests

If tests are failing:

1. Run with `--verbose` flag for detailed output
2. Check for timing issues - increase timeouts if needed
3. Verify mocks are properly set up and assertions match expected mock behaviors
4. Look for race conditions with service startup/shutdown
5. Add debug logging to understand the sequence of operations
