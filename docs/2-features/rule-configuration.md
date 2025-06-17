# Feature: Rule Configuration

## Overview

The Rule Configuration feature allows authorized users (typically administrators or compliance managers) to define, organize, and manage the compliance rules and their application within the Credit Compliance Tool. This configuration forms the basis for the AI Compliance Analysis.

## Key Concepts & Management Interfaces

Users interact with the rule configuration primarily through the frontend UI, which communicates with the backend API.

1.  **Managing Product Rules:**
    *   **Purpose:** Define rules specific to advertised products.
    *   **API Endpoints:** `POST`, `GET`, `PUT`, `DELETE` under `/api/product-rules`.
    *   **UI Interaction (Conceptual):** A section in the UI likely allows users to view, create, edit, and delete Product Rules associated with their advertisers. Creating/editing involves specifying name, description, type (`manual`/`document_based`), version, and potentially linking guideline documents.

2.  **Managing Channel Rules:**
    *   **Purpose:** Define rules related to platforms, issuers, or general marketing practices.
    *   **API Endpoints:** `POST`, `GET`, `PUT`, `DELETE` under `/api/channel-rules`.
    *   **UI Interaction (Conceptual):** Similar to Product Rules, a UI section allows managing Channel Rules. Creating/editing includes specifying name, description, type, version, and potentially `applicable_channel` or `applicable_issuer`.

3.  **Managing Rule Sets:**
    *   **Purpose:** Group Product Rules or Channel Rules into logical collections.
    *   **API Endpoints:** `POST`, `GET`, `PUT`, `DELETE` under `/api/rule-sets`. `POST` and `DELETE` under `/api/rule-sets/:ruleSetId/rules/:ruleId` for adding/removing rules.
    *   **UI Interaction (Conceptual):** A UI section allows creating/editing/deleting Rule Sets (specifying name, description, type - 'product' or 'channel', advertiser). Another part of the UI allows adding existing Product Rules or Channel Rules to the appropriate type of Rule Set. Users can also designate default rule sets for an advertiser here or in the advertiser settings.

4.  **Managing Rule Set Assignments (Conceptual):**
    *   **Purpose:** Assign a specific Product Rule Set to a particular Product, overriding the advertiser's default.
    *   **Database Table:** `product_rule_set_assignments`.
    *   **API Endpoints:** *Not explicitly found in examined route files. Likely nested under `/api/products/:productId/assignments` or similar.*
    *   **UI Interaction (Conceptual):** Within the product management section of the UI, users would likely select which Product Rule Set (from the available sets for the advertiser) should apply specifically to that product.

5.  **Managing Rule Overrides (Conceptual):**
    *   **Purpose:** Explicitly include or exclude specific Product Rules or Channel Rules for a particular Product, overriding any rule set assignments or defaults.
    *   **Database Tables:** `product_rule_overrides`, `product_channel_rule_overrides`.
    *   **API Endpoints:** *Not explicitly found in examined route files. Likely nested under `/api/products/:productId/overrides` or similar.*
    *   **UI Interaction (Conceptual):** Within the product management section, users could select individual Product Rules or Channel Rules and mark them to be explicitly included or excluded for that specific product.

## User Flow Examples (Conceptual)

### Creating a New Product Rule and Adding to a Set

1.  User navigates to the "Product Rules" section in the UI.
2.  User clicks "Create New Product Rule".
3.  User fills in the rule details (name, description, version, etc.) and saves. (Frontend calls `POST /api/product-rules`).
4.  User navigates to the "Rule Sets" section.
5.  User selects an existing "Product" type Rule Set or creates a new one (Frontend calls `POST /api/rule-sets`).
6.  User edits the selected Rule Set and adds the newly created Product Rule. (Frontend calls `POST /api/rule-sets/:ruleSetId/rules` with the rule ID).

### Assigning a Specific Rule Set to a Product

1.  User navigates to the "Products" section and selects a product to edit.
2.  In the product's settings, user finds the "Rule Set Assignment" section.
3.  User selects a specific Product Rule Set from a dropdown (populated with sets belonging to the product's advertiser).
4.  User saves the product changes. (Frontend calls the relevant assignment API endpoint, e.g., `PUT /api/products/:productId/assignments`).

### Excluding a Specific Channel Rule for a Product

1.  User navigates to the "Products" section and selects a product to edit.
2.  User finds the "Rule Overrides" section.
3.  User selects "Add Channel Rule Override".
4.  User searches for and selects the specific Channel Rule to override.
5.  User chooses "Exclude" as the override type and saves. (Frontend calls the relevant override API endpoint, e.g., `POST /api/products/:productId/overrides`).

## Integration Points

*   **API Routes:** Endpoints under `/api/product-rules`, `/api/channel-rules`, `/api/rule-sets` (and assumed endpoints for assignments/overrides).
*   **Services:** `productRuleService.ts`, `channelRuleService.ts`, `ruleSetService.ts` handle the business logic.
*   **Repositories:** Corresponding repositories interact with the database via Prisma.
*   **Database:** Stores all rule, set, assignment, and override data.
*   **Frontend UI:** Provides the interface for users to perform these configuration tasks.
*   **AI Compliance Analysis:** Consumes the configured rules, sets, assignments, and overrides to determine which rules to apply during analysis.

## Best Practices

*   **Clear Naming Conventions:** Use consistent and descriptive names for rules and rule sets.
*   **Versioning:** Utilize the `version` field for rules to track changes over time.
*   **Descriptions:** Provide clear descriptions for rules and rule sets explaining their purpose and intent.
*   **Authorization:** Ensure only authorized users can modify rule configurations, as this directly impacts compliance results. The backend API enforces this based on organization membership.
*   **Testing:** After significant rule configuration changes, consider running test scans or re-analyzing specific content to verify the expected rules are being applied.
