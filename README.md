# Credit Compliance Tool## Running with Docker (Recommended for Development)

This project is configured to run using Docker and Docker Compose, providing a consistent development environment.

**Prerequisites:**
*   Docker Desktop installed and running.

**Setup:**
1.  **Environment Variables:** Copy the `.env.example` file to a new file named `.env` in the project root:
    ```bash
    cp .env.example .env
    ```
    Edit the `.env` file and fill in your specific database credentials (e.g., for Google Cloud SQL), JWT secret, API keys (Apify, Google Cloud), and the path to your Google Application Credentials JSON key file (`GOOGLE_APPLICATION_CREDENTIALS_PATH`).
2.  **Build Images:** Build the Docker images for the backend and frontend services:
    ```bash
    docker-compose build
    ```
3.  **(First Time Only) Database Migration:** If you are connecting to a new or empty database specified in your `.env` file, you'll need to run the database migrations *after* starting the services (see next step). Open a *separate* terminal window and run:
    ```bash
    docker-compose exec backend npm run migrate up
    ```
    *Note: If connecting to an existing database with data, skip this migration step.*

**Running the Application:**
1.  Start the backend and frontend services:
    ```bash
    docker-compose up
    ```
2.  Access the frontend at: [http://localhost:3000](http://localhost:3000)
3.  Access the backend API (if needed directly) at: [http://localhost:3001](http://localhost:3001)

**Stopping the Application:**
*   Press `Ctrl + C` in the terminal where `docker-compose up` is running.

**Running Commands within Containers:**
*   To run commands specifically within the backend service (e.g., Prisma commands, scripts):
    ```bash
    docker-compose exec backend [your command]
    # Example: docker-compose exec backend npx prisma studio
    ```

---

## Overview

This project is a tool designed to scan content (e.g., from social media platforms like YouTube, Instagram, TikTok) for compliance against predefined rules. It utilizes AI for analysis and flagging potential violations, provides a workflow for reviewing flags, and manages publishers, products, and associated rules.

The system consists of a Node.js/Express backend using TypeScript and Prisma for database interaction (PostgreSQL), and a Next.js frontend for the user interface.

## Prerequisites

*   **Node.js:** A recent LTS version is recommended (check project specifics if needed).
*   **npm or yarn:** Package manager for Node.js.
*   **PostgreSQL:** A running PostgreSQL database instance.
*   **API Keys (Potentially):** Depending on the features used, you might need API keys for services like Apify (for scraping) and Google Cloud Vertex AI (for AI analysis).

## Setup

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd credit-compliance-tool
    ```

2.  **Install Backend Dependencies:**
    ```bash
    npm install
    ```

3.  **Install Frontend Dependencies:**
    ```bash
    cd frontend
    npm install
    cd ..
    ```

4.  **Database Setup:**
    *   Ensure your PostgreSQL server is running.
    *   Create a database and a user for the application.
    *   Grant necessary privileges to the user on the database.

5.  **Environment Variables:**
    *   Create a `.env` file in the project root directory. You can often copy an example file if one exists (e.g., `.env.example` or `.env.alternatives`).
    *   Populate the `.env` file with the required environment variables, including:
        *   `DATABASE_URL`: Connection string for your PostgreSQL database (e.g., `postgresql://user:password@host:port/database`).
        *   `JWT_SECRET`: A secret key for signing authentication tokens.
        *   Any necessary API keys for external services (e.g., `APIFY_API_TOKEN`, Google Cloud credentials like `GOOGLE_APPLICATION_CREDENTIALS_PATH`, `GCS_BUCKET_NAME`, `VERTEX_AI_PROJECT_ID`, `VERTEX_AI_LOCATION`).
        *   `SHOT_RATE_PER_MIN` (Optional, defaults to 5): Max screenshot requests per minute.
        *   `CACHE_WINDOW_SEC` (Optional, defaults to 5): Time window (seconds) for caching screenshots.
        *   *(Add other critical variables as identified)*

6.  **Database Migrations:**
    *   Apply the database schema migrations:
        ```bash
        npm run migrate up
        ```
    *   *(Optional)* Generate Prisma client (usually happens automatically with `npm install` if set up in postinstall, but can be run manually):
        ```bash
        npx prisma generate
        ```

## Running the Application

### Backend

*   **Development Mode (with auto-reloading):**
    ```bash
    npm run dev
    ```
    This uses `ts-node` to run the TypeScript code directly.

*   **Production Mode:**
    1.  Build the TypeScript code:
        ```bash
        npm run build
        ```
    2.  Start the server:
        ```bash
        npm run start
        ```
    This runs the compiled JavaScript code from the `dist/` directory.

### Frontend

*   **Development Mode:**
    ```bash
    cd frontend
    npm run dev
    ```
    Access the frontend at [http://localhost:3000](http://localhost:3000) (or the configured port).

## Project Structure

*   `src/`: Contains the backend Node.js/Express application source code (TypeScript).
*   `frontend/`: Contains the Next.js frontend application.
*   `prisma/`: Contains Prisma schema (`schema.prisma`) and migration files.
*   `migrations/`: Contains database migration files managed by `node-pg-migrate`.
*   `docs/`: Contains project documentation (see [docs/0-getting-started/README.md](./docs/0-getting-started/README.md) for the main documentation hub).
*   `scripts/` (or root TS files): Contains various utility and maintenance scripts.

## Documentation

For detailed documentation on core concepts, features, API reference, and more, please refer to the `/docs` directory, starting with the [Documentation Hub](./docs/0-getting-started/README.md).
