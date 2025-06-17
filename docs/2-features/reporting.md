# Feature: Reporting & Dashboards

## Overview

The Reporting feature provides insights into the compliance scanning process, AI performance, and overall compliance posture through dashboards and potentially generated reports.

## Key Concepts

*   **Metrics & Statistics:** Aggregated data derived from scan jobs, content items, and flags (e.g., number of flags, violation rates, AI confidence distributions, processing times).
*   **Filtering:** The ability to narrow down report data based on criteria like date range, advertiser, product, or publisher.
*   **Dashboard:** A visual representation of key metrics and statistics, typically displayed in the frontend UI.
*   **Generated Reports:** Potentially more detailed or customized reports generated as files (e.g., CSV, PDF) for offline analysis or distribution.

## Implementation

### Dashboard Data API

The backend provides API endpoints specifically for fetching dashboard data:

*   **Endpoints:** Various `GET` endpoints under `/api/dashboard/` (e.g., `/flag-stats`, `/violation-stats`, `/ai-stats`, `/processing-metrics`, `/compliance-overview`, `/ai-confidence`).
*   **Summary Endpoint:** `GET /api/dashboard/summary` fetches all dashboard metrics in a single call for efficiency.
*   **Filtering:** Accepts query parameters like `startDate`, `endDate`, `publisherId`, `productId`, `advertiserId`.
*   **Access:** Authenticated users; data is scoped to the user's organization.
*   **Service:** Logic for calculating these metrics resides in `src/services/dashboardService.ts`.

### Frontend Dashboard (Conceptual)

*   **Purpose:** To visualize the key metrics fetched from the `/api/dashboard/*` endpoints.
*   **UI Interaction:**
    *   Users navigate to a "Dashboard" section in the UI.
    *   The UI likely presents charts, graphs, and key performance indicators (KPIs) summarizing:
        *   Flag counts and statuses over time.
        *   Violation rates by rule, product, or publisher.
        *   AI model performance (e.g., confidence score distribution, agreement with human reviewers).
        *   Scan processing times and volumes.
    *   Users can apply filters (date range, advertiser, etc.) to refine the displayed data.

### Generated Reports (Conceptual)

*   **Purpose:** Provide detailed data exports for offline analysis or specific reporting needs.
*   **Implementation:**
    *   Scripts like `generateScanPerformanceReport.ts` suggest the capability exists.
    *   These might be triggered via an API endpoint or run manually as CLI scripts.
    *   Output formats could include CSV, PDF, etc.
    *   Reports could cover scan performance, detailed flag exports, rule violation summaries, etc.

## Integration Points

*   **API Routes (`dashboardRoutes.ts`):** Expose endpoints for fetching dashboard metrics.
*   **Dashboard Service (`dashboardService.ts`):** Calculates and aggregates metrics from various database tables (`flags`, `scan_jobs`, `content_items`, `ai_usage_logs`, etc.).
*   **Database:** The source of all raw data used for reporting.
*   **Frontend UI:** Displays the dashboard visualizations.
*   **Reporting Scripts (`generateScanPerformanceReport.ts`):** Generate offline reports.

## User Flow (Dashboard Example)

1.  User logs in and navigates to the "Dashboard" section.
2.  Frontend calls `GET /api/dashboard/summary` (or individual metric endpoints) with default filters (e.g., last 30 days).
3.  Backend `dashboardService` queries the database, aggregates data for the user's organization based on filters.
4.  Backend API returns the calculated metrics as JSON.
5.  Frontend renders the data using charts, graphs, and summary statistics.
6.  User applies filters (e.g., selects a specific advertiser or date range).
7.  Frontend re-calls the API endpoints with the updated filter query parameters.
8.  Dashboard updates with the filtered data.

## Best Practices

*   **Performance:** Dashboard queries can be intensive. Optimize database queries using appropriate indexes. Consider caching aggregated results or using materialized views for frequently accessed reports. Fetching data in parallel (as done in the `/summary` endpoint) improves frontend load times.
*   **Clarity:** Ensure metrics are clearly defined and visualizations are easy to understand.
*   **Filtering:** Provide useful and intuitive filtering options.
*   **Accuracy:** Regularly validate that the metrics accurately reflect the underlying data.
*   **Access Control:** Ensure users can only see data relevant to their organization or permissions.
