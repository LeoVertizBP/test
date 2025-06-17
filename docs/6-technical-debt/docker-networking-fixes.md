# Docker Networking and YouTube Shorts Integration Fixes

## Issues Fixed

1. **YouTube Shorts Not Appearing in Scan Job Forms**
2. **Environment Variables Not Working in Docker**
3. **Live Code Changes Not Reflecting in Docker**

## Root Causes and Solutions

### 1. Missing YouTube Shorts in Modal Dialog

**Problem**: The `ConnectedNewScanJobModal.tsx` component had hardcoded platform options that didn't include YouTube Shorts.

**Solution**: Added YouTube Shorts to the hardcoded platform options list:

```javascript
const availablePlatforms: PlatformOption[] = [
  { id: "YouTube", name: "YouTube Video" }, 
  { id: "YOUTUBE_SHORTS", name: "YouTube Shorts" }, // Added this line
  { id: "TikTok", name: "TikTok" },             
  { id: "Instagram", name: "Instagram" },         
];
```

### 2. Docker Networking Issues in API Calls

**Problem**: The `NewScanJobForm.tsx` component was using hardcoded `http://localhost:3001` URLs for API calls, which doesn't work in Docker because "localhost" in a container refers to the container itself, not the host.

**Solution**: Updated the code to use environment variables with a fallback:

```javascript
// Use environment variable with fallback for local development
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
console.log(`[API Debug] Using API base URL: ${apiBaseUrl}`);
const response = await axios.get(`${apiBaseUrl}/api/v1/platforms`);
```

### 3. Next.js Environment Variables Configuration

**Problem**: Next.js wasn't properly exposing environment variables to the client-side code.

**Solution**: Updated `next.config.ts` to explicitly define environment variables:

```javascript
// Explicitly add environment variables that should be available to the client
env: {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
},
```

### 4. Live Code Changes Not Being Applied

**Problem**: The docker-compose.yml file had commented-out volume mounts, which meant code changes weren't being reflected in the running containers.

**Solution**: Uncommented and enabled volume mounts in docker-compose.yml:

```yaml
# Mount frontend source for development (reflects changes without rebuild)
volumes:
  - ./frontend/src:/app/src
  - ./frontend/public:/app/public
```

## Docker Networking Concepts to Remember

When running applications in Docker containers, keep these key points in mind:

1. **Container Isolation**: Each container has its own network namespace. When a container refers to "localhost", it's referring to itself, not the host machine or other containers.

2. **Service Names as Hostnames**: In Docker Compose, service names can be used as hostnames. For instance, a service named "backend" can be reached at `http://backend:3001` from other containers in the same network.

3. **Environment Variables**: Use environment variables defined in docker-compose.yml to configure connections between services. These should be used in code instead of hardcoded URLs.

4. **Volume Mounts**: For development, mount source code as volumes to see changes without rebuilding containers.

## Testing Your Changes

After making these types of fixes:

1. Restart the Docker containers:
   ```
   docker-compose down && docker-compose up -d
   ```

2. Check the logs for any errors:
   ```
   docker-compose logs -f
   ```

3. Access the application at http://localhost:3000 and verify the fix works.
