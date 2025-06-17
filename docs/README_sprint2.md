# Sprint 2 - Image Capture + Publisher Profile Admin UI

## Overview

This sprint focuses on two key enhancements:

1. **Image Capture**: The crawler now captures inline images from webpages, uploads them to GCS, and tracks them in the database.
2. **Publisher Profile Admin UI**: Operations staff can now create and manage website crawler configurations through a web interface.

## New Features

### Publisher Profile Management

- **Profile CRUD Operations**: Create, read, update, and delete publisher crawl settings
- **Test Crawl**: Estimate URL and image counts before running a full crawl
- **Configuration Options**:
  - Base URL and sitemap URL
  - Domain inclusion/exclusion rules
  - Max pages and crawl depth limits
  - Maximum image size

### Image Capture System

- Automated discovery and downloading of inline images
- SHA-256 based deduplication of identical images
- GCS storage integration
- Database tracking via `content_files` table

## How to Use

### Publisher Configuration UI

1. Navigate to the Publishers section
2. Find the website channel you want to configure
3. Click the website badge to open the configuration modal
4. Enter crawl settings:
   - Name: A descriptive name for this configuration
   - Sitemap URL (optional): For efficient URL discovery
   - Login Credentials (optional): For accessing gated content
   - Include Domains: Which domains to include in the crawl
   - Exclude Patterns: URL patterns to skip
   - Page/Depth Limits: Control crawl size
   - Image Size Limit: Skip images larger than this size
5. Save the configuration
6. Click "Test Crawl" to see estimated content counts
7. Run a full crawl from the publisher dashboard

### Technical Details

- Configurations are stored in the `publisher_channel_configs` table
- Credentials are securely stored in Secret Manager
- The crawler automatically loads configurations from the database
- Images are stored at `images/{sha256}.{ext}` in the GCS bucket
- Duplicate images are detected and only stored once

## Implementation Notes

- Image downloads are handled asynchronously to maintain crawl speed
- The Test Crawl endpoint samples URLs to estimate image counts
- Puppet is used for both crawling and image processing
