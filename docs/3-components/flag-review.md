# Flag Review Components

This section documents components used in the flag review feature found in `frontend/src/components/flagReview`.

## `ConnectedFlagReviewContent.tsx`

This is the main smart component responsible for the Flag Review page (`/flag-review/connected`). It orchestrates data fetching, state management, and interactions between various child components.

**Key Features & Behaviors:**

*   **Data Fetching:**
    *   Fetches an initial set of flags from the `/api/flags` endpoint upon loading.
    *   Implements **infinite scrolling** for the flags list. As the user scrolls towards the bottom of the displayed flags, the component automatically fetches the next page of flags and appends them to the list. This is achieved using an `IntersectionObserver` monitoring a sentinel element.
    *   The number of flags fetched per page is determined by the `pageSize` state variable within the component (defaulting to 50).
    *   Handles loading states (initial load and loading more) and displays appropriate indicators.
    *   Manages error states during data fetching.
*   **Filtering:**
    *   Integrates with the `FilterBar.tsx` component to allow users to filter flags based on various criteria (Scan Job, Publisher, Product, Status, Platform, Date Range).
    *   Refetches flags (resetting to page 1) when filter criteria change.
*   **Flag Selection & Preview:**
    *   Manages the currently selected flag.
    *   Passes the selected flag's data to `EnhancedFlagPreview.tsx` for detailed display and interaction.
*   **Status Updates & Verdict Submission:**
    *   Handles flag status changes initiated from `EnhancedFlagTable.tsx`.
    *   Manages human verdict submissions from `EnhancedFlagPreview.tsx`.
    *   Updates the local state and makes API calls to persist these changes.
*   **Export:**
    *   Provides functionality to export filtered flags to a CSV file via the `ExportFlagsDialog.tsx` component.

**Child Components:**

*   `EnhancedFlagTable.tsx`: Displays the list of flags with sorting and allows status changes.
*   `EnhancedFlagPreview.tsx`: Shows detailed information for a selected flag and allows verdict submission.
*   `FilterBar.tsx`: Provides UI for filtering the flags.
*   `ExportFlagsDialog.tsx`: A modal dialog for configuring and initiating flag exports.

### `EnhancedFlagPreview.tsx`

This component is responsible for displaying the detailed view of a selected flag and allowing reviewers to submit their verdicts.

**Key Features & Behaviors:**

*   **Detailed Flag Information (Header):** Displays publisher, product, scan job, and AI confidence at the top.
*   **Content Display:**
    *   **Media Display:**
        *   **YouTube Videos & Shorts:** Embeds YouTube videos directly using an iframe. Handles various URL formats and starts playback 8 seconds prior to `transcriptStartMs` for context.
        *   **Instagram & TikTok Media:** Displays videos and images, with navigation for carousels/slideshows. Media is sourced securely via tokenized URLs from `/api/v1/media-access-url` pointing to the GCS proxy. Manages loading and error states.
        *   **Fallback:** Shows appropriate messages if media cannot be loaded.
    *   **Full Description:** Displays the full caption/description of the content item.
    *   **Link to Original Content:** Provides a direct link to the content on its original platform.
    *   **Screenshot Capture (YouTube):** Allows capturing a screenshot at `transcriptStartMs` (displayed in `mm:ss` format) via `/api/screenshots`.
*   **Evaluation Section:** This section, located below the content and above "Your Verdict", provides a consolidated view for AI and rule-related information.
    *   **Product:** Displays the name of the product associated with the flag.
    *   **Excerpt:** Displays the `flags.context_text` (previously "Transcript/Caption (Snippet)").
    *   **Applicable Rule:**
        *   Displays the rule name (e.g., "Rule Applied: [Rule Name]").
        *   Fetches and displays the rule's detailed description (`manual_text` or fallback `description`) from the `/api/product-rules/{rule_id}` endpoint using the `ruleService`.
        *   Shows "Loading rule name..." and "Loading rule description..." during the asynchronous fetch.
    *   **AI Evaluation Box:** A color-coded (red for violation, green for compliant) box containing:
        *   **AI Verdict:** The AI's verdict (e.g., "Violation", "Compliant"), with the first letter capitalized.
        *   **AI Reasoning:** The reasoning provided by the AI.
        *   **Confidence Footer:** "Based on X% confidence analysis".
    *   **Previous Ruling:** If a human verdict has been previously submitted, it's displayed here (e.g., "Previous Ruling: Violation").
*   **Verdict Submission:** Provides UI for reviewers to submit their verdict (Violation/Compliant), severity, AI feedback, and comments. Handled by `ConnectedFlagReviewContent.tsx`.

**Services Used:**
*   `flagService.ts`: For media access URL fetching.
*   `ruleService.ts`: (New) For fetching detailed product rule information (name, description, manual_text) using `getProductRule(ruleId)`.

*(Further documentation for other specific child components like `FlagTable.tsx`, `FilterBar.tsx`, etc., can be added below as needed.)*
