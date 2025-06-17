# Error Handling

## Overview

This document describes the strategies used for handling errors in both the backend API server and the frontend web application.

## Backend Error Handling

### Strategy

The backend employs a centralized error handling strategy common in Express.js applications.

1.  **Synchronous Errors:** Errors thrown in synchronous route handlers or middleware are automatically caught by Express and passed to the error handling middleware.
2.  **Asynchronous Errors:** Errors occurring in asynchronous operations (like database queries or external API calls within `async` functions) must be explicitly caught (using `try...catch`) and passed to the `next()` function (e.g., `next(error)`). Libraries like `express-async-handler` can automate this for route handlers.
3.  **Centralized Error Handler:** A dedicated error-handling middleware is registered at the *end* of the middleware stack in `src/app.ts`. This middleware has a special signature `(err, req, res, next)`.
    *   It catches any errors passed via `next(err)`.
    *   It logs the error details (including the stack trace) to the console for debugging purposes (`console.error`).
    *   It sends a generic `500 Internal Server Error` response to the client with a simple JSON message (`{ message: 'An internal server error occurred.' }`). This avoids leaking potentially sensitive stack trace information to the client, especially in production.
4.  **Specific Error Responses:** Individual route handlers or services might handle specific, expected errors (e.g., validation errors, "not found" errors) by sending appropriate HTTP status codes (e.g., 400 Bad Request, 404 Not Found) and more descriptive JSON error messages *before* the error reaches the centralized handler.

### Implementation

*   **Centralized Handler:** Defined in `src/app.ts` using `app.use((err, req, res, next) => { ... });`.
*   **Async Handling:** Requires `try...catch` blocks in async functions calling `next(error)` or the use of wrappers like `express-async-handler`.
*   **Logging:** Errors are logged to the console via `console.error`. More sophisticated logging could be implemented using a dedicated logging library (see `logging.md`).

```mermaid
graph TD
    A[Request Enters Route Handler] --> B{Async Operation (e.g., DB Query)};
    B -- Success --> C[Process Result];
    B -- Failure --> D{Error Occurs};
    D --> E{try...catch block?};
    E -- Yes --> F[Call next(error)];
    E -- No --> G[Node.js Unhandled Rejection / Crash];
    F --> H[Centralized Error Middleware (app.ts)];
    H --> I[Log Error to Console];
    H --> J[Send Generic 500 Response to Client];
    C --> K[Send Success Response to Client];

    style G fill:#f9f,stroke:#333,stroke-width:2px
```

## Frontend Error Handling

### Strategy

Frontend error handling primarily focuses on managing errors related to API calls and user interactions within React components.

1.  **API Call Errors:**
    *   API requests made using `axios` (likely within frontend services or directly in components) are typically wrapped in `try...catch` blocks or use promise `.catch()` handlers.
    *   When an API call fails (e.g., network error, backend error response like 4xx or 5xx), the error is caught.
    *   Component state (using `useState`) is updated to reflect the error status (e.g., `setError(true)`, `setErrorMessage('Failed to load data')`).
    *   The UI is conditionally rendered to display an appropriate error message or feedback to the user based on the error state.
    *   Loading states are also managed similarly to provide feedback during the API call.
2.  **React Component Errors:**
    *   **Error Boundaries:** React Error Boundaries (special components defined using `componentDidCatch` or `getDerivedStateFromError`) can be used to catch JavaScript errors occurring *during rendering*, in lifecycle methods, and constructors of their child component tree. They allow displaying a fallback UI instead of crashing the entire component tree. These might be implemented at key points in the application (e.g., around major layout sections or routes).
    *   **Standard JavaScript Errors:** Errors in event handlers or asynchronous code outside the rendering lifecycle need to be handled using standard `try...catch`.

### Implementation

*   **API Calls:** `try...catch` around `await axios.get(...)` or `.catch()` chained to `axios.post(...).then(...).catch(...)`.
*   **State Management:** `useState` hooks within components to store error messages and boolean flags for conditional rendering.
*   **UI Feedback:** Displaying error messages, disabling buttons, or showing alternative UI elements based on the error state.
*   **Error Boundaries:** Class components implementing `componentDidCatch` or functional components using libraries that provide similar functionality.

## Integration Points

*   **Backend Centralized Handler:** The ultimate fallback for unhandled backend errors.
*   **Frontend API Service Layer:** Wraps `axios` calls and potentially standardizes error handling/formatting.
*   **Frontend Components:** Use `useState` and conditional rendering to display errors originating from API calls or user interactions.
*   **React Error Boundaries:** Catch rendering errors in the component tree.

## Best Practices

*   **Backend:** Log errors effectively with sufficient context (stack trace, request details if safe). Use specific HTTP status codes for expected errors (400, 401, 403, 404). Avoid exposing sensitive error details to the client in production.
*   **Frontend:** Provide clear and user-friendly error messages. Manage loading and error states consistently for API calls. Use Error Boundaries to prevent component tree crashes. Log frontend errors to a monitoring service for better visibility.
*   **Consistency:** Maintain a consistent error response format from the backend API.
