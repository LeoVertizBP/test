# Feature: AI Compliance Analysis

## Overview

The AI Compliance Analysis feature automatically evaluates scanned content items against the relevant set of compliance rules (determined by the Rule Engine) using an AI model. The primary output of this analysis is a set of "flags" indicating potential rule violations or confirming compliance.

## Key Concepts

*   **Flag (`flags` table):** Represents the AI's assessment of a specific rule against a specific piece of content (or part of it). Each flag contains detailed information about the assessment.
*   **AI Ruling:** The AI's verdict for a specific rule on the content (`compliant`, `violation`, `tentative_violation`).
*   **Confidence Score:** A numerical value (0.00-1.00) indicating the AI's confidence in its ruling.
*   **Reasoning & Context:** Explanations provided by the AI (`ai_confidence_reasoning`, `ai_evaluation`) and the specific text snippet (`context_text`, `content_source`, transcript timestamps) that led to the flag.
*   **Automated Process:** Analysis is triggered automatically as part of the scanning process after content items are ingested and processed.

## Implementation Details

*   **Trigger:** Occurs asynchronously after a `content_item` and its associated media (if any) are successfully processed by the `scanJobService`. The `aiAnalysisService.analyzeContentItemForFlags` function is called.
*   **Rule Determination:** The service identifies the applicable Product Rules and Channel Rules based on the scan job's context (linked products, advertiser defaults, overrides).
*   **AI Interaction:** A detailed prompt containing the content and rules is sent to the AI model (e.g., Voyage 3 large). The AI may consult the "AI Librarian" tool for relevant past examples if needed.
*   **Flag Creation:** The AI's structured response is parsed, and for each rule evaluated, a corresponding record is created in the `flags` table in the database.

### Information Captured in a Flag

Each flag record typically stores:

*   Link to the `content_item`.
*   Link to the specific `rule_id` evaluated (and `rule_type`).
*   Link to the relevant `product_id` (if applicable).
*   AI's Ruling (`ai_ruling`).
*   AI's Confidence Score (`ai_confidence`).
*   AI's Reasoning (`ai_confidence_reasoning`, `ai_evaluation`).
*   Context Snippet (`context_text`).
*   Source of the context (`content_source`: TITLE, DESCRIPTION_CAPTION, TRANSCRIPT).
*   Transcript Timestamps (`transcript_start_ms`, `transcript_end_ms`) if applicable.
*   Initial Status (e.g., `PENDING`).
*   Information about whether the AI Librarian was consulted (`librarian_consulted`, `librarian_examples_provided`).

## User Interaction (Conceptual Frontend)

While the analysis is automated, users interact with its results:

1.  **Viewing Flags:**
    *   Flags are likely displayed in association with their corresponding `content_item`.
    *   A dedicated "Flags" section might allow viewing, filtering, and sorting flags across different scans, publishers, products, or rules.
    *   Filters could include status, rule name, confidence score range, ruling type (violation/compliant), date range, etc.
2.  **Flag Details:**
    *   Clicking on a flag would show detailed information: the specific rule, the AI's ruling, confidence score, reasoning, the context snippet within the original content (potentially highlighted), and links to the full content item.
3.  **Review Workflow:**
    *   Flags serve as the input for the [Flag Review Workflow](./flag-review-workflow.md). Users (reviewers) examine flags, provide their own verdict (`human_verdict`), and update the flag's status.

## Integration Points

*   **Scanning Process:** Triggers the AI analysis.
*   **Rule Engine:** Provides the rules for the AI to evaluate against.
*   **Database (`flags` table):** Stores the results of the analysis.
*   **AI Model Service:** The external AI service (e.g., Voyage, Google Vertex AI) that performs the analysis.
*   **AI Librarian Service:** Provides historical context to the AI model.
*   **Frontend UI:** Displays flags to the user and allows interaction for review.

## Benefits

*   **Automation:** Reduces manual effort required to check content for compliance.
*   **Consistency:** Applies rules consistently across large volumes of content.
*   **Efficiency:** Speeds up the compliance review process by highlighting potential issues.
*   **Prioritization:** Confidence scores help prioritize which flags require the most urgent human review.
