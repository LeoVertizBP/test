# Website Crawler MVP: Automated Domain Capture Guide

## Overview

This sprint focused on upgrading the website crawler from a single-URL capture tool to a system capable of automatically discovering and capturing all relevant pages within a specified publisher's domain.

**Key achievements:**

*   **URL Discovery:** Implemented logic to find URLs using both `/sitemap.xml` parsing (including nested sitemaps) and aggressive link crawling (ignoring `robots.txt` and exclusions).
*   **Auto-Scroll:** Added a utility to ensure pages are fully scrolled before capture, improving handling of lazy-loaded content.
*   **Capture Worker Upgrade:** The core `captureWorker` now orchestrates the full process:
    *   Takes a `publisherId` and `scanJobId`.
    *   Performs URL discovery for the publisher's domain (using the `channel_url` from `publisher_channels`).
    *   Launches a browser instance.
    *   Iterates through discovered URLs (up to an optional `maxPages` limit).
    *   For each URL: navigates, auto-scrolls, captures HTML, takes a full-page PNG screenshot.
    *   Calculates SHA-256 hashes for both artifacts.
    *   Uploads artifacts to GCS (`html/` and `screenshots/` prefixes).
    *   Creates corresponding `content_items` and `content_files` records in the database.
    *   Enqueues the `contentItemId` into the `evaluate` queue for subsequent AI analysis.
*   **CLI Seeder:** Updated the `npm run enqueue` script to trigger a full domain capture for a publisher.
*   **Basic Helm Chart:** Created a basic Helm chart structure (`charts/crawler/`) including `values.yaml` with a `replicaCount` setting (defaulting to 2) to facilitate future Kubernetes deployment and scaling.

**Note on Login:** While a login utility (`src/utils/login.ts`) was created, automatic login attempts have been temporarily disabled in the worker pending clarification on secure credential storage and access methods based on the database schema.

## How to Use

### Prerequisites

1.  **Environment Variables:** Ensure your `.env` file contains valid values for `REDIS_URL`, `GCS_BUCKET_NAME`, `DATABASE_URL`, and `USER_AGENT`.
2.  **Publisher Setup:** Ensure the target publisher exists in the `publishers` table and has a corresponding entry in `publisher_channels` with `platform: 'website'` and a valid `channel_url`.
3.  **Scan Job:** Ensure a relevant `scan_jobs` record exists. You will need its UUID.

### Enqueueing a Publisher Domain Scan

To start the capture process for a specific publisher, use the `npm run enqueue` command:

```bash
npm run enqueue -- --publisherId <publisher-uuid> --scanJobId <scan-job-uuid> [--maxPages <number>]
```

**Arguments:**

*   `--publisherId` / `-p` (Required): The UUID of the publisher record in the database.
*   `--scanJobId` / `-s` (Required): The UUID of the scan job record to associate the captured content with.
*   `--maxPages` / `-m` (Optional): Limits the total number of unique pages (discovered via sitemap + crawl) that will be captured. Useful for testing or partial scans. If omitted, the crawler will attempt to capture all discoverable pages.

**Example:**

```bash
npm run enqueue -- --publisherId 123e4567-e89b-12d3-a456-426614174000 --scanJobId 876e4567-e89b-12d3-a456-426614174001 --maxPages 50
```

This command will add a job to the `capture` queue. A running `captureWorker` instance will pick up this job and begin the discovery and capture process for the specified publisher.

## Verifying Results

After a job completes (monitor worker logs for progress):

1.  **GCS Bucket:** Check the configured `GCS_BUCKET_NAME`. You should find:
    *   HTML files in the `html/` prefix (e.g., `html/<uuid>.html`).
    *   Screenshot files in the `screenshots/` prefix (e.g., `screenshots/<uuid>.png`).
    *   The number of files should correspond to the number of successfully processed URLs.
2.  **Database:**
    *   Query the `content_items` table for records matching the `scan_job_id` and `publisher_id`. The count should match the number of successfully processed URLs.
    *   For each `content_items` record, query the `content_files` table. There should be exactly two records: one with `fileType: 'html'` and one with `fileType: 'screenshot'`, linking back to the `content_items.id`. The `filePath` and `sha256` should match the GCS uploads.
3.  **Redis (Evaluate Queue):** Check the length of the `evaluate` queue. It should contain one job for each successfully processed URL, with the job data containing the corresponding `contentItemId`.

## Scaling (Helm)

A basic Helm chart is located in `charts/crawler/`. For deployment to Kubernetes, this chart can be used. The number of concurrent crawler workers is controlled by the `replicaCount` value in `charts/crawler/values.yaml`.

```yaml
# charts/crawler/values.yaml
replicaCount: 2 # Default value
```

Adjust this value and perform a `helm upgrade` to scale the number of worker pods running in Kubernetes. Note that the actual deployment and testing of this Helm chart require a Kubernetes environment.
