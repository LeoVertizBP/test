# API Routes Reference

This document provides a summary of the backend API endpoints available in the Credit Compliance Tool. All endpoints are assumed to be prefixed with `/api` (e.g., `/api/auth/login`).

**Authentication:** All routes listed below (unless otherwise specified) require a valid JWT Bearer token in the `Authorization` header, verified by the `authenticateToken` middleware.

## Authentication (`/auth`)

*   **`POST /register`**: Creates a new user account.
    *   Body: `{ email, password, name, organization_id }`
    *   Response: `201 Created` with new user object (excluding password).
*   **`POST /login`**: Authenticates a user and returns a JWT.
    *   Body: `{ email, password }`
    *   Response: `200 OK` with `{ message, token, user }`.

## Users (`/users`)

*   **`GET /`**: Retrieves users belonging to the authenticated user's organization.
    *   Response: `200 OK` with an array of user objects.
*   **`POST /`**: Creates a new user within the authenticated user's organization.
    *   Body: `{ username, email, first_name, last_name, role }`
    *   Response: `201 Created` with the new user object.
*   **`GET /:id`**: (TODO) Retrieve a specific user.
*   **`PUT /:id`**: (TODO) Update a specific user.
*   **`DELETE /:id`**: (TODO) Delete a specific user.

## Organizations (`/organizations`)

*   **`GET /`**: Retrieves all organizations (Authorization TODO).
    *   Response: `200 OK` with an array of organization objects.
*   **`GET /:id`**: Retrieves a specific organization by ID (Authorization TODO).
    *   Response: `200 OK` with organization object or `404 Not Found`.
*   **`POST /`**: Creates a new organization (Authorization TODO).
    *   Body: `{ name, settings? }`
    *   Response: `201 Created` with the new organization object.
*   **`PUT /:id`**: Updates an existing organization (Authorization TODO).
    *   Body: `{ name?, settings? }`
    *   Response: `200 OK` with updated organization object or `404 Not Found`.
*   **`DELETE /:id`**: Deletes an organization (Authorization TODO).
    *   Response: `204 No Content` or `404 Not Found`.

## Advertisers (`/advertisers`)

*   *(Endpoints assumed based on service/repo existence - Routes file not examined)*
    *   `GET /`
    *   `GET /:id`
    *   `POST /`
    *   `PUT /:id`
    *   `DELETE /:id`

## Publishers (`/publishers`)

*   **`GET /`**: Retrieves publishers for the authenticated user's organization.
    *   Response: `200 OK` with an array of publisher objects.
*   **`GET /:id`**: Retrieves a specific publisher by ID (checks organization access).
    *   Response: `200 OK` with publisher object or `404 Not Found` / `403 Forbidden`.
*   **`POST /`**: Creates a new publisher within the user's organization.
    *   Body: `{ name, status, settings? }`
    *   Response: `201 Created` with the new publisher object.
*   **`PUT /:id`**: Updates an existing publisher (checks organization access).
    *   Body: `{ name?, status?, settings? }`
    *   Response: `200 OK` with updated publisher object or `404 Not Found` / `403 Forbidden`.
*   **`DELETE /:id`**: Deletes a publisher (checks organization access).
    *   Response: `204 No Content` or `404 Not Found` / `403 Forbidden`.
*   **`GET /:id/channels`**: Retrieves channels for a specific publisher (checks organization access).
    *   Response: `200 OK` with an array of channel objects.
*   *(Channel CRUD under publisher are TODOs)*

## Products (`/products`)

*   **`GET /`**: Retrieves products (filtered by `advertiserId` query param or all for user's org).
    *   Response: `200 OK` with an array of product objects.
*   **`GET /:id`**: Retrieves a specific product by ID.
    *   Response: `200 OK` with product object or `404 Not Found`.
*   **`POST /`**: Creates a new product (checks user org access to advertiser).
    *   Body: `{ name, advertiserId, description?, parameters? }`
    *   Response: `201 Created` with the new product object.
*   **`PUT /:id`**: Updates an existing product (checks user org access to product's advertiser).
    *   Body: `{ name?, description?, parameters? }`
    *   Response: `200 OK` with updated product object or `404 Not Found` / `403 Forbidden`.
*   **`DELETE /:id`**: Deletes a product (checks user org access to product's advertiser).
    *   Response: `204 No Content` or `404 Not Found` / `403 Forbidden`.
*   *(Endpoints for Product Rule Set Assignments and Overrides are assumed)*

## Product Rules (`/product-rules`)

*   **`GET /`**: Retrieves product rules (filtered by `advertiserId` or all for user's org).
    *   Response: `200 OK` with an array of rule objects.
*   **`GET /:id`**: Retrieves a specific product rule by ID (checks org access).
    *   Response: `200 OK` with rule object or `404 Not Found` / `403 Forbidden`.
*   **`POST /`**: Creates a new product rule (checks org access).
    *   Body: `{ name, description, rule_type, version, parameters?, advertiserId }`
    *   Response: `201 Created` with the new rule object.
*   **`PUT /:id`**: Updates an existing product rule (checks org access).
    *   Body: `{ name?, description?, rule_type?, version?, parameters? }`
    *   Response: `200 OK` with updated rule object or `404 Not Found` / `403 Forbidden`.
*   **`DELETE /:id`**: Deletes a product rule (checks org access).
    *   Response: `204 No Content` or `404 Not Found` / `403 Forbidden`.

## Channel Rules (`/channel-rules`)

*   **`GET /`**: Retrieves channel rules (filtered by `advertiserId` or all for user's org).
    *   Response: `200 OK` with an array of rule objects.
*   **`GET /:id`**: Retrieves a specific channel rule by ID (checks org access).
    *   Response: `200 OK` with rule object or `404 Not Found` / `403 Forbidden`.
*   **`POST /`**: Creates a new channel rule (checks org access).
    *   Body: `{ name, description, rule_type, version, parameters?, applicable_channel?, applicable_issuer?, advertiserId }`
    *   Response: `201 Created` with the new rule object.
*   **`PUT /:id`**: Updates an existing channel rule (checks org access).
    *   Body: `{ name?, description?, rule_type?, version?, parameters?, applicable_channel?, applicable_issuer? }`
    *   Response: `200 OK` with updated rule object or `404 Not Found` / `403 Forbidden`.
*   **`DELETE /:id`**: Deletes a channel rule (checks org access).
    *   Response: `204 No Content` or `404 Not Found` / `403 Forbidden`.

## Rule Sets (`/rule-sets`)

*   **`GET /`**: Retrieves rule sets (filtered by `advertiserId` or all for user's org).
    *   Response: `200 OK` with an array of rule set objects.
*   **`GET /:id`**: Retrieves a specific rule set by ID (checks org access).
    *   Response: `200 OK` with rule set object or `404 Not Found` / `403 Forbidden`.
*   **`POST /`**: Creates a new rule set (checks org access).
    *   Body: `{ name, set_type, description?, is_default?, advertiser_id }`
    *   Response: `201 Created` with the new rule set object.
*   **`PUT /:id`**: Updates an existing rule set (checks org access).
    *   Body: `{ name?, description?, is_default? }` (Cannot change `advertiser_id` or `set_type`).
    *   Response: `200 OK` with updated rule set object or `404 Not Found` / `403 Forbidden`.
*   **`DELETE /:id`**: Deletes a rule set (checks org access).
    *   Response: `204 No Content` or `404 Not Found` / `403 Forbidden`.
*   **`POST /:ruleSetId/rules`**: Adds a rule to a rule set (checks org access).
    *   Body: `{ ruleId }`
    *   Response: `201 Created` with the mapping object.
*   **`DELETE /:ruleSetId/rules/:ruleId`**: Removes a rule from a rule set (checks org access).
    *   Response: `204 No Content` or `404 Not Found`.

## Scan Jobs (`/scan-jobs`)

*   **`POST /start-channel-scan`**: Initiates a scan for a single publisher channel.
    *   Body: `{ publisherChannelId }`
    *   Response: `201 Created` with the master scan job object.
*   **`POST /start-multi-target-scan`**: Initiates a scan for multiple publishers/platforms/products.
    *   Body: `{ publisherIds, platformTypes, productIds?, jobName?, jobDescription? }`
    *   Response: `201 Created` with the master scan job object.
*   *(Endpoints for getting job status, listing jobs, getting runs are assumed)*

## Flags (`/flags`)

*   **`GET /`**: Retrieves flags.
    *   Supports filtering via query parameters (e.g., `status`, `scanJobId`, `publisherId`, `productId`, `ruleId`, `aiRuling`, `humanVerdict`, `startDate`, `endDate`, `platform`).
    *   Supports pagination via optional query parameters:
        *   `page` (number, 1-indexed): The page number to retrieve.
        *   `pageSize` (number): The number of flags to retrieve per page.
    *   Response:
        *   Each flag object in the `data` array now includes a more detailed `content_items` object. The `content_items` object itself will contain `content_type` (e.g., "tiktok video", "image", "sidecar") and an array `content_images`.
        *   **`content_items.content_type`**: String indicating the general type of content.
        *   **`content_items.content_images`**: An array of media objects, particularly relevant for Instagram and TikTok. Each object in this array has:
            *   `id` (string): The UUID of the `content_images` record (this is the `mediaId`).
            *   `image_type` (string): The specific type of this individual media file (e.g., "video", "image").
            *   `file_path` (string): The GCS file path for this media item (e.g., `media/content_item_id/video.mp4` or a full GCS URL).
            *   *(Other fields from `content_images` might be present).*
        *   Example snippet of relevant parts within a flag object:
            ```json
            {
              // ... other flag properties ...
              "content_item_id": "uuid_of_content_item", // Direct ID of the content_item
              "content_items": {
                "id": "uuid_of_content_item",
                "url": "original_platform_url",
                "caption": "Full description/caption of the content.",
                "title": "Title of the content",
                "transcript": "[...parsed srt transcript...]",
                "platform": "platform_name (e.g., youtube, tiktok, instagram - ideally lowercase)",
                "content_type": "Specific content type (e.g., Tiktok Video, Image, Sidecar, YouTube Short)",
                "content_images": [
                  {
                    "id": "media_file_uuid_1", // This is the mediaId
                    "image_type": "image",      // Type of this specific media part
                    "file_path": "media/content_item_id/image1.jpg"
                  },
                  {
                    "id": "media_file_uuid_2",
                    "image_type": "image",
                    "file_path": "media/content_item_id/image2.jpg"
                  }
                  // ... or for a video post:
                  // {
                  //   "id": "video_media_file_uuid",
                  //   "image_type": "video",
                  //   "file_path": "media/content_item_id/video.mp4"
                  // }
                ],
                "publishers": { "name": "Publisher Name", "id": "publisher_uuid" },
                "scan_jobs": { "name": "Scan Job Name", "id": "scan_job_uuid" }
              },
              "products": { "name": "Product Name", "id": "product_uuid" },
              "users": { "name": "Reviewer Name", "id": "user_uuid" }
              // ... other flag properties ...
            }
            ```
        *   If `page` and `pageSize` are provided: `200 OK` with a paginated object:
            ```json
            {
              "data": "[Array of flag objects with detailed content_items]",
              "totalFlags": "Total number of matching flags (number)",
              "currentPage": "Current page number (number)",
              "pageSize": "Number of items per page (number)",
              "totalPages": "Total number of pages (number)"
            }
            ```
        *   If `page` and `pageSize` are NOT provided: `200 OK` with an array of all matching flag objects (each with detailed `content_items`).
*   **`PATCH /:flagId`**: Updates the review status and details of a flag.
    *   Body: `{ status, human_verdict?, human_verdict_reasoning?, ai_feedback_notes?, internal_notes? }`
    *   Response: `200 OK` with the updated flag object or `404 Not Found`.
*   **`GET /flags/:flagId`**: Retrieves a specific flag by its ID.
    *   **Path Parameters:**
        *   `flagId` (UUID): The ID of the flag to retrieve.
    *   **Successful Response (`200 OK`):**
        *   Returns a single flag object.
        *   The flag object includes a detailed `content_items` object. This object contains:
            *   `caption: string | null` - The full caption or description of the content item.
            *   `content_type: string | null` - The specific type of the content (e.g., "TikTok Video", "image", "YouTube Short").
            *   `platform: string` - The platform name (e.g., "tiktok", "youtube").
            *   `url: string | null` - The original URL of the content on its platform.
            *   `publishers: object | null` - An object containing publisher details, including `name`.
            *   `content_images: Array<{ id: string, file_path: string, image_type: string }> | null` - An array of media objects associated with the content item.
                *   `id`: The UUID primary key of the `content_images` record (this is the `mediaId` used by `/v1/media-access-url`).
                *   `file_path`: The GCS file path for this media item.
                *   `image_type`: The specific type of this media file (e.g., "video", "image").
        *   Example structure of relevant parts within the returned flag object:
            ```json
            {
              "id": "flag_uuid",
              // ... other direct flag properties ...
              "content_item_id": "uuid_of_content_item",
              "content_items": {
                "id": "uuid_of_content_item",
                "url": "original_platform_url",
                "caption": "Full description/caption of the content.",
                "title": "Title of the content (can be null)",
                "platform": "tiktok",
                "content_type": "TikTok Video",
                "publishers": { "name": "Publisher Name" },
                "content_images": [
                  {
                    "id": "content_image_uuid_1", // PK of content_images, used as mediaId
                    "file_path": "gcs_or_public_url_to_media_1.mp4",
                    "image_type": "video"
                  }
                  // ... more media items if it's a carousel
                ],
                // ... other content_item fields ...
              },
              "products": { "name": "Product Name" },
              "users": { "name": "Reviewer Name (if assigned)" }
              // ... other direct flag relations like comments ...
            }
            ```
    *   **Error Responses:**
        *   `401 Unauthorized`: If not authenticated.
        *   `403 Forbidden`: If the user's organization does not have access to the flag.
        *   `404 Not Found`: If the flag with the specified ID does not exist.
        *   `500 Internal Server Error`: For other server errors.

## Dashboard (`/dashboard`)

*   **`GET /flag-stats`**: Retrieves flag statistics.
*   **`GET /violation-stats`**: Retrieves violation statistics.
*   **`GET /ai-stats`**: Retrieves AI performance statistics.
*   **`GET /processing-metrics`**: Retrieves content processing metrics.
*   **`GET /compliance-overview`**: Retrieves overall compliance overview data.
*   **`GET /ai-confidence`**: Retrieves AI confidence analysis data.
*   **`GET /summary`**: Retrieves all dashboard metrics in a single call.
    *   All endpoints accept filter query params (`startDate`, `endDate`, `publisherId`, `productId`, `advertiserId`).
    *   Response: `200 OK` with JSON data object containing the requested metrics.

## Media Access & Proxy

These endpoints facilitate secure access to media files stored in GCS for platforms like Instagram and TikTok.

### Generate Media Access URL (`/v1/media-access-url`)

*   **`GET /:contentItemId/:mediaId`**: Generates a short-lived, tokenized URL for accessing a specific media item via the GCS content proxy.
    *   **Authentication:** Requires standard JWT Bearer token (`authenticateToken` middleware).
    *   **Path Parameters:**
        *   `contentItemId` (UUID): The ID of the parent `content_items` record.
        *   `mediaId` (UUID): The ID of the specific `content_images` record for which to generate the access URL.
    *   **Successful Response (`200 OK`):**
        ```json
        {
          "mediaAccessUrl": "/api/v1/content-proxy/:contentItemId/:mediaId?access_token=TEMP_JWT_TOKEN"
        }
        ```
    *   **Error Responses:**
        *   `401 Unauthorized`: If the user is not authenticated via Bearer token.
        *   `400 Bad Request`: If `contentItemId` or `mediaId` are not valid UUIDs.
        *   `404 Not Found`: If the specified `content_item` or `content_image` (media) record does not exist.
        *   `500 Internal Server Error`: For issues generating the token or other server errors.

### GCS Content Proxy (`/v1/content-proxy`)

*   **`GET /:contentItemId/:mediaId`**: Securely streams media files (images/videos) for Instagram and TikTok content from Google Cloud Storage. This endpoint is intended to be called using the tokenized URL generated by `/v1/media-access-url`.
    *   **Authentication:** Custom middleware (`authenticateMediaAccessToken`) that validates an `access_token` provided as a query parameter. This token is short-lived and specific to the user and media item.
    *   **Path Parameters:**
        *   `contentItemId` (UUID): The ID of the parent `content_items` record. Must match the `contentItemId` in the validated `access_token`.
        *   `mediaId` (UUID): The ID of the specific `content_images` record to be streamed. Must match the `mediaId` in the validated `access_token`.
    *   **Query Parameters:**
        *   `access_token` (string, required): The short-lived JWT obtained from the `/v1/media-access-url` endpoint.
    *   **Successful Response (`200 OK`):** Streams the file with the appropriate `Content-Type` header (e.g., `image/jpeg`, `video/mp4`).
    *   **Error Responses:**
        *   `400 Bad Request`: If `contentItemId` or `mediaId` are not valid UUIDs, or if `access_token` is missing.
        *   `401 Unauthorized`: If the `access_token` is invalid, expired, or malformed.
        *   `403 Forbidden`: If the `contentItemId` or `mediaId` in the path do not match the claims in the validated `access_token`.
        *   `404 Not Found`: If the `content_images` record is not found in the database for the given IDs, or if the `file_path` is missing, or if the file itself is not found in GCS after path adjustment.
        *   `500 Internal Server Error`: For GCS configuration issues or other unexpected server errors during file streaming.
    *   **Note:** The base path for this route is `/api/v1/content-proxy`.

*Note: This summary is based on examined route files. Some endpoints (especially GET lists, specific GETs, PUTs, DELETEs for certain resources like advertisers, assignments, overrides, publisher channels) might exist but were not explicitly confirmed by reading their respective route files.*
