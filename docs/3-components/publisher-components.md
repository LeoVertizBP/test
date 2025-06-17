# Publisher Portal Components

This document outlines specific frontend components developed for or heavily utilized within the Publisher Portal.

## `PublisherFlagPreview.tsx`

**Location:** `frontend/src/components/publisher/PublisherFlagPreview.tsx`

**Purpose:**
This component is responsible for rendering a detailed view of a single flagged content item, specifically tailored for publisher users. It's typically displayed within a modal when a publisher selects a flag from their list on the `/publisher/flags` page.

**Key Features & Information Displayed:**

*   **Media Display:**
    *   Shows the actual flagged media content.
    *   Supports YouTube video embeds.
    *   Handles TikTok and Instagram media (videos and image carousels) hosted on GCS by fetching secure access URLs via the `flagService.getMediaAccessUrl` frontend service.
*   **Content Details:**
    *   **Full Description/Caption:** The complete text caption or description associated with the content item.
    *   **Excerpt/Context Snippet:** The specific text segment that triggered the AI flag.
    *   **Link to Original Content:** A direct URL to view the content on its original platform (e.g., TikTok, YouTube).
*   **Flag & Rule Information:**
    *   **Product:** The name of the product associated with the flag.
    *   **Rule Violated:** The name of the rule that was flagged.
    *   **Rule Description:** The detailed text/manual for the violated rule.
*   **Violation Analysis:**
    *   Displays the AI's reasoning for why the content was flagged.
    *   *Note: The direct AI verdict (e.g., "VIOLATION") and the AI confidence score are intentionally not shown to publishers in this view.*
*   **Communication Log:**
    *   Provides a threaded view of comments exchanged between the review team (Admins/Reviewers) and the publisher regarding this specific flag.
    *   Includes an input field for the publisher to type and send new messages.
    *   Publishers cannot delete comments.
*   **Actions:**
    *   Allows publishers to "Mark as Remediated".

**Props:**

*   `flag: PreviewFlagFromParent`: An object containing all the necessary data for the flag to be displayed. The structure should match the `PreviewFlagFromParent` interface defined within `PublisherFlagPreview.tsx` (and transformed in `PublisherFlagsPage.tsx`). Key fields include:
    *   `id` (flag's own ID)
    *   `contentItemId`
    *   `ruleId`
    *   `publisher` (name)
    *   `product` (name)
    *   `rule` (name, as fallback)
    *   `platform`
    *   `contentMediaType`
    *   `mediaDisplaySrc` (YouTube URL or GCS Media ID - `content_images.id` - for single TikTok/IG video)
    *   `mediaItems` (Array of `{id: GCS_Media_ID (content_images.id)}` for TikTok/IG image carousels)
    *   `fullDescription`
    *   `originalPlatformUrl`
    *   `contextSnippet`
    *   `ruleText` (as fallback)
    *   `aiReasoning`
    *   `comments` (array)
*   `onCommentAdded: () => Promise<void>`: A callback function that is triggered after a publisher successfully posts a new comment. This is typically used to refresh the flag details and comment list.
*   `onMarkAsRemediated: () => Promise<void>`: A callback function triggered when the publisher clicks the "Mark as Remediated" button. This typically updates the flag's status and removes it from the active list.

**Styling & Dependencies:**
*   Based on the structure of `EnhancedFlagPreview.tsx`.
*   Uses Tailwind CSS for styling.
*   Relies on `BaseModal.tsx` for modal presentation.
*   Uses `flagService.getMediaAccessUrl` (frontend) for fetching GCS media URLs.
*   Uses `ruleService.getProductRule` (frontend) for fetching detailed rule text.

## `PublisherFlagsPage.tsx`

**Location:** `frontend/src/app/publisher/flags/page.tsx`

**Purpose:**
This page component displays a list of flags that are currently assigned to the logged-in publisher and require remediation (typically those with a "REMEDIATING" status).

**Key Features & Information Displayed per Flag Item:**

*   **Rule Name:** A summary title for the rule violation (e.g., from `rule_citation`, `rule_section`, or a default like "Violation Detected").
*   **URL:** The direct URL to the flagged content.
*   **Product:** The name of the product associated with the flag.
*   **Context:** A snippet of the content that was flagged (e.g., `context_text`).
*   **Actions:**
    *   "Mark Remediated" button: Allows the publisher to directly mark the flag as remediated from the list.
    *   "View Details" button: Opens the `PublisherFlagPreview.tsx` component in a modal for full details and communication.

**Important Notes:**
*   The list view is intentionally simplified. It does **not** display comments or the full detailed rule violation text directly on the list items. These are available in the "View Details" modal.
*   The page fetches its data from the `/api/publishers/flags` endpoint.
