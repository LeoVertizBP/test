# Phased Deployment Plan to Google Cloud Platform (GCP)

## 1. Introduction

This document outlines a phased plan for deploying the Credit Compliance Tool to the Google Cloud Platform (GCP). The plan includes setting up staging and production environments, implementing CI/CD (Continuous Integration/Continuous Deployment), and integrating testing best practices throughout the process.

## 2. Critical Prerequisite: Code Repository [COMPLETED - 2025-05-20]

**Before any cloud deployment or CI/CD setup can begin, the project's codebase MUST be placed under version control in a hosted Git repository.** [COMPLETED - 2025-05-20: Code pushed to `https://github.com/tcormier321/airora.git`]

*   **Recommendation:** Use GitHub (or GitLab, Google Cloud Source Repositories).
*   **Action:**
    1.  Create a new private repository on your chosen platform.
    2.  Initialize Git in your local project folder (`git init`).
    3.  Add project files (`git add .`).
    4.  Commit files (`git commit -m "Initial project commit"`).
    5.  Link local repo to the remote and push (`git remote add origin <repository_url>`, `git push -u origin main` (or `master`)).

## 2.5 Pre-Commit Housekeeping & Considerations (Added 2025-05-20)

Before the initial commit to the Git repository, the following considerations were addressed:

### a. `.gitignore` Configuration

The project's `.gitignore` file was updated to exclude build artifacts, logs, temporary files, and other non-source files. The following patterns/directories were added:

```
# Compiled output
dist/
frontend/dist/
frontend/.next/

# Test coverage
coverage/

# Logs
*.log
job_logs_output/

# macOS specific
.DS_Store

# Temporary Ignores (to be reviewed post-initial deployment)
data-exports/
temp-scripts/
temp-scripts copy/
memory-bank/
migrations/ # Root migrations directory (node-pg-migrate), see note below.
```

### b. Database Migration System Update (As of 2025-05-20)

*   **Initial Observation:** The project appeared to use two database migration systems:
    1.  **`node-pg-migrate`**: Managed via the root `migrations/` directory and an `npm run migrate` script.
    2.  **Prisma Migrate**: Managed via `prisma/schema.prisma` and the `prisma/migrations/` directory.
*   **Investigation Findings (2025-05-20):**
    *   A thorough investigation confirmed that `node-pg-migrate` is a **legacy system**.
    *   **Prisma Migrate is the current and sole active migration system.**
*   **Updated Cleanup Task:**
    *   **Action Completed (2025-05-20):** `node-pg-migrate` dependency and script removed from `package.json`.
    *   **Remaining Actions:** Ensure no inadvertent dependencies on the old system. Future schema changes via Prisma Migrate.
*   **Conclusion:** Consolidated to Prisma Migrate. Database migrations for GCP will use `npx prisma migrate deploy`.

## 3. Phased Approach Overview

The deployment will proceed in three main phases:

*   **Phase 1: Foundations & Manual Staging Deployment:** Establish core cloud infrastructure and get the application running in a staging environment on GCP. [Largely COMPLETED, focusing on application-level testing]
*   **Phase 2: Basic CI/CD & Production Setup:** Automate builds and deployments to staging, then replicate for production.
*   **Phase 3: Maturing Operations & CI/CD:** Enhance automation, monitoring, security, and testing.

---

## 4. Detailed Phases

### Phase 1: Foundations & Manual Staging Deployment

**Goal:** Get the application running on GCP in a staging environment, establish basic cloud infrastructure, and put the code under version control.

**Steps:**

1.  **Set up Git Repository:** [COMPLETED - 2025-05-20]
2.  **GCP Project Setup (Staging):** [COMPLETED - 2025-05-22]
    *   Project `ai-compliance` confirmed.
    *   APIs enabled: Cloud Run, Cloud SQL, Memorystore for Redis, Artifact Registry, Secret Manager, Cloud Build.
    *   Billing enabled.
3.  **Staging Infrastructure Provisioning:** [COMPLETED - 2025-05-22]
    *   **Cloud SQL for PostgreSQL (Staging):** Instance `airora-staging-db-main` (PostgreSQL 17) in `us-south1`; database `airora_staging_db`. Private IP enabled (2025-05-29).
    *   **Memorystore for Redis (Staging):** Instance `airora-staging-redis-main` in `us-south1`.
    *   **Secret Manager:** Secrets `airora-staging-db-password`, `airora-staging-jwt-secret`, `airora-staging-apify-token` created.
    *   **Artifact Registry:** Repositories `airora-staging-repo-backend` and `airora-staging-repo-frontend` created.
4.  **Dockerfile Refinement:** [COMPLETED - 2025-05-22, with subsequent modifications for self-hosted proxy 2025-05-29]
    *   Root `Dockerfile` (Backend/Workers) and `frontend/Dockerfile` refined with multi-stage builds and non-root users.
    *   Root `Dockerfile` updated to support self-hosted Cloud SQL Auth Proxy (installing `curl`, downloading proxy binary, copying `start.sh`).
5.  **Manual Build & Push to Artifact Registry:** [COMPLETED - 2025-05-30]
    *   Backend Image: `us-south1-docker.pkg.dev/ai-compliance/airora-staging-repo-backend/backend-app:v28-db-fixed` (example tag for image deployed 2025-05-29 containing all DB connection fixes) [PUSHED - 2025-05-29]
    *   Frontend Image: `us-south1-docker.pkg.dev/ai-compliance/airora-staging-repo-frontend/frontend-app:staging-amd64-v1` [PUSHED - 2025-05-23]
6.  **Manual Deployment to Cloud Run (Staging):** [COMPLETED - 2025-05-30]
    *   `backend-staging`, `crawler-worker-staging`, `ai-bypass-worker-staging`: [SERVICES DEPLOYED, DB CONNECTION RESOLVED 2025-05-29]
        *   **Image Used (example):** `us-south1-docker.pkg.dev/ai-compliance/airora-staging-repo-backend/backend-app:v28-db-fixed` (or latest tag with all fixes).
        *   **Service Account:** `airora-backend-staging-sa@ai-compliance.iam.gserviceaccount.com` (Permissions: Secret Manager Accessor, Cloud SQL Client, Storage Object Admin).
        *   **Key Configuration:** Uses self-hosted Cloud SQL Auth Proxy via `start.sh` (with `--private-ip`, `--debug-logs`), connects to Cloud SQL via Private IP through a Serverless VPC Access Connector (`airora-staging-connector`). Managed Cloud SQL connection in Cloud Run service is DISABLED.
        *   **Troubleshooting Summary:** Initial deployments faced significant database connectivity issues. These were resolved on 2025-05-29 after extensive troubleshooting involving the Cloud SQL Auth Proxy configuration, Prisma connection string adjustments, and enabling Private IP networking. The backend services now successfully connect to Redis and PostgreSQL. (See Appendix A for full troubleshooting details).
    *   `frontend-staging`: [DEPLOYED - 2025-05-23]
        *   Configuration largely unchanged from initial deployment. Connectivity to backend needs re-verification.
7.  **Database Migration (Staging):** [COMPLETED - 2025-05-23]
    *   The `airora_staging_db` database contains the complete schema as defined by `prisma/schema.prisma`.
8.  **Initial Testing & DNS (Staging) [Updated 2025-06-02]:**
    *   **Backend Database Connectivity: [RESOLVED with follow-up issues fixed]**
        *   Initial Cloud SQL connectivity resolved via self-hosted proxy (see Appendix A)
        *   Secondary issue discovered: 28 instances of `new PrismaClient()` bypassing centralized configuration
        *   **Resolution:** Consolidated all Prisma client usage to shared instance (deployed as v32-prisma-consolidation)
    *   **Current Staging Environment Status & Next Actions (as of 2025-06-02):**
        *   **Prisma Client Consolidation: [COMPLETED]** All 28 files now use the shared Prisma client instance
        *   **Database Connection Architecture: [STABLE]** Dynamic DATABASE_URL construction working correctly across all services
        *   **Application-Level Authentication: [RESOLVED]** Login functionality confirmed working after Prisma consolidation
        *   **API Endpoint Status:**
            *   Most endpoints functioning correctly
            *   Two failing endpoints require investigation:
                - `/api/dashboard/violation-stats`: Likely empty database edge case in `getViolationStatsByOrganization` query
                - `/api/dashboard/flag-stats`: Likely empty database edge case in `getFlagStatsByOrganization` query
            *   **Next Action:** Add proper error handling for empty result sets in dashboard repository queries
        *   **Frontend Integration: [NEEDS VERIFICATION]** Test full application flow with resolved backend
        *   **Environment Variables: [RESOLVED - 2025-06-03]** Warnings for `GOOGLE_SECRET_MANAGER_CREDENTIALS_PATH` and `GCS_BUCKET_NAME` (related to `GOOGLE_APPLICATION_CREDENTIALS`) resolved.
            *   **Fix Details:** Modified `src/services/secretManagerService.ts` and `src/services/gcsService.ts` to correctly initialize Google Cloud clients using Application Default Credentials (ADC) when specific key file environment variables are not set. This allows the services to leverage the attached service account in Cloud Run.
            *   **Impact:** Services now initialize correctly in Cloud Run without requiring explicit credential file paths, and associated warnings are gone.
        *   **Redis Configuration: [COMPLETED - 2025-06-03]** Eviction policy warning resolved.
            *   **Fix Details:** Changed Memorystore for Redis instance `airora-staging-redis-main` maxmemory policy from `volatile-lru` to `noeviction` via `gcloud redis instances update airora-staging-redis-main --region=us-south1 --update-redis-config maxmemory-policy=noeviction`. This addresses the warning from BullMQ which requires `noeviction` to prevent job data loss.
        *   **DNS Configuration: [PENDING]** Custom subdomain setup awaiting full application verification

---

## 5. Key Technologies Summary

This project and its deployment to GCP leverage the following key technologies:

*   **Google Cloud Platform (GCP):**
    *   **Cloud Run:** For serving the containerized backend, frontend, and worker applications.
    *   **Cloud SQL for PostgreSQL:** Managed PostgreSQL database service.
    *   **Memorystore for Redis:** Managed Redis service for caching and BullMQ.
    *   **Artifact Registry:** For storing and managing Docker container images.
    *   **Secret Manager:** For securely storing and managing sensitive information like API keys and database passwords.
    *   **Cloud Build:** (Anticipated for CI/CD) For automating Docker image builds and deployments.
    *   **IAM (Identity and Access Management):** For managing permissions and service accounts.
    *   **Serverless VPC Access Connector:** To enable Cloud Run services to communicate with resources within the VPC using private IP addresses.

*   **Backend & Application Logic:**
    *   **Node.js:** JavaScript runtime environment.
    *   **Express.js:** Web application framework for Node.js (used for the backend API).
    *   **TypeScript:** Superset of JavaScript adding static typing.
    *   **Prisma ORM:** Next-generation ORM for Node.js and TypeScript, used for database access.
    *   **BullMQ:** Message queue system built on Redis, used for background job processing (workers).
    *   **`pg` (Node.js PostgreSQL client):** Used for direct database interactions and diagnostics.

*   **Frontend:**
    *   **Next.js:** React framework for server-side rendering and static site generation.
    *   **React:** JavaScript library for building user interfaces.
    *   **Tailwind CSS:** (Assumed, common with Next.js, or other CSS framework) For styling.

*   **Containerization & Orchestration:**
    *   **Docker:** For containerizing the applications.
    *   **Cloud SQL Auth Proxy:** Self-hosted binary used to provide secure access to Cloud SQL instances without needing to whitelist IPs or configure SSL directly in the application for public IP connections, and to facilitate Unix domain socket connections.

*   **Development & Operations:**
    *   **Git & GitHub:** For version control and code hosting.
    *   **Shell Scripting (`bash`):** Used in `start.sh` for managing the startup sequence of the Cloud SQL Auth Proxy and the application within the container.
    *   **`npm` / `npx`:** Node package manager and executor.

*   **Development Best Practices Identified:**
    *   **Singleton Pattern for Database Clients:** Critical for containerized environments where DATABASE_URL may be dynamically constructed
    *   **Environment Variable Management:** Centralized configuration approach required for Cloud Run deployments
    *   **TypeScript Path Aliases:** Not recommended for Cloud Run without additional build tooling (e.g., module-alias, tsconfig-paths)

---

## 6. Current Next Steps (as of 2025-06-03)
With Phase 1 largely complete and database connectivity fully resolved:
*   Fix remaining dashboard endpoint failures (violation-stats, flag-stats) - add error handling for empty database scenarios [COMPLETED - 2025-06-03]
*   **Initial Frontend Integration Testing with Stable Backend** `[COMPLETED - 2025-06-03]`
    *   **Objective:** Verify frontend stability and correct integration with the backend APIs, focusing on authenticated dashboard data loading after recent backend fixes and CORS adjustments.
    *   **Actions & Outcomes (2025-06-03):**
        *   **Phase 1: Static Analysis (Local Code Analysis)**
            1.  **Navigation Checker (`npm run check-navigation`):**
                *   Executed successfully. Identified 2 hardcoded `/login` paths.
                *   **Fix:** Updated `frontend/src/components/auth/RequireAuth.tsx` and `frontend/src/components/layout/AppNavbar.tsx` to use `ROUTES.LOGIN` constant.
                *   Noted warning for `RuleSetManagement.tsx` (imports `useRouter` but no direct navigation found in log); deferred further investigation as not immediately critical.
            2.  **Navigation Flow Diagram Generator (`npm run generate-nav-diagram`):**
                *   Executed. Generated diagram listed components but showed 0 pages/connections.
                *   **Outcome:** Script did not map navigation flows as expected; deferred script enhancement as a separate future task.
        *   **Phase 2: Dynamic End-to-End Testing (Local Frontend vs. Staging GCP Backend)**
            1.  **Initial Setup & Troubleshooting:**
                *   Frontend dev server started with `NEXT_PUBLIC_API_URL` pointing to staging backend.
                *   Encountered `Cannot find module 'source-map-js'` build error.
                *   **Fix:** Installed `source-map-js` as a dev dependency in `frontend` (`npm install --save-dev source-map-js`).
                *   Encountered CORS errors when accessing dashboard; backend was not allowing `http://localhost:3000`.
                *   **Fix:** Updated `src/app.ts` in the backend to include `http://localhost:3000` in allowed CORS origins. Backend service `backend-staging` was redeployed by the user with this change.
            2.  **Authenticated Dashboard Test:**
                *   Automated login attempts using `browser_action` faced difficulties with form field interaction.
                *   **Manual Login:** User manually logged into `http://localhost:3000` using `travis@10xtravel.com` / `StagingP@sswOrd123!`.
                *   **Verification:** User confirmed that after manual login, the dashboard page (`/dashboard/connected`) loaded correctly and displayed data for Flag Statistics, Violations Analysis, and AI Analysis Performance without "Unauthorized" errors.
            3.  Local frontend development server was stopped.
    *   **Summary:**
        *   Static analysis tools were run, and identified issues (hardcoded paths) were fixed.
        *   Dynamic testing successfully verified that an authenticated user can load data on the main dashboard pages from the staging backend via the local frontend. This confirms the stability of the recently fixed backend dashboard APIs and the updated CORS configuration.
        *   Full E2E automated testing (including login flows, other pages, and varied user interactions) was not performed due to limitations encountered with browser automation for the login form. More robust E2E test scripts/tools would be needed for comprehensive coverage.
*   Document lessons learned about Prisma client singleton pattern in containerized environments [COMPLETED - 2025-06-03, see Appendix A.3.1]
*   Review and address remaining environment variable warnings [COMPLETED - 2025-06-03, see above]
*   Optimize Redis configuration (eviction policy) [COMPLETED - 2025-06-03]
*   Configure custom DNS for staging environment
*   Begin Phase 2: Basic CI/CD & Production Setup with confidence in the application architecture

## 7. Critical Database Connection Fix: Prisma Client Consolidation (2025-06-02)

### 7.1 Issue Discovery
After resolving the initial Cloud SQL Auth Proxy connection issues detailed in Appendix A, a new class of database connection errors emerged:
- **Symptoms:** 500 Internal Server Errors on multiple dashboard API endpoints
- **Error:** `PrismaClientInitializationError: Environment variable not found: DATABASE_URL`
- **Root Cause:** 28 instances of `new PrismaClient()` throughout the codebase, bypassing the centralized client in `src/utils/prismaClient.ts`

### 7.2 Investigation & Resolution
**Problem:** Each `new PrismaClient()` instantiation attempted to read `DATABASE_URL` directly from environment variables, but our Cloud Run deployment dynamically constructs this URL from PG* variables.

**Files Affected (28 total):**
- 17 repository files in `src/repositories/`
- 4 service files (already correctly using repository pattern)
- 1 controller (`publisherChannelConfigController.ts`)
- 1 route file (`screenshotRoutes.ts`)
- 3 script files (`seed-staging.ts`, `analyzeProcessingStats.ts`, `clearAllData.ts`)
- 1 utils file (`checkAiLogsForAnalysis.ts`)

**Solution Implemented:**
- Refactored all 28 files to import the shared Prisma client: `import prisma from '../utils/prismaClient';`
- Deployed as image tag `v32-prisma-consolidation`

### 7.3 TypeScript Path Aliases Consideration
**Attempted Enhancement:** Tried implementing `@/*` path aliases in `tsconfig.json` to simplify imports
**Outcome:** Failed at runtime - Node.js doesn't understand TypeScript path mappings without additional tooling
**Decision:** Reverted to relative imports to maintain compatibility with Cloud Run environment

### 7.4 Current Status (2025-06-02)
- **Resolved:** Most API endpoints now function correctly
- **Remaining Issues:** Two dashboard endpoints still failing:
  - `/api/dashboard/violation-stats` (500 error)
  - `/api/dashboard/flag-stats` (500 error)
- **Likely Cause:** Edge cases in raw SQL queries when database is empty or has minimal data

---

## Appendix A: Detailed Staging Environment Troubleshooting Log (2025-05-29)

*(This appendix contains the detailed, iterative troubleshooting steps previously located in sections 8.1 and 8.1.1, chronicling the resolution of the database connection issues for the `backend-staging` service.)*

### A.1 Initial Staging Database Connection Troubleshooting (Formerly Section 8.1)

Following the initial deployment of `backend-staging` (and worker services) using image `staging-amd64-v6`, persistent database connection issues were encountered.

**Symptoms:**
*   **PrismaClientInitializationError:** Logs consistently showed `Environment variable not found: DATABASE_URL` or `Can't reach database server at /cloudsql/...:5432` or `Error parsing connection string: empty host in database URL`.
*   These errors affected both API endpoints (e.g., `/auth/login` resulting in 500 errors) and background tasks like `monitorActiveScanRuns`.
*   The application often failed to start correctly, with Cloud Run reporting that the container did not listen on the designated port within the timeout.

**Troubleshooting Steps & Findings (Iterative Process):**

1.  **Initial Hypothesis (Incorrect `DATABASE_URL` construction):**
    *   **Action:** Ensured Cloud Run environment variables for `backend-staging` included `PGUSER`, `PGPASSWORD` (as secret ref), `PGHOST` (socket path), `PGDATABASE`, and that `DATABASE_URL` was *not* explicitly set, relying on Prisma to construct it.
    *   **Result:** Error persisted. Prisma seemed to require `DATABASE_URL` explicitly.

2.  **Explicit `DATABASE_URL` in Cloud Run (Attempt 1):**
    *   **Action:** Manually set `DATABASE_URL` in Cloud Run env vars for `backend-staging` to `postgresql://<PGUSER_VAL>:$(PGPASSWORD)@localhost/<PGDATABASE_VAL>?host=<PGHOST_SOCKET_PATH>`.
    *   **Result:** Still failed, Prisma logs indicated it was trying to connect to `/cloudsql/...:5432`, incorrectly appending the port to the socket path.

3.  **Code-based `DATABASE_URL` Construction (`databaseConfig.ts` - v7, v8):**
    *   **Action:** Created `src/utils/databaseConfig.ts` to dynamically construct `DATABASE_URL`. This script checks if `PGHOST` indicates a Cloud SQL socket path. If so, it constructs `DATABASE_URL` as `postgresql://${PGUSER}:${PGPASSWORD}@/${PGDATABASE}?host=${PGHOST}`. Imported `databaseConfig.ts` at the top of `src/utils/prismaClient.ts` to set `process.env.DATABASE_URL` before Prisma client initializes. Deployed new images.
    *   **Result:** Debug logs confirmed `PG*` variables were read and `DATABASE_URL` was being set. However, Prisma "empty host" errors persisted.

4.  **Explicit URL in `PrismaClient` Constructor & `sslmode=disable` (v9, v10):**
    *   **Action:** Modified `databaseConfig.ts` to export `constructDatabaseUrl()`. Modified `prismaClient.ts` to import and use this function directly in the `PrismaClient` constructor. Ensured `&sslmode=disable` and no `localhost` in socket string.
    *   **Result (v10):** "Empty host" errors persisted.

5.  **Ensuring Prisma Connects Before Server Starts (`server.ts` modification - v11 attempt):**
    *   **Action:** Added `async function checkPrismaConnection()` in `src/server.ts` (using `prisma.$queryRaw\`SELECT 1\`;`) and made server startup await its success.
    *   **Result (v11):** `checkPrismaConnection` still failed. Application exited as designed.

6.  **Service Account Permissions Check (2025-05-29):**
    *   **Finding:** `airora-backend-staging-sa` was missing "Secret Manager Secret Accessor" role.
    *   **Action (User):** Role added.
    *   **Outcome (Redeployed v11):** Still Failed. Issue was more than just password resolution.

7.  **Hardcode Full Database URL (Image `v12`):**
    *   **Action:** Hardcoded full `DATABASE_URL` (with actual password) in `prismaClient.ts`.
    *   **Outcome (v12):** Failed. Prisma reported "empty host in database URL."

8.  **Alternative Hardcoded URL Format (No `@`) (Image `v13`):**
    *   **Action:** Changed hardcoded URL in `prismaClient.ts` to `postgresql://postgres:PASSWORD/dbname?host=...`.
    *   **Outcome (v13):** Failed. Prisma: "invalid port number in database URL."

9.  **Bypass Prisma - Direct `pg.Client` Test (Image `v14`):**
    *   **Action:** Added `pg.Client` connection test to `src/server.ts`.
    *   **Outcome (v14):** Failed. `pg.Client` reported `ECONNREFUSED` on the socket path. This indicated the socket file was likely missing or not listening.

10. **Investigate Socket Existence & Managed Proxy (Image `v15`):**
    *   **Action:** Added `ls -la ${PGHOST}` to `server.ts`. Verified Cloud Run/GCP configs.
    *   **Outcome (v15 - Breakthrough 1):** `ls -la` showed an EMPTY socket directory. `pg.Client` still `ECONNREFUSED`.
    *   **Crucial System Log:** Cloud Run system log showed managed Cloud SQL Auth Proxy sidecar failing (trying to connect to PostgreSQL on MySQL port 3307).

11. **Attempt to Reset Managed Proxy Linkage in Cloud Run:**
    *   **Action (User):** Removed and re-added Cloud SQL connection in Cloud Run service.
    *   **Outcome:** Failed. Problem persisted.

12. **Implement Self-Hosted Cloud SQL Auth Proxy (Bypass Managed Proxy):**
    *   **Rationale:** Take control as managed proxy was failing.
    *   **Actions (Iterative):** Created `start.sh`, modified `Dockerfile`. Disabled managed proxy in Cloud Run.
    *   **Sub-Problems:** Fixed Docker build errors (`chmod`, `apt-get user`).
    *   **Deployment with Initial Self-Hosted Proxy (v2 syntax `INSTANCE_NAME --unix-socket=PATH`):** Failed. Proxy logs: `bind: invalid argument` (incorrect path construction by proxy).
    *   **Deployment with Corrected Proxy v2 Syntax (`-instances` flag):** Failed repeatedly. Logs: `Error: unknown shorthand flag: 'n' in -nstances=...` (typo in deployed `start.sh` despite local corrections and `--no-cache` builds).

### A.2 Continued Self-Hosted Proxy and Prisma Connection Resolution (Formerly Section 8.1.1 - 2025-05-29 Evening)

Following the issues with deploying the correct `start.sh` script (with the `-instances` flag) for the self-hosted Cloud SQL Auth Proxy, the troubleshooting continued:

13. **Corrected Self-Hosted Proxy Command (Syntax for v2 Proxy in `start.sh`):**
    *   **Action:** The `start.sh` script was updated to use the Cloud SQL Auth Proxy v2 syntax: `cloud-sql-proxy "$INSTANCE_CONNECTION_NAME" --unix-socket="/cloudsql" ...`. This replaced the previous (and also problematic) `-instances=INSTANCE_CONNECTION_NAME=unix:PATH` syntax.
    *   **Outcome:** Proxy started, socket created. `pg.Client` test still failed with `ECONNRESET`.

14. **Investigating `ECONNRESET` - Prisma URL and Password Handling:**
    *   **Actions & Findings:**
        *   Reverted `prismaClient.ts` to use dynamic URL from `databaseConfig.ts`.
        *   Added password debugging logs in `databaseConfig.ts` (confirmed correct password string received).
        *   Implemented `encodeURIComponent(password)` in `databaseConfig.ts`.
        *   **Outcome:** `ECONNRESET` persisted.

15. **Cloud SQL Instance Log Review & Direct DB Connection Test:**
    *   **Action (User):** Checked PostgreSQL server logs; no relevant errors found. Successfully connected via Cloud SQL Studio with `postgres` user and password, confirming credentials and basic permissions.
    *   **Finding:** Database credentials and basic user permissions were correct.

16. **Enhanced Cloud SQL Auth Proxy Logging:**
    *   **Action:** Added the `--debug-logs` flag to the `cloud-sql-proxy` command in `start.sh`.
    *   **Initial Issue:** A typo (`-erbose=true` instead of a valid flag) caused the proxy to fail to start. This was corrected to `--debug-logs`.
    *   **Outcome (with `--debug-logs`):** Proxy logs showed successful startup ("Authorizing with Application Default Credentials", "Listening on /cloudsql/...", "The proxy has started successfully and is ready for new connections!"). However, the application's `pg.Client` test still resulted in `ECONNRESET`.

17. **Private IP Configuration for Cloud SQL and Cloud Run:**
    *   **Action (User):** Enabled Private IP for Cloud SQL instance and confirmed Serverless VPC Access connector for Cloud Run service.
    *   **Action (Code):** Added `--private-ip` flag to `cloud-sql-proxy` in `start.sh`.
    *   **Outcome (Major Breakthrough 2):** Proxy started, `pg.Client` test **SUCCEEDED**. Prisma connection still **FAILED** (`empty host in database URL`).

18. **Final Prisma Connection String Fix & Enhanced Prisma Logging:**
    *   **Hypothesis:** Prisma's URL parser has specific requirements for socket connection strings, potentially needing a placeholder hostname.
    *   **Actions:**
        *   Modified `databaseConfig.ts`: Connection string updated to `postgresql://${user}:${encodedPassword}@localhost/${database}?host=${pgHost}&sslmode=disable`.
        *   Modified `prismaClient.ts`: Added `log: ['query', 'info', 'warn', 'error']`.
    *   **RESOLUTION (Image Deployed on 2025-05-29 ~9:00 PM CST):**
        *   Cloud SQL Auth Proxy started correctly.
        *   Raw `pg.Client` test connected successfully.
        *   **Prisma connected successfully!**
        *   `backend-staging` application started successfully and Cloud Run reported revision as healthy.

**Conclusion of Database Troubleshooting (as of 2025-05-29 Evening):**
The persistent database connection failure for the `backend-staging` Cloud Run service to its Cloud SQL instance has been resolved. The solution involved a combination of implementing a self-hosted Cloud SQL Auth Proxy, ensuring correct proxy command-line flags and syntax, configuring Private IP for Cloud SQL and appropriate VPC networking for Cloud Run, correctly handling database password retrieval and URL encoding, and tailoring the Prisma connection string format for Unix domain sockets by including a `localhost` placeholder. The application is now successfully connecting to the PostgreSQL database.

### A.3 Prisma Client Consolidation Issues (2025-06-02)

Following the successful resolution of the Cloud SQL Auth Proxy connection, a new category of database errors emerged that required investigation:

**Initial Symptoms (Post-Deployment of v28-db-fixed):**
- Dashboard API endpoints returning 500 Internal Server Errors
- Error logs showing: `PrismaClientInitializationError: Environment variable not found: DATABASE_URL`
- Affected endpoints: Most dashboard routes, flag operations, and various other API endpoints

**Root Cause Analysis:**
1. **Discovery Process:**
   - Reviewed error logs showing Prisma initialization failures
   - Searched codebase for `new PrismaClient()` patterns
   - Found 28 instances creating their own Prisma client instances
   - Each instance expected `DATABASE_URL` to be directly available as an environment variable

2. **Why This Failed in Cloud Run:**
   - Our deployment strategy dynamically constructs `DATABASE_URL` from PG* environment variables
   - The centralized `src/utils/prismaClient.ts` handles this construction properly
   - Individual `new PrismaClient()` calls bypassed this logic entirely

**Resolution Strategy:**
1. **Phase 1 - Test Fix (dashboardRepository.ts):**
   - Changed from: `const prisma = new PrismaClient();`
   - Changed to: `import prisma from '../utils/prismaClient';`
   - Deployed and verified the fix worked for dashboard endpoints

2. **Phase 2 - TypeScript Path Alias Attempt:**
   - Added to `tsconfig.json`: `"paths": { "@/*": ["src/*"] }`
   - Attempted to use: `import prisma from '@/utils/prismaClient';`
   - **Result:** Build succeeded but runtime failed - Node.js doesn't understand TypeScript path mappings
   - **Decision:** Reverted to relative imports

3. **Phase 3 - Complete Refactoring:**
   - Systematically updated all 28 files to use the shared Prisma client
   - Files refactored included:
     - **Repository Layer (17 files):** All files in `src/repositories/`
     - **Service Layer (4 files):** Already using repository pattern correctly
     - **Controllers (1 file):** `publisherChannelConfigController.ts`
     - **Routes (1 file):** `screenshotRoutes.ts`
     - **Scripts (3 files):** Database maintenance and seeding scripts
     - **Utils (1 file):** `checkAiLogsForAnalysis.ts`

**Deployment Results (v32-prisma-consolidation):**
- Most API endpoints now functioning correctly
- Login functionality restored
- Basic CRUD operations working

**Remaining Issues Identified:**
- `/api/dashboard/violation-stats` endpoint: 500 error
- `/api/dashboard/flag-stats` endpoint: 500 error
- Both likely due to raw SQL queries not handling empty result sets properly

### A.3.1 Key Lessons Learned from Prisma Client Consolidation

The issues encountered with multiple Prisma Client instances highlight several critical lessons for developing applications in containerized environments like Cloud Run, especially when database connection strings are dynamically configured:

1.  **Singleton Pattern for Database Clients is Paramount:**
    *   **Why it's critical:** In environments like Cloud Run, the `DATABASE_URL` is often constructed dynamically at runtime (e.g., from individual `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` environment variables, especially when using the Cloud SQL Auth Proxy with Unix sockets). A singleton pattern ensures that a single, correctly configured instance of the Prisma client, which has performed this dynamic URL construction, is used throughout the application.
    *   **Impact of not using a singleton:** Instantiating `new PrismaClient()` in multiple places bypasses the centralized, dynamically configured client. Each new instance will attempt to re-initialize itself, often by directly looking for a `DATABASE_URL` environment variable. If this variable isn't explicitly set (as is common when it's dynamically constructed), these instances will fail to connect, leading to errors like `PrismaClientInitializationError: Environment variable not found: DATABASE_URL`. This was the direct cause of multiple API endpoint failures.
    *   **Example of the Fix:**
        *   **Incorrect (causes issues):**
            ```typescript
            // In some_repository.ts
            import { PrismaClient } from '@prisma/client';
            const prisma = new PrismaClient(); // This instance doesn't know the dynamic DATABASE_URL
            ```
        *   **Correct (uses shared, configured instance):**
            ```typescript
            // In some_repository.ts
            import prisma from '../utils/prismaClient'; // Assuming prismaClient.ts exports the shared instance
            ```

2.  **Centralized Environment Variable Strategy for Dynamic Configurations:**
    *   **Importance:** When configurations like database URLs are built from multiple parts or depend on the runtime environment (e.g., Cloud SQL Auth Proxy socket paths), this logic must be centralized. The shared Prisma client in `src/utils/prismaClient.ts` (or a similar database configuration module) should be the sole authority for constructing and providing this configuration.
    *   **Consequence of decentralization:** Multiple `new PrismaClient()` calls effectively decentralize this configuration, leading to each instance attempting its own (often failing) configuration lookup.

3.  **TypeScript Runtime Limitations (Path Aliases):**
    *   As noted, TypeScript path aliases (e.g., `@/*`) defined in `tsconfig.json` are a compile-time feature. Node.js at runtime does not understand these paths without additional tooling like `module-alias` or `tsconfig-paths` and appropriate build process adjustments. For Cloud Run deployments aiming for simplicity, relative paths are often more straightforward to manage.

4.  **Benefits of Phased Refactoring and Testing:**
    *   The approach of testing the fix on a single file (`dashboardRepository.ts`) first, deploying, and verifying its success before refactoring all 28 affected files was beneficial. It confirmed the solution's efficacy and reduced the risk of introducing widespread issues.

**Recommendation:** It is crucial to enforce a singleton pattern for database client instantiation, especially in environments with dynamic configuration like Cloud Run. This involves creating a shared client instance that handles any necessary dynamic URL construction and ensuring all parts of theapplication import and use this single instance.

---

### A.4 Redis Eviction Policy Optimization (2025-06-03)

**Observation:**
*   A warning message was observed in the `backend-staging` Cloud Run service logs: `IMPORTANT! Eviction policy is volatile-lru. It should be "noeviction"`.

**Rationale:**
*   The `noeviction` policy is recommended when using Redis with BullMQ (which this application uses for job queuing). This policy prevents Redis from evicting keys (including job data) when it reaches its memory limit, thus protecting critical job information from being lost. Instead, Redis will return errors on write operations if memory is full, allowing the application or queue manager to handle the situation.

**Action:**
*   The eviction policy for the `airora-staging-redis-main` Memorystore for Redis instance was changed from `volatile-lru` to `noeviction`.
*   Command executed: `gcloud redis instances update airora-staging-redis-main --region=us-south1 --update-redis-config maxmemory-policy=noeviction`

**Outcome:**
*   The Redis instance's `maxmemory-policy` was successfully updated to `noeviction`. This change is intended to resolve the warning and ensure the stability and reliability of the BullMQ job queue by preventing data loss due to memory eviction.
*   Monitoring of Redis memory usage is recommended to determine if the instance size needs adjustment in the future.

---

## Appendix B: Troubleshooting Log (High-Level)

*(This section is for a high-level summary of issues encountered and resolved during the deployment process. More detailed logs for specific complex issues like the initial DB connection are in Appendix A.)*

### B.1 2025-05-29: Initial Staging Database Connectivity
*   **Issue:** `backend-staging` and worker services unable to connect to Cloud SQL PostgreSQL instance.
*   **Diagnosis:** Multiple factors including managed Cloud SQL Proxy misconfiguration (attempting MySQL port for PostgreSQL), Prisma connection string parsing for Unix sockets, and need for Private IP networking.
*   **Resolution:** Implemented self-hosted Cloud SQL Auth Proxy with correct v2 syntax, enabled Private IP for Cloud SQL, configured Serverless VPC Access Connector for Cloud Run, and refined Prisma connection string to include `localhost` placeholder for socket paths. (Detailed in Appendix A.1 & A.2).

### B.2 2025-06-02: Prisma Client Initialization Errors
*   **Issue:** Multiple API endpoints failing with `PrismaClientInitializationError: Environment variable not found: DATABASE_URL` after initial DB connection was resolved.
*   **Diagnosis:** 28 instances of `new PrismaClient()` found in the codebase, bypassing the centralized, dynamically configured Prisma client.
*   **Resolution:** Refactored all 28 instances to import and use the shared Prisma client from `src/utils/prismaClient.ts`. (Detailed in Appendix A.3).

### B.3 2025-06-03: Environment Variable Warnings in Cloud Run
*   **Issue:** Warnings in Cloud Run logs for `GOOGLE_SECRET_MANAGER_CREDENTIALS_PATH` and `GCS_BUCKET_NAME` (related to `GOOGLE_APPLICATION_CREDENTIALS`).
*   **Diagnosis:** Services were attempting to use explicit key file paths which are not standard for ADC in Cloud Run.
*   **Resolution:** Modified `secretManagerService.ts` and `gcsService.ts` to correctly initialize Google Cloud clients using Application Default Credentials (ADC) when specific key file environment variables are not set, leveraging the attached service account.

### B.4 2025-06-03: Redis Eviction Policy Warning
*   **Issue:** `backend-staging` logs showed BullMQ warning: `IMPORTANT! Eviction policy is volatile-lru. It should be "noeviction"`.
*   **Diagnosis:** Memorystore for Redis instance `airora-staging-redis-main` was using `volatile-lru`.
*   **Resolution:** Updated Redis instance `maxmemory-policy` to `noeviction` using `gcloud`. (Detailed in Appendix A.4).

### B.5 2025-06-03: Dashboard API Stability
*   **Issue:** Intermittent 500 Internal Server Errors on dashboard pages, specifically for `/api/dashboard/violation-stats`, `/api/dashboard/flag-stats`, and `/api/dashboard/compliance-overview`.
*   **Diagnosis:** Errors traced to unhandled exceptions in backend data repository functions (`src/repositories/dashboardRepository.ts`) when database queries failed or returned unexpected results (e.g., during empty database scenarios).
*   **Resolution:** Implemented comprehensive `try...catch` error handling in the affected repository functions (`getFlagStatsByOrganization`, `getViolationStatsByOrganization`, `getComplianceOverviewByOrganization`) and their helper `getOrganizationFilter`. Functions now log errors and return default empty/zeroed data structures, ensuring API stability. (Detailed in Appendix A.5).

---

### A.5 Dashboard Endpoint Error Handling (2025-06-03)

**Observation:**
*   Dashboard endpoints (`/api/dashboard/violation-stats`, `/api/dashboard/flag-stats`, and `/api/dashboard/compliance-overview`) were susceptible to 500 Internal Server Errors, particularly when the database returned no data or encountered an error during queries. Frontend console logs showed `GET https://backend-staging-230308604765.us-south1.run.app/api/dashboard/compliance-overview?... 500 (Internal Server Error)`.

**Rationale:**
*   The data fetching functions (`getFlagStatsByOrganization`, `getViolationStatsByOrganization`, `getComplianceOverviewByOrganization`, and the helper `getOrganizationFilter`) in `src/repositories/dashboardRepository.ts` needed more robust error handling to prevent unhandled exceptions from propagating to the API layer.

**Action:**
*   The `getOrganizationFilter` helper function was modified to catch errors during publisher and advertiser database lookups. If an error occurs, it's logged, and the function proceeds with empty arrays for publisher/advertiser IDs, allowing calling functions to default to "no data" stats.
*   The main logic within `getFlagStatsByOrganization`, `getViolationStatsByOrganization`, and `getComplianceOverviewByOrganization` was wrapped in comprehensive `try...catch` blocks.
*   These `catch` blocks now log the specific error encountered during data fetching and ensure that the function returns a default, empty, but well-structured statistics object (e.g., `{ total: 0, ..., trend: [] }` for flag/violation stats, or `{ publishers: [] }` for compliance overview).

**Outcome:**
*   The affected dashboard API endpoints (`/api/dashboard/violation-stats`, `/api/dashboard/flag-stats`, `/api/dashboard/compliance-overview`) are now more resilient. They return structured empty/default data in error scenarios or when no data is available from the database, preventing 500 Internal Server Errors. This improves the stability and user experience of the frontend dashboard, as it can consistently handle API responses.
