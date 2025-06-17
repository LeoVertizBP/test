# Detailed Project Brief: Credit Compliance Tool

**(Version: 2025-05-04)**

**1. Introduction & Business Problem**

*   **Problem:** Manually reviewing online marketing content (social media posts, videos) for compliance with complex, product-specific, and platform-specific rules is time-consuming, error-prone, and difficult to scale. Advertisers need an efficient way to ensure their marketing partners (publishers/influencers) adhere to required disclosures, claims, and guidelines.
*   **Solution:** The Credit Compliance Tool automates this process by scanning content, using AI to analyze it against relevant rules, flagging potential violations, and providing a workflow for human review and remediation.
*   **Target Users:** Compliance teams, legal departments, marketing managers within organizations that work with publishers/influencers.
*   **Goals:** Increase compliance coverage, reduce manual review time, improve accuracy of violation detection, provide audit trails, and manage rules centrally.

**2. Functional Overview**

*   **Scan Management:**
    *   Users initiate scan jobs targeting specific publishers, channels (platform URLs), products, and platforms (YouTube, TikTok, Instagram, YouTube Shorts).
    *   Scans can target single channels or multiple criteria.
    *   The system monitors the progress of scans (which involve external scraping via Apify) and updates their status (Initializing, Running, Fetching Results, Completed, Failed, etc.).
    *   A UI likely displays the status of ongoing and completed scan jobs and their individual runs.
    *   (Potential/Future: Ability to cancel ongoing scans).
*   **Rule Configuration:**
    *   Users define and manage compliance rules, categorized as `Product Rules` (specific to the advertised item) or `Channel Rules` (platform/context-specific).
    *   Rules can be created manually or derived from uploaded guideline documents (PDF, DOCX).
    *   Rules are grouped into `Rule Sets` (Product or Channel type) associated with an Advertiser. Default sets can be designated.
    *   Specific Product Rule Sets can be assigned directly to Products, overriding the Advertiser default.
    *   Fine-grained `Overrides` allow explicitly including or excluding specific Product or Channel rules for individual Products.
*   **Publisher & Product Setup:**
    *   Users manage `Publishers` (content creators) and their associated `Publisher Channels` (specific platform URLs to scan).
    *   Users manage `Products` associated with `Advertisers`. Product details (name, description, etc.) are stored.
    *   (Conceptual/Future: Linking specific Publishers to Products they are allowed to promote).
*   **AI Compliance Analysis:**
    *   Automatically triggered after content is scanned and processed.
    *   Determines applicable rules based on the Rule Engine configuration (assignments, defaults, overrides).
    *   Sends content (text, transcript) and rules to an AI model (**Google Gemini Flash** confirmed, *not* Voyage) for evaluation.
    *   Generates `Flags` for potential violations, including AI reasoning, confidence score, and context snippet.
    *   Features an "AI Librarian" mechanism where the AI can request relevant past examples (`ai_feedback_examples`) via a tool call (`get_relevant_examples`) if unsure.
*   **Flag Review Workflow:**
    *   A UI allows reviewers to find, filter (by status, rule, product, etc.), and examine AI-generated flags (`PENDING` status).
    *   Reviewers see content details, AI findings, and rule information.
    *   **Screenshot Capture:** For YouTube/Shorts flags with transcript timestamps (`transcript_start_ms`), a button allows reviewers to trigger backend capture (via Playwright) of the specific video frame, which is stored in GCS and linked to the flag.
    *   Reviewers assign a `human_verdict` (`VIOLATION`, `COMPLIANT`, `ERROR`), add notes, and update the flag status (`REMEDIATING`, `CLOSED`).
    *   Closed flags are evaluated as potential examples for future AI improvement (`aiExampleManagerService`).
*   **Reporting & Dashboards:**
    *   A frontend dashboard visualizes key metrics (flag counts, violation rates, AI performance, processing times) fetched from backend API endpoints (`/api/dashboard/*`).
    *   Data can be filtered by date range, advertiser, product, etc.
    *   (Conceptual/Future: Generation of downloadable reports, e.g., CSV).

**3. Technical Architecture Deep Dive**

*   **Style:** Standard Client-Server.
*   **Frontend:**
    *   **Framework:** Next.js (React) with TypeScript. Uses the **App Router**.
    *   **Routing:** File-system based (`frontend/src/app/`). Navigation via `<Link>` and `useRouter`.
    *   **State Management:** Primarily React Hooks (`useState`, `useContext`). No dedicated global state library (Redux, Zustand). Server state often handled by Server Components or client-side fetching with local loading/error states.
    *   **API Communication:** Uses `axios` (likely via a service layer in `frontend/src/services/`) to call the backend API.
    *   **Key Libraries:** `next`, `react`, `axios`, `tailwindcss` (assumed from config files).
*   **Backend:**
    *   **Framework:** Node.js with Express (v5 indicated) using TypeScript.
    *   **Structure:** Organized into `src/routes`, `src/services`, `src/repositories`, `src/middleware`, `src/utils`.
    *   **API:** Exposes RESTful API endpoints (likely under `/api/v1/`). Routes delegate logic to Services.
    *   **Data Access:** Repository pattern abstracts database operations using Prisma ORM.
    *   **Authentication:** JWT-based. `authenticateToken` middleware verifies tokens on protected routes.
    *   **Authorization:** Role-based (RBAC) using `role` field on `users` table, checked within services/routes.
    *   **Key Libraries:** `express`, `@prisma/client`, `jsonwebtoken`, `bcrypt`, `apify-client`, `@google-cloud/storage`, `@google-cloud/vertexai` (or `@google/generative-ai`), `playwright`, `pg`, `cors`, `express-rate-limit`, `dotenv`.
*   **External Services:**
    *   **Apify:** Content scraping. Requires `APIFY_API_TOKEN`.
    *   **Google Gemini:** AI analysis. Requires GCP credentials/API keys (`VERTEX_AI_PROJECT_ID`, `VERTEX_AI_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS`).
    *   **Google Cloud Storage (GCS):** Media/screenshot storage. Requires bucket name (`GCS_BUCKET_NAME`) and credentials.
    *   **Playwright/Chromium:** Browser automation for screenshots (runs within backend Docker container).

**4. Data Model & Storage**

*   **Database:** PostgreSQL.
*   **ORM:** Prisma (`prisma/schema.prisma` defines schema). Migrations via Prisma Migrate and potentially `node-pg-migrate`.
*   **Key Tables:** `organizations`, `users`, `advertisers`, `products`, `publishers`, `publisher_channels`, `product_rules`, `channel_rules`, `rule_sets`, `guideline_documents`, `scan_jobs`, `scan_job_runs`, `content_items`, `content_images`, `flags`, `ai_feedback_examples`, `ai_usage_logs`, `audit_logs`. (See `prisma/schema.prisma` for full details and relations).
*   **Media Storage:** Binary files (images, videos, screenshots) stored in GCS; `content_images` table stores metadata and GCS path/URL. `gcsService.ts` handles uploads/interactions.

**5. Core Processes In-Depth**

*   **Scanning:** `scanJobService.ts` orchestrates: initiates Apify runs via `apifyService.ts`, monitors runs, processes results (platform-specific parsing, SRT handling for YouTube via `node-srt`, media upload via `gcsService.ts`), stores `content_items`/`content_images`, triggers `aiAnalysisService`.
*   **AI Analysis:** `aiAnalysisService.ts` (and potentially `aiAnalysisServiceParallel.ts`): Fetches applicable rules (product/channel, considering assignments/overrides), generates detailed prompt (`generateAnalysisPromptGeneric`), calls Gemini via `aiCallWrapperService.ts` (handles logging, potentially retries), handles AI Librarian tool calls (`get_relevant_examples` via `aiLibrarianService.ts`), parses AI response, creates `flags` records.
*   **Rule Engine Application:** Logic within `aiAnalysisService` (or related rule services) determines the final set of rules to pass to the AI based on product context, assignments, and overrides.
*   **Screenshot Generation:** `screenshotService.ts`: Triggered by `POST /api/screenshots`. Uses Playwright to navigate to YouTube URL with timestamp, presses 'k' to pause, waits briefly, captures frame, calculates hash (`hashUtil.ts`), uploads to GCS (`gcsService.ts`), updates flag record (`flagRepository.ts`). Rate limited via `rateLimiter.ts`.

**6. Deployment & Operations**

*   **Recommended:** Docker deployment to Cloud Run (stateless) or GKE (more complex). Involves building images, pushing to registry (GCR/Artifact Registry), deploying service(s). Requires secure configuration of DB connections and environment variables (Secret Manager).
*   **Alternative (`deploy.sh`):** Script for VM-based deployment (handles backups, git pull, npm install, build, migrations, service restarts via PM2/systemd).
*   **Environment Variables:** Critical for configuration (`.env` file, managed via Secret Manager in cloud). Key vars include `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `GCS_BUCKET_NAME`, `GOOGLE_APPLICATION_CREDENTIALS`, AI keys, Apify key, screenshot rate limits.
*   **Logging:** Custom utility (`logUtil.ts`) writes structured logs to console output. `NODE_ENV` controls level (INFO in prod). Production requires capturing/aggregating console output.
*   **Migrations:** Managed via Prisma Migrate (`npx prisma migrate deploy`) and potentially `node-pg-migrate` (`npm run migrate`).

**7. Development & Contribution**

*   **Setup:** Clone repo, `npm install` in root and `frontend/`. Configure `.env` file. Use Docker Compose for local dev (`docker-compose up`).
*   **Key Scripts (`package.json`):** `dev` (run backend with ts-node), `build` (compile TS), `start` (run compiled JS), `migrate` (run node-pg-migrate). Frontend uses standard Next.js scripts (`npm run dev` in `frontend/`).
*   **Prisma:** `npx prisma generate` (regenerate client after schema changes), `npx prisma migrate dev` (create/apply dev migrations).
*   **Testing:** No automated tests currently configured (`"test": "echo \"Error: no test specified\""`).

**8. Known Technical Debt / Improvement Areas**

*   **Hardcoded Frontend Platform List:** Platform options (YouTube, TikTok etc.) are hardcoded in `frontend/.../mockData.ts`. Should be fetched dynamically from a backend API endpoint.
*   **API Endpoint Completeness:** Some documentation notes potential TODOs or missing API endpoints for full CRUD operations on certain entities (e.g., Publisher Channels, Rule Assignments/Overrides, Publisher-Product links).
*   **Testing:** Lack of automated tests (unit, integration, e2e).
*   **Migration Systems:** Use of both Prisma Migrate and `node-pg-migrate` might indicate a need for consolidation or clarification.
*   **AI Output Consistency:** AI sometimes fails to provide `transcript_start_ms` or returns invalid `rule_id`s, impacting flag creation/screenshot feature availability. Requires ongoing prompt engineering.
