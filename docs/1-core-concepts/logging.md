# Logging

## Overview

Logging is crucial for monitoring the application's behavior, diagnosing issues, and understanding event sequences. This document describes the logging strategy implemented in the backend application.

## Key Concepts

*   **Log Levels:** Different levels of severity are used to categorize log messages:
    *   `DEBUG`: Detailed information useful for debugging specific issues (lowest severity).
    *   `INFO`: Informational messages about normal application operation (e.g., server start, job initiation).
    *   `WARN`: Indicates potential issues or unexpected situations that don't necessarily cause errors but should be noted.
    *   `ERROR`: Signifies errors that prevent normal operation or require attention (highest severity).
*   **Structured Logging:** Log messages are formatted consistently to include important context like timestamp, log level, and the source module/component.
*   **Log Destination:** Currently, logs are written to the standard console output (`console.log`, `console.info`, `console.warn`, `console.error`). In production environments, this output might be captured by deployment tools (like PM2, systemd) or aggregated by external logging services.
*   **Log Level Configuration:** The minimum log level to be outputted is determined by the `NODE_ENV` environment variable (DEBUG in development, INFO in production).

## Implementation

A custom logging utility is implemented in `src/utils/logUtil.ts`.

*   **Centralized Logic:** The `log()` function handles formatting and conditional output based on the configured log level.
*   **Convenience Functions:** Specific functions (`debug`, `info`, `warn`, `error`) are exported and used throughout the backend codebase. These functions require the calling module's name as the first argument for context.
*   **Formatting:** Logs follow a pattern like: `[<Timestamp>] [<LEVEL>] [<ModuleName>] <Message>\n<Optional Metadata JSON>`
*   **Metadata Handling:** The utility safely stringifies metadata objects attached to logs, handling circular references and truncating long strings to prevent excessive log size or crashes.

### Example Usage (Conceptual)

```typescript
// In src/services/scanJobService.ts
import { info, error } from '../utils/logUtil';

const MODULE_NAME = 'ScanJobService';

export const initiateScanJob = async (...) => {
  info(MODULE_NAME, `Initiating scan job for Publishers: [...]`); // Log informational message
  try {
    // ... perform operations ...
    info(MODULE_NAME, `Created master ScanJob ${masterScanJob.id}`);
  } catch (err: any) {
    error(MODULE_NAME, `Failed to initiate scan job`, err); // Log error with metadata
    throw err; // Re-throw or handle error
  }
};
```

## Integration Points

*   **Backend Services/Repositories/Middleware:** Import and use the `debug`, `info`, `warn`, `error` functions from `logUtil.ts`.
*   **Console Output:** The primary destination for log messages.
*   **Environment Variable (`NODE_ENV`):** Controls the minimum log level (`DEBUG` vs. `INFO`).

## Best Practices

*   **Use Appropriate Levels:** Log messages at the correct severity level. Avoid excessive DEBUG logging in production.
*   **Provide Context:** Always include the module name. Add relevant metadata (e.g., IDs, parameters) where helpful, but avoid logging sensitive information like passwords or full API keys.
*   **Be Concise but Informative:** Log messages should clearly state what happened.
*   **Log Errors Effectively:** Always log errors when they are caught, including the error object itself (which contains the stack trace).
*   **Production Logging:** In production, ensure console output is captured, rotated, and potentially forwarded to a centralized logging platform (e.g., Datadog, Splunk, ELK stack) for easier analysis and alerting. Consider structured logging formats like JSON if integrating with external systems.
*   **Performance:** Be mindful of logging performance, especially frequent DEBUG logs or logging large objects within tight loops, although the current utility includes some safeguards (truncation, safe stringify).
