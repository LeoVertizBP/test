# ---- Builder Stage ----
FROM node:18-bookworm AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies)
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma/

# Copy pre-generated Prisma Client (generated locally to avoid cross-platform issues)
COPY generated ./generated/

# Generate Prisma Client - this creates the 'generated/prisma' folder in /app/generated/prisma
# RUN npx prisma generate --schema=./prisma/schema.prisma  # Commented out - using pre-generated client

# Copy the rest of the application source code
COPY src ./src
COPY tsconfig.json ./

# Build the TypeScript code - this creates the 'dist' folder
RUN npm run build

# Prune dev dependencies from node_modules to reduce size for the final stage
RUN npm prune --omit=dev


# ---- Final Runtime Stage ----
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Set the working directory in the container
WORKDIR /app

# Create a non-root user and group
RUN groupadd --gid 1001 nodeuser && \
    useradd --uid 1001 --gid nodeuser --shell /bin/bash --create-home nodeuser

# Copy essential files from the builder stage
# Copy package.json (may be needed by "npm start" or for metadata)
COPY --from=builder /app/package.json ./package.json

# Copy pruned production node_modules
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled application code
COPY --from=builder /app/dist ./dist

# Copy Prisma schema (needed by Prisma Client runtime)
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma

# Copy the generated Prisma Client to where the compiled code expects it
# (resolving to /app/generated/prisma in the final image)
COPY --from=builder /app/generated/prisma ./generated/prisma

# Change ownership of the app directory to the non-root user
RUN chown -R nodeuser:nodeuser /app

# ---- Add Cloud SQL Auth Proxy and start.sh setup ----
# USER root # Ensure we are root for these operations <-- REMOVE THIS LINE

# Install curl for downloading, then clean up
# This should run as the default user of the image stage, which is typically root.
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Download and install Cloud SQL Auth Proxy
RUN curl -sSL -o /usr/local/bin/cloud-sql-proxy \
    https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.10.1/cloud-sql-proxy.linux.amd64 \
    && chmod +x /usr/local/bin/cloud-sql-proxy

# Create socket directory and give nodeuser ownership
# PGHOST env var will point to /cloudsql/INSTANCE_CONNECTION_NAME
# The cloud-sql-proxy (run by start.sh, which itself runs as nodeuser) will create a subdirectory here.
RUN mkdir -p /cloudsql && chown nodeuser:nodeuser /cloudsql

# Copy the start script AND set its permissions while still root
COPY start.sh /start.sh
RUN chmod +x /start.sh
# ---- End Cloud SQL Auth Proxy and start.sh setup ----

# Switch to the non-root user for the final runtime
USER nodeuser

# Expose the port the app runs on (Cloud Run will set its own PORT env var)
EXPOSE 3001

# Define the command to run the compiled application
# CMD ["npm", "start"] # Commented out, will use ENTRYPOINT with start.sh
ENTRYPOINT ["/start.sh"]
