# Feature: Scan Management

## Overview

Scan Management encompasses the features allowing users to initiate, monitor, and potentially manage content scanning jobs within the Credit Compliance Tool.

## Key Concepts

*   **Scan Job:** The primary entity representing a request to scan content. It can target single or multiple channels/publishers/platforms.
*   **Scan Job Run:** Represents the execution of a specific scraping task (e.g., an Apify run) for one channel within a larger Scan Job.
*   **Scan Target:** The specific content source(s) to be scanned, defined by publisher channels, platforms, and potentially focused on specific products.

## Implementation

### Initiating Scans

Users can trigger scans via the backend API:

1.  **Single Channel Scan:**
    *   **Endpoint:** `POST /api/scan-jobs/start-channel-scan`
    *   **Access:** Authenticated users.
    *   **Body:** `{ "publisherChannelId": "uuid-of-channel" }`
    *   **Action:** Retrieves the specified channel's details (publisher ID, platform) and calls `scanJobService.initiateScanJob` to create a master scan job and trigger the Apify run for that single channel.

2.  **Multi-Target Scan:**
    *   **Endpoint:** `POST /api/scan-jobs/start-multi-target-scan`
    *   **Access:** Authenticated users.
    *   **Body:** `{ "publisherIds": ["uuid", ...], "platformTypes": ["YouTube", "TikTok", "Instagram", "YOUTUBE_SHORTS", ...], "productIds": ["uuid", ...], "jobName": "Optional Name", "jobDescription": "Optional Desc" }`
    *   **Action:** Calls `scanJobService.initiateScanJob` directly with the provided arrays. The service identifies all eligible channels matching the criteria, creates a master scan job linking the publishers and products, and triggers individual Apify runs for each eligible channel.
    *   **Note on YouTube Shorts:** The platform type `YOUTUBE_SHORTS` is supported. It uses the standard YouTube scraper (`streamers/youtube-scraper`) configured to target Shorts content. A previous issue where scans failed due to an attempt to save to a non-existent `transcript_vtt_gcs_url` field was fixed by removing this field reference in `src/services/scanJobService.ts`. Transcripts are correctly stored in the `transcript` JSON field.

### Monitoring Scans

*   **Backend Process:** The `scanJobService.monitorActiveScanRuns` function runs periodically (e.g., every 15 seconds, as configured in `src/server.ts`).
*   **Mechanism:** It queries the database for `scan_job_runs` with status `STARTED`. For each active run, it calls `scanJobService.processApifyRunCompletion` which checks the actual status on Apify.
*   **Status Updates:** Based on the Apify status, the `scan_job_runs` status is updated (e.g., `FETCHING_RESULTS`, `COMPLETED`, `FAILED`). When all runs associated with a master `scan_jobs` record are finished, the master job's status is updated (`COMPLETED`, `COMPLETED_WITH_ERRORS`).
*   **Frontend Display (Assumed):** The frontend likely has sections to:
    *   List recent or ongoing Scan Jobs (`scan_jobs` table).
    *   Display the overall status of a Scan Job.
    *   Potentially show the status of individual Scan Job Runs (`scan_job_runs`) associated with a master job.
    *   This would involve fetching data from backend API endpoints (e.g., `GET /api/scan-jobs`, `GET /api/scan-jobs/:id`, `GET /api/scan-jobs/:id/runs` - *Note: These GET endpoints are assumed and may need to be implemented*).

### Canceling Scans (Potential Feature)

*   **Functionality:** While not explicitly shown in the provided route file, functionality to cancel an *ongoing* Apify run might exist or could be added.
*   **Implementation:** This would likely involve:
    *   A backend API endpoint (e.g., `POST /api/scan-jobs/runs/:runId/cancel`).
    *   A service function in `apifyService.ts` to call the Apify API's "abort run" endpoint.
    *   Updating the corresponding `scan_job_runs` status to `ABORTED` or `CANCELLED`.
    *   Updating the master `scan_jobs` status accordingly if all other runs are finished.
    *   A UI element (e.g., a cancel button) on the frontend for ongoing runs/jobs.

## Integration Points

*   **API Routes (`src/routes/scanJobRoutes.ts`):** Exposes endpoints for initiating scans. Needs endpoints for listing/viewing jobs and runs.
*   **Scan Job Service (`src/services/scanJobService.ts`):** Contains the core logic for initiating, monitoring, and processing scan jobs and runs.
*   **Apify Service (`src/services/apifyService.ts`):** Interacts with the Apify platform API.
*   **Database:** Stores `scan_jobs` and `scan_job_runs` records, tracking status and relationships.
*   **Frontend UI:** Provides the interface for users to trigger scans and view their progress/status.

## User Flow (Conceptual)

1.  User navigates to a "Scans" or "Start Scan" section in the frontend.
2.  User selects target publishers, platforms, and optionally products.
3.  User clicks "Start Scan".
4.  Frontend calls the appropriate `POST /api/scan-jobs/...` endpoint.
5.  Backend initiates the scan job and associated runs via `scanJobService`.
6.  Backend responds with the created master scan job details.
7.  Frontend displays confirmation and potentially navigates to a job status page.
8.  User monitors the job status page, which periodically fetches updates from the backend API (e.g., `GET /api/scan-jobs/:id`).
9.  Backend monitoring process (`monitorActiveScanRuns`) updates job/run statuses in the database as Apify runs complete.
10. Frontend reflects the updated statuses (Running -> Fetching -> Completed/Failed).

## Best Practices

*   **Clear Status Communication:** Provide clear and distinct statuses for both master jobs and individual runs (e.g., Initializing, Running, Fetching Results, Completed, Partially Completed, Failed, Cancelled).
*   **User Feedback:** Give immediate feedback when a scan is initiated. Provide progress indicators where possible.
*   **Error Handling:** Clearly report errors during initiation (e.g., invalid targets) or execution (e.g., Apify run failures).
*   **Scalability:** Ensure the monitoring process can handle a large number of concurrent runs without overwhelming the database or Apify API. Consider background job queues for more complex orchestration.
