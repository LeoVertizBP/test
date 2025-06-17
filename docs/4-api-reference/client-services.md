# Client Services (Frontend API Layer)

## Overview

The frontend application utilizes a service layer (`frontend/src/services/`) to abstract and manage communication with the backend API. This promotes separation of concerns, making components cleaner and API interactions easier to manage and modify.

## Implementation

*   **Structure:** The `frontend/src/services/` directory contains individual service files, typically one for each major backend resource or feature area (e.g., `scanJobService.ts`, `flagService.ts`, `productService.ts`).
*   **Axios Client:** A centralized Axios instance is likely configured in `frontend/src/services/api/client.ts`. This instance typically handles:
    *   Setting the base URL for all backend API requests (e.g., `http://localhost:3001/api` or a production URL from environment variables).
    *   Configuring request interceptors to automatically attach the JWT `Authorization: Bearer <token>` header to outgoing requests (fetching the token from where it's stored, e.g., local storage).
    *   Potentially configuring response interceptors to handle common error scenarios (e.g., logging out the user on a 401 Unauthorized response).
*   **Endpoint Definitions:** API endpoint paths might be defined as constants in `frontend/src/services/api/endpoints.ts` for consistency.
*   **Service Functions:** Each service file (e.g., `scanJobService.ts`) exports functions that correspond to specific API operations. These functions use the configured Axios client to make the actual HTTP requests.
    *   **Example (`scanJobService.ts` - Conceptual):**
        ```typescript
        import apiClient from './api/client'; // Import configured Axios instance
        import { SCAN_JOBS_API } from './api/endpoints'; // Import endpoint constants

        export const startMultiTargetScan = async (data: { publisherIds: string[], ... }): Promise<ScanJob> => {
          try {
            const response = await apiClient.post(`${SCAN_JOBS_API}/start-multi-target-scan`, data);
            return response.data; // Return the data from the API response
          } catch (error) {
            // Handle or re-throw error (e.g., throw new Error('Failed to start scan'))
            console.error("Error starting multi-target scan:", error);
            throw error;
          }
        };

        export const getScanJobs = async (/* filters? */): Promise<ScanJob[]> => {
          // ... implementation using apiClient.get(SCAN_JOBS_API) ...
        };
        ```
*   **Component Interaction:** Frontend components import and call these service functions to fetch data or trigger actions, instead of interacting with `axios` directly. They handle the promise resolution (or use `async/await`) and manage loading/error states based on the service function's outcome.

## Benefits

*   **Abstraction:** Components don't need to know the specific API endpoint URLs or how `axios` is configured.
*   **Reusability:** API call logic is defined once in the service and reused by multiple components.
*   **Maintainability:** Changes to API endpoints or `axios` configuration are localized to the service layer.
*   **Testability:** Services can be mocked during component testing.

## Integration Points

*   **Frontend Components:** Import and call functions from the service files.
*   **Axios:** The underlying library used for making HTTP requests.
*   **Backend API:** The target of the HTTP requests made by the services.
*   **Authentication Context/Storage:** Services need access to the stored JWT to include it in requests (likely handled by an Axios interceptor configured in `client.ts`).
