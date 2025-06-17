# Feature: Publisher & Product Setup

## Overview

This feature allows authorized users to manage the core entities involved in compliance scanning: Publishers (content creators) and Products (the items being advertised). This includes onboarding publishers, defining their content channels, creating products, and potentially linking publishers to the products they are permitted to promote.

## Key Concepts

*   **Publisher (`publishers` table):** Represents a content creator or entity whose content is being scanned (formerly referred to as 'Affiliate'). Publishers belong to an Organization.
*   **Publisher Channel (`publisher_channels` table):** Represents a specific content platform/URL associated with a Publisher (e.g., their YouTube channel URL, TikTok profile URL).
*   **Product (`products` table):** Represents an item or service being advertised. Products belong to an Advertiser (which in turn belongs to an Organization).
*   **Publisher-Product Link (`publisher_products` table):** A relationship indicating that a specific Publisher is associated with or allowed to promote a specific Product.

## Implementation

Management is performed via the frontend UI interacting with backend API endpoints.

### Managing Publishers

*   **Purpose:** Onboard new publishers, update their status or details.
*   **API Endpoints:** `POST`, `GET`, `PUT`, `DELETE` under `/api/publishers`.
*   **UI Interaction (Conceptual):**
    *   A "Publishers" section lists publishers within the user's organization.
    *   Users can create new publishers (specifying name, initial status like 'onboarding' or 'active').
    *   Users can edit existing publishers (updating name, status, contact info/settings).
    *   Users can delete publishers.

### Managing Publisher Channels

*   **Purpose:** Define the specific social media channels/URLs for each publisher that should be scanned.
*   **API Endpoints:**
    *   `GET /api/publishers/:id/channels`: Lists channels for a specific publisher.
    *   *Endpoints for creating, updating, and deleting channels (e.g., `POST /api/publishers/:id/channels`) are noted as TODOs in the route file and need implementation.*
*   **UI Interaction (Conceptual):**
    *   Within a specific publisher's detail view, a section lists their associated channels.
    *   Users can add new channels (specifying platform like 'YouTube', 'TikTok', 'Instagram', and the channel URL).
    *   Users can edit existing channel details (e.g., update URL, change status).
    *   Users can remove channels.

### Managing Products

*   **Purpose:** Define the products or services that are subject to compliance rules.
*   **API Endpoints:** `POST`, `GET`, `PUT`, `DELETE` under `/api/products`.
*   **UI Interaction (Conceptual):**
    *   A "Products" section lists products, likely filterable by Advertiser.
    *   Users can create new products (specifying name, associated advertiser, description, marketing bullets, etc.).
    *   Users can edit existing product details.
    *   Users can delete products.
    *   *This section is also where users likely manage Product-specific Rule Set Assignments and Rule Overrides (see [Rule Configuration](./rule-configuration.md)).*

### Linking Publishers to Products (Conceptual)

*   **Purpose:** Establish which publishers are associated with which products. This relationship might be used for reporting or potentially scoping scans/rules (though current scan initiation seems based on publisher/platform/product lists directly).
*   **Database Table:** `publisher_products`.
*   **API Endpoints:** *Not explicitly found in examined route files. Likely nested under `/api/publishers/:id/products` or `/api/products/:id/publishers`.*
*   **UI Interaction (Conceptual):**
    *   Could be managed from the Publisher's detail page (assigning Products to the Publisher).
    *   Could be managed from the Product's detail page (assigning Publishers to the Product).
    *   Allows selecting one or more entities from the other type to create the link.

## Integration Points

*   **API Routes:** Endpoints under `/api/publishers` and `/api/products`. Requires additional endpoints for full channel and publisher-product link management.
*   **Services:** `publisherService.ts`, `productService.ts` handle business logic.
*   **Repositories:** Corresponding repositories interact with the database.
*   **Database:** Stores `publishers`, `publisher_channels`, `products`, and `publisher_products` data.
*   **Frontend UI:** Provides the interface for managing these entities.
*   **Scan Management:** Uses Publisher and Channel information to target scans.
*   **Rule Engine:** Uses Product information for applying product-specific rules, assignments, and overrides.

## Best Practices

*   **Clear Statuses:** Use meaningful statuses for Publishers and Channels (e.g., 'Onboarding', 'Active', 'Inactive', 'Removed').
*   **Validation:** Validate inputs, especially Channel URLs, to ensure they are well-formed.
*   **User Experience:** Provide clear ways to associate channels with publishers and potentially publishers with products. Bulk operations might be useful for managing large numbers of entities.
*   **Authorization:** Ensure users can only manage publishers and products within their authorized scope (typically their organization).
