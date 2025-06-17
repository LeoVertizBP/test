# Deployment Guide## Deployment using Docker (Recommended for Cloud)

Using Docker containers simplifies deployment, especially to cloud platforms like Google Cloud. The general workflow is:

1.  **Build Docker Images:** Ensure your `Dockerfile`s (in the root and `frontend` directories) and `docker-compose.yml` are up-to-date. Build the production-ready images. You can often tag these images for a specific release:
    ```bash
    # Example tagging with 'latest' and a version number
    docker-compose build
    docker tag credit-compliance-tool-backend:latest gcr.io/YOUR_GCP_PROJECT_ID/credit-compliance-tool-backend:v1.0.0
    docker tag credit-compliance-tool-frontend:latest gcr.io/YOUR_GCP_PROJECT_ID/credit-compliance-tool-frontend:v1.0.0
    ```
    *(Replace `YOUR_GCP_PROJECT_ID` and `v1.0.0` accordingly)*

2.  **Push Images to Registry:** Push the tagged images to a container registry accessible by your cloud provider (e.g., Google Container Registry - GCR, or Artifact Registry).
    ```bash
    # Authenticate Docker with GCP (if needed)
    gcloud auth configure-docker

    # Push images
    docker push gcr.io/YOUR_GCP_PROJECT_ID/credit-compliance-tool-backend:v1.0.0
    docker push gcr.io/YOUR_GCP_PROJECT_ID/credit-compliance-tool-frontend:v1.0.0
    ```

3.  **Deploy to Cloud Service:** Deploy the images using a suitable Google Cloud service:
    *   **Google Cloud Run:** Ideal for stateless applications. You deploy each service (backend, frontend) separately, pointing to the pushed image URLs. Cloud Run handles scaling and infrastructure. Ensure environment variables (like `DATABASE_URL`, `JWT_SECRET`, etc.) are configured securely within the Cloud Run service definition (using Secret Manager is recommended).
    *   **Google Kubernetes Engine (GKE):** Suitable for more complex, stateful applications or microservices requiring orchestration. This involves creating Kubernetes deployment and service manifests.
    *   **Note on Multiple Workloads:** With the introduction of background workers (like the Website Crawler), you might deploy multiple workloads (e.g., API Server, Crawler Worker) from the *same backend Docker image*. Your deployment configuration (e.g., Kubernetes Deployments) will specify different startup commands (`CMD`) for each workload type (e.g., `node dist/server.js` for the API, `node dist/workers/captureWorker.js` for the crawler).

4.  **Database Connection:** Ensure your deployed backend container can securely connect to your Google Cloud SQL database. This typically involves:
    *   Configuring the `DATABASE_URL` environment variable in your Cloud Run/GKE service.
    *   Setting up VPC Network Peering or using the Cloud SQL Auth Proxy sidecar container (common in GKE) for secure connections.
    *   Configuring firewall rules appropriately.

5.  **Environment Variables:** Securely manage all required environment variables (API keys, secrets, database URLs) in the cloud environment, preferably using a service like Google Secret Manager. Key variables include:
    *   `DATABASE_URL`: Connection string for the database.
    *   `JWT_SECRET`: Secret key for signing authentication tokens.
    *   `FRONTEND_URL`: The public URL of the deployed frontend application (e.g., `https://your-app.com`). This is crucial for the backend's CORS policy to allow requests from the frontend.
    *   `GCS_BUCKET_NAME` (if using GCS): Name of the Google Cloud Storage bucket.
    *   `GOOGLE_APPLICATION_CREDENTIALS` (if using GCP services): Path to service account key within the container (usually mounted).
    *   `VERTEX_AI_PROJECT_ID`, `VERTEX_AI_LOCATION` (if using Vertex AI).
    *   `APIFY_API_TOKEN` (if using Apify).
    *   `SHOT_RATE_PER_MIN`, `CACHE_WINDOW_SEC` (for screenshot feature configuration).
    *   `REDIS_URL` (Required for BullMQ queues used by workers like the website crawler).
    *   `USER_AGENT` (Optional, but recommended for the website crawler worker to identify itself).

---


This document outlines the deployment process for the Credit Compliance Tool.

## Deployment Script

We provide an enhanced deployment script (`deploy.sh`) that handles the complete deployment workflow with error handling, logging, and environment-specific configurations.

### Quick Start

```bash
# Make the script executable (first time only)
chmod +x deploy.sh

# Basic usage (defaults to development environment)
./deploy.sh

# Deploy to specific environment
DEPLOY_ENV=staging ./deploy.sh
DEPLOY_ENV=production ./deploy.sh
```

### What the Script Does

1. **Environment Detection**: Adapts behavior based on deployment environment
2. **Backup Creation**: Creates a timestamped backup directory
3. **Database Backup**: Creates a schema backup on non-development environments
4. **Code Update**: Pulls latest code on non-development environments (commented by default)
5. **Dependency Installation**: Runs `npm install`
6. **Prisma Client Generation**: Regenerates TypeScript client from schema
7. **Application Build**: Compiles TypeScript using `npm run build`
8. **Database Migrations**: Applies pending migrations using `npx prisma migrate deploy`
9. **Service Restart**: Restarts the application service (environment-specific)

### Environment-Specific Behavior

The script adapts based on the environment:

- **Development**: No Git pull, no schema backup, no service restart
- **Staging**: Includes schema backup, Git pull, and PM2 service restart
- **Production**: Includes schema backup, Git pull, and systemd service restart

To specify the environment:
```bash
DEPLOY_ENV=staging ./deploy.sh
```

## Critical Steps Explained

### Schema Changes and Prisma Client Generation

**IMPORTANT**: After any schema changes, the Prisma client MUST be regenerated. The deployment script handles this automatically, but it's critical to understand why this is necessary.

If you skip this step, you might encounter issues like:
- New fields being `null` in the database even when data is provided
- TypeScript errors related to missing fields
- Runtime errors when trying to access fields that the client doesn't recognize
- Mismatch between database schema and application code

The regeneration step ensures the TypeScript Prisma client accurately reflects your database schema by creating type-safe interfaces that match your database structure.

## Manual Deployment Steps

If you need to perform a manual deployment:

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Regenerate Prisma Client** (CRITICAL after schema changes)
   ```bash
   npx prisma generate
   ```

3. **Build the Application**
   ```bash
   npm run build
   ```

4. **Apply Database Migrations** (if needed)
   ```bash
   npx prisma migrate deploy
   ```

5. **Restart the Application**
   - Development: `npm run dev`
   - Staging (PM2): `pm2 restart app-staging`
   - Production (systemd): `sudo systemctl restart credit-compliance-service`

## Comprehensive Troubleshooting Guide

### Schema Change Issues

If you encounter issues where data isn't being saved correctly or fields are always null:

1. Verify that the Prisma client has been regenerated:
   ```bash
   npx prisma generate
   ```

2. Clear Prisma's cache (sometimes necessary after schema changes):
   ```bash
   rm -rf node_modules/.prisma
   npm install # Reinstall to rebuild Prisma
   ```

3. Restart the application to ensure it's using the updated client

4. Verify the database schema matches your Prisma schema:
   ```bash
   npx prisma db pull --print
   # Compare the output with your schema.prisma file
   ```

5. Check for TypeScript errors in your codebase:
   ```bash
   npx tsc --noEmit
   ```

### Build Process Failures

If the build process fails:

1. Check for TypeScript errors:
   ```bash
   npx tsc --noEmit
   ```

2. Verify all dependencies are installed:
   ```bash
   rm -rf node_modules
   npm install
   ```

3. Check for circular dependencies or import errors:
   ```bash
   npm run build -- --verbose
   ```

### Migration Issues

If database migrations fail:

1. Check database connection:
   ```bash
   npx prisma db pull --print
   ```

2. Review migration history:
   ```bash
   npx prisma migrate status
   ```

3. For serious issues, consider resetting the development database (NEVER in production):
   ```bash
   npx prisma migrate reset # DEVELOPMENT ONLY
   ```

4. Review migration files manually for conflicts

### Repository Pattern Issues

Our codebase implements the repository pattern with specific repositories for each entity. When table names change in the schema:

1. Update the corresponding repository files to reference the new table names
2. Ensure imports reference the new model names
3. Update function signatures and field references
4. Check for references in service files that may be calling the repositories

Common areas to check:
- Import statements in service files
- Service function calls passing data to repositories
- Route handlers that import repositories directly

## Recent Changes

### Table Name Updates

Several tables have been renamed to improve consistency:
- `affiliates` → `publishers`
- `affiliate_channels` → `publisher_channels`
- `affiliate_products` → `publisher_products`
- `scan_job_affiliates` → `scan_job_publishers`

This affects the following files, which have been updated:
- Repository files:
  - `affiliateRepository.ts` → `publisherRepository.ts`
  - `affiliateChannelRepository.ts` → `publisherChannelRepository.ts`
  - `affiliateProductRepository.ts` → `publisherProductRepository.ts`
  - `scanJobAffiliateRepository.ts` → `scanJobPublisherRepository.ts`
  - `scanJobChannelRepository.ts` (updated references from affiliates to publishers)

- Service files:
  - `publisherService.ts` (updated from affiliateService.ts)
  - `scanJobService.ts` (updated references to publisher entities)

### Deployment Script Enhancement

The deployment script has been enhanced with:
- Environment-specific behavior
- Backup creation
- Improved error handling
- Colored logging
- Database schema backup
- Conditional service restart
