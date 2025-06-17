# Stage 1: Build the Next.js application (Builder Stage)
FROM node:20-alpine AS builder
WORKDIR /app

# Define an ARG for the API URL
ARG NEXT_PUBLIC_API_URL_ARG

# Set the ENV variable from the ARG so it's available to npm run build
# This makes it available to process.env.NEXT_PUBLIC_API_URL in next.config.js
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL_ARG

# Install dependencies
COPY package.json package-lock.json* ./
# Using npm ci for cleaner installs with lockfile
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the Next.js application (this will now use standalone output thanks to next.config.ts)
RUN npm run build

# Stage 2: Production image (Runner Stage)
FROM node:20-alpine AS runner
WORKDIR /app

# Create a non-root user and group
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output from the builder stage
# This includes the server.js, .next/server, and a minimal node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy the public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy the static assets from the .next/static folder
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to the non-root user
USER nextjs

# Expose the port the app runs on
EXPOSE 3000

# Set the command to start the Next.js server in standalone mode
# The standalone output typically includes a server.js file at its root.
CMD ["node", "server.js"]
