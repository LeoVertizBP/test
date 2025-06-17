# Architecture Overview

## Overview

The Credit Compliance Tool employs a standard client-server architecture designed for scanning, analyzing, and managing compliance data. It consists of a backend API server, a relational database, and a web-based frontend application.

## Key Concepts

### Components

1.  **Backend Server:**
    *   **Technology:** Node.js with Express framework, written in TypeScript.
    *   **Purpose:** Handles business logic, API requests, interacts with the database, orchestrates scanning processes, and manages AI analysis tasks.
    *   **Key Libraries:** `express`, `prisma`, `@google-cloud/vertexai`, `apify-client`, `jsonwebtoken`, `bcrypt`.

2.  **Frontend Application:**
    *   **Technology:** Next.js (React framework), likely using TypeScript (based on `frontend/tsconfig.json`).
    *   **Purpose:** Provides the user interface for interacting with the system, managing scans, reviewing flags, configuring rules, etc.
    *   **Interaction:** Communicates with the backend via RESTful API calls.

3.  **Database:**
    *   **Technology:** PostgreSQL.
    *   **Purpose:** Persists all application data, including user information, publishers, products, rules, scan results, content items, compliance flags, etc.
    *   **Interaction:** Accessed exclusively by the backend server via the Prisma ORM.

4.  **External Services:**
    *   **Content Scraping:** Likely uses Apify (based on `apify-client` dependency and scripts like `checkApifyRun.ts`) to fetch content from platforms like YouTube, Instagram, TikTok.
    *   **AI Analysis:** Utilizes AI models (e.g., Google Gemini via `@google/generative-ai`) for compliance checking.
    *   **Screenshot Capture:** A component using Playwright (`playwright` dependency) handles capturing screenshots from video content (e.g., YouTube) at specific timestamps.

### Architectural Patterns

*   **RESTful API:** The backend exposes a RESTful API for the frontend to consume.
*   **Repository Pattern:** The backend likely uses the repository pattern (as mentioned in `docs/deployment.md` and suggested by `src/repositories/` directory) to abstract database interactions, promoting separation of concerns.
*   **Service Layer:** A service layer likely exists in the backend (`src/services/`) to encapsulate business logic, coordinating between API routes and repositories.
*   **Token-Based Authentication:** Uses JSON Web Tokens (JWT) for securing API endpoints (indicated by `jsonwebtoken` dependency and scripts like `checkJwt.js`, `createToken.ts`).

```mermaid
graph TD
    subgraph "User Interface"
        Frontend[Next.js Frontend]
    end

    subgraph "Backend Server (Node.js/Express/TypeScript)"
        API[API Routes]
        Services[Service Layer]
        Repositories[Repository Layer]
        Prisma[Prisma ORM]
    end

    subgraph "Database"
        DB[(PostgreSQL)]
    end

    subgraph "External Services"
        Scraper[Content Scraper (e.g., Apify)]
        AI[AI Analysis (e.g., Gemini)]
        GCS[Google Cloud Storage (Media/Screenshots)]
    end

    User --> Frontend
    Frontend -- REST API Calls --> API
    API --> Services
    Services --> Repositories
    Repositories --> Prisma
    Prisma --> DB
    Services -- Tasks --> Scraper
    Services -- Analysis Req --> AI
    Services -- Screenshot Req --> Playwright/Chromium
    Services -- Store/Retrieve Media --> GCS
    Scraper -- Content --> Services
    AI -- Results --> Services
    Playwright/Chromium -- Screenshot --> Services
```

## Implementation

*   **Backend:** Located in the `src/` directory. Code is written in TypeScript and compiled to JavaScript in `dist/` for production.
*   **Frontend:** Located in the `frontend/` directory. Uses Next.js conventions.
*   **Database Schema:** Defined and managed using Prisma (`prisma/schema.prisma`) and `node-pg-migrate` (`migrations/`).

## Integration Points

*   **Frontend <-> Backend:** Standard HTTP requests over the REST API. Authentication is handled via JWTs passed in request headers.
*   **Backend <-> Database:** Prisma client handles all database queries.
*   **Backend <-> External Services:** API calls to services like Apify and Google Generative AI. Uses Google Cloud Storage client library for media/screenshot storage. Interacts with Playwright for screenshot capture.

## Best Practices

*   **Separation of Concerns:** Maintain clear boundaries between the frontend, backend API, business logic (services), and data access (repositories).
*   **Type Safety:** Leverage TypeScript in both backend and frontend, and Prisma's generated types for database interactions.
*   **Environment Configuration:** Use `.env` files to manage environment-specific settings (database URLs, API keys, secrets).
*   **Database Migrations:** Use Prisma Migrate and/or `node-pg-migrate` to manage database schema changes systematically.
