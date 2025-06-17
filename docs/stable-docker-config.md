# Stable Docker Configuration Reference

This document contains the reference configurations for `Dockerfile` and `docker-compose.yml` that ensure the main application services (`backend`, `crawler-worker`) build and run correctly.

Use these configurations as the baseline. When you need to run specific test scripts like `temp-scripts/testExtractor.ts`, you may need to temporarily modify these files as described below and then revert them back to this state afterwards.

---

## Stable `Dockerfile`

This configuration includes the necessary step to copy the generated Prisma client into the `dist` directory for runtime use, but excludes test-specific files from the build.

```dockerfile
# Use the official Playwright base image which includes Node.js and browser dependencies
# Check installed Playwright version (e.g., 1.52.0) and use the corresponding tag
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Set the working directory in the container
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# --- MODIFIED INSTALL/BUILD STEPS ---
# Install ALL dependencies (including dev) first
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma client (prisma CLI is now available from devDependencies)
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy the rest of the application source code
COPY src ./src
COPY tsconfig.json ./

# Build the TypeScript code (tsc is now available from devDependencies)
RUN npm run build

# Copy the generated Prisma client to the dist folder so runtime can find it
RUN mkdir -p dist/generated && cp -R generated/prisma dist/generated/prisma

# Prune dev dependencies AFTER build is complete
RUN npm prune --omit=dev
# --- END MODIFIED STEPS ---


# Expose the port the app runs on (ensure this matches server.ts)
EXPOSE 3001

# Define the command to run the compiled application
# Runs 'node dist/server.js' as defined in package.json start script
CMD ["npm", "start"]
```

---

## Stable `docker-compose.yml`

This configuration defines the services, standard environment variables, and necessary volumes for the main application. It excludes test-specific variables and volume mounts.

```yaml
version: '3.8' # Specifies the Docker Compose file format version

services:
  # Redis Service (for BullMQ queues)
  redis:
    image: "redis:alpine" # Use a standard Redis image
    container_name: credit-compliance-redis
    ports:
      - "6379:6379" # Map Redis port (optional, for external tools)
    volumes:
      - redis_data:/data # Persist Redis data
    networks:
      - app-network # Connect to the same network

  # Backend Service (Node.js/Express/Prisma)
  backend:
    build:
      context: . # Build using the Dockerfile in the current directory
      dockerfile: Dockerfile # Explicitly name the Dockerfile
    container_name: credit-compliance-backend
    ports:
      - "3001:3001" # Map port 3001 on host to 3001 in container
    environment:
      # Pass environment variables from the .env file
      - DATABASE_URL=${DATABASE_URL}
      - PORT=${PORT:-3001} # Use PORT from .env or default to 3001
      # Add other necessary backend env vars here, referencing the .env file
      - JWT_SECRET=${JWT_SECRET}
      - GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS}
      - GCS_BUCKET_NAME=${GCS_BUCKET_NAME} # Reverted change in backend service
      - VERTEX_AI_PROJECT_ID=${VERTEX_AI_PROJECT_ID}
      - VERTEX_AI_LOCATION=${VERTEX_AI_LOCATION}
      - APIFY_API_TOKEN=${APIFY_API_TOKEN}
      # Add Secret Manager variables
      - GCLOUD_PROJECT_ID=${GCLOUD_PROJECT_ID}
      - GOOGLE_SECRET_MANAGER_CREDENTIALS_PATH=${GOOGLE_SECRET_MANAGER_CREDENTIALS_PATH}
      - GOOGLE_SECRET_ADDER_CREDENTIALS_PATH=${GOOGLE_SECRET_ADDER_CREDENTIALS_PATH}
      # - GCS_KEYFILE_PATH=${GCS_KEYFILE_PATH} # Removed - Use GOOGLE_APPLICATION_CREDENTIALS volume mount instead
    volumes:
      # Mount the source code for development (reflects changes without rebuild)
      # Note: This can sometimes cause issues with node_modules on different OS.
      # If issues arise, we might need to remove this or use a more specific volume strategy.
      - ./src:/app/src
      - ./prisma:/app/prisma
      # Mount Google Cloud credentials if needed locally
      - ${GOOGLE_APPLICATION_CREDENTIALS_PATH}:${GOOGLE_APPLICATION_CREDENTIALS}:ro
    networks: # Corrected indentation
      - app-network # Connect to the custom network

  # Crawler Worker Service
  crawler-worker:
    build:
      context: . # Build using the Dockerfile in the current directory
      dockerfile: Dockerfile # Explicitly name the Dockerfile
    container_name: credit-compliance-crawler-worker # Different container name
    # No ports needed for the worker
    environment:
      # Pass environment variables from the .env file (Copy from backend)
      - DATABASE_URL=${DATABASE_URL}
      - PORT=${PORT:-3001} # Port not used by worker, but keep for consistency? Or remove? Let's keep for now.
      - JWT_SECRET=${JWT_SECRET}
      - GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS}
      - GCS_BUCKET_NAME=${GCS_BUCKET_NAME} # Reverted back to GCS_BUCKET_NAME
      - VERTEX_AI_PROJECT_ID=${VERTEX_AI_PROJECT_ID}
      - VERTEX_AI_LOCATION=${VERTEX_AI_LOCATION}
      - APIFY_API_TOKEN=${APIFY_API_TOKEN}
      - REDIS_URL=${REDIS_URL} # Added: Worker needs Redis URL
      - USER_AGENT=CreditComplianceCrawler/1.0 # Added: Good practice for worker
    volumes:
      # Mount the source code for development (Copy from backend)
      - ./src:/app/src
      - ./prisma:/app/prisma
      # Mount Google Cloud credentials if needed locally (Copy from backend)
      - ${GOOGLE_APPLICATION_CREDENTIALS_PATH}:${GOOGLE_APPLICATION_CREDENTIALS}:ro
    command: node dist/workers/captureWorker.js # Added: Command to run the worker script
    networks: # Corrected indentation
      - app-network # Connect to the same custom network

  # Frontend Service (Next.js)
  frontend:
    build:
      context: ./frontend # Build using the Dockerfile in the frontend directory
      dockerfile: Dockerfile
    container_name: credit-compliance-frontend
    ports:
      - "3000:3000" # Map port 3000 on host to 3000 in container
    environment:
      # Example: Pass the backend URL to the frontend
      - NEXT_PUBLIC_API_URL=http://backend:3001 # Use service name 'backend'
    depends_on:
      - backend # Ensure the backend starts before the frontend
    networks:
      - app-network # Connect to the custom network
    # Mount frontend source for development (reflects changes without rebuild)
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public

# Define a custom network for services to communicate
networks:
  app-network:
    driver: bridge

# Removed the local postgres_data volume as we are using an external DB
# volumes:
#   postgres_data:
#     driver: local

# Define volumes for data persistence
volumes:
  redis_data: # Added volume for Redis persistence
    driver: local
```

---

## Temporary Changes for Running `testExtractor.ts`

To run `temp-scripts/testExtractor.ts` using `docker-compose run`, you need to make the following temporary additions:

**1. Add to `Dockerfile` (before `RUN npm run build`):**

```diff
# Copy the rest of the application source code
COPY src ./src
COPY tsconfig.json ./
+ COPY temp-scripts/testExtractor.ts ./temp-scripts/testExtractor.ts

# Build the TypeScript code (tsc is now available from devDependencies)
RUN npm run build
```

**2. Add to `docker-compose.yml`:**

*   Under `services.backend.environment`:
    ```diff
      - VERTEX_AI_PROJECT_ID=${VERTEX_AI_PROJECT_ID}
      - VERTEX_AI_LOCATION=${VERTEX_AI_LOCATION}
    + - EXTRACTOR_AI_MODEL=${EXTRACTOR_AI_MODEL} # Added for flagExtractionService
      - APIFY_API_TOKEN=${APIFY_API_TOKEN}
    ```
*   Under `services.backend.volumes`:
    ```diff
      # Mount Google Cloud credentials if needed locally
      - ${GOOGLE_APPLICATION_CREDENTIALS_PATH}:${GOOGLE_APPLICATION_CREDENTIALS}:ro
    + - ./data-exports:/app/output_data # Mount local data-exports to container's output directory
    ```
*   (Optional but recommended for consistency) Under `services.crawler-worker.environment`:
    ```diff
      - VERTEX_AI_PROJECT_ID=${VERTEX_AI_PROJECT_ID}
      - VERTEX_AI_LOCATION=${VERTEX_AI_LOCATION}
    + - EXTRACTOR_AI_MODEL=${EXTRACTOR_AI_MODEL} # Added for flagExtractionService (if worker ever uses it)
      - APIFY_API_TOKEN=${APIFY_API_TOKEN}
    ```

**After Testing:**

*   **Remove** the lines marked with `+` from `Dockerfile` and `docker-compose.yml` to return to the stable state documented above.
*   **Rebuild** your Docker images (`docker-compose build --no-cache`) and **restart** your services (`docker-compose down && docker-compose up -d`) to ensure the main application runs correctly with the stable configuration.
