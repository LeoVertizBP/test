# AI Compliance Analysis

## Overview

The AI Compliance Analysis system is responsible for evaluating scanned content items against the applicable set of compliance rules (determined by the Rule Engine) and generating potential violation flags. It leverages large language models (LLMs) to understand content context and rule requirements.

## Key Concepts

*   **Content Analysis:** The process of examining the text (title, caption/description, transcript) and potentially associated media (images/video context) of a `content_item`.
*   **Rule Application:** Determining the specific set of Product Rules and Channel Rules that apply to the content item based on its associated product(s), advertiser, and platform context.
*   **Prompt Engineering:** Crafting detailed instructions (prompts) for the AI model to guide its analysis, including the content, applicable rules, evaluation steps, and desired output format.
*   **AI Model:** Utilizes Google's Generative AI models (specifically mentioning `gemini-2.0-flash` in the analyzed code, though the user requirement specifies **Voyage 3 large with 1024 dimensions** - this discrepancy should be noted and clarified).
*   **Flag Generation:** The AI outputs structured data indicating whether each applicable rule is considered compliant or violated, along with confidence scores, reasoning, and context. This output is used to create `flags` records in the database.
*   **AI Librarian (Tool Use):** The AI model can request relevant, human-reviewed past examples for specific rules using a function call (`get_relevant_examples`) if it lacks confidence or needs clarification. This interacts with the `aiLibrarianService`.
*   **Confidence Scoring:** The AI assigns a confidence score (0.00-1.00) to its ruling for each rule, based on predefined guidelines and the clarity of evidence.
*   **Asynchronous Processing:** AI analysis for each content item is typically triggered asynchronously after the item and its media have been processed and stored.

## Implementation

The core logic resides primarily in `src/services/aiAnalysisService.ts` (and potentially its parallel counterpart `aiAnalysisServiceParallel.ts`). Key supporting services include `aiLibrarianService.ts` and `aiCallWrapperService.ts`.

### Workflow

```mermaid
graph LR
    A[Scan Process Completes Item Processing] --> B(Trigger AI Analysis);
    B --> C{aiAnalysisService.analyzeContentItemForFlags};
    C --> D(Fetch Applicable Rules);
    D --> E{Rule Engine Logic};
    E --> F(Get Product & Channel Rules);
    F --> G(Generate AI Prompt);
    G -- Includes --> H(Content Item Data);
    G -- Includes --> I(Applicable Rules List);
    G -- Includes --> J(Analysis Instructions);
    G --> K{Call AI Model (e.g., Voyage/Gemini)};
    K -- Request Examples? --> L{Use 'get_relevant_examples' Tool};
    L --> M{aiLibrarianService.findRelevantExamples};
    M --> N(Fetch Examples from DB);
    N --> O(Return Examples);
    O --> K;
    K -- AI Response --> P(Parse AI Output);
    P --> Q(Extract Flag Data);
    Q --> R{Create Flags in DB};
    R --> S(Store Flag Record);

    subgraph "Rule Determination"
        D
        E
        F
    end

    subgraph "AI Interaction"
        G
        H
        I
        J
        K
        L
        M
        N
        O
        P
        Q
    end

    subgraph "Database"
        R
        S
    end
```

### Key Steps Explained

1.  **Trigger:** Analysis is initiated by `scanJobService` after a `content_item` (and its media) is successfully processed and stored.
2.  **Rule Fetching:** The service calls functions like `getProductContextRules` and `getAdvertiserGlobalRules` to retrieve the list of `ApplicableRule` objects relevant to the content item's context (product, advertiser, platform).
3.  **Prompt Generation:** A detailed prompt is constructed (`generateAnalysisPromptGeneric`) containing:
    *   The content item's text (title, caption, transcript).
    *   The list of applicable rules (names, IDs, descriptions).
    *   Instructions for product-feature mapping, rule applicability checks, compliance evaluation, contextual inference, and confidence scoring.
    *   The definition of the `get_relevant_examples` tool.
    *   The required output format (`FLAG_START`/`FLAG_END` blocks).
4.  **AI Model Call (`callTextAnalysisModelWithLibrarianTool`):**
    *   The prompt is sent to the configured AI model (e.g., Voyage 3 large).
    *   The `aiCallWrapperService` likely handles logging and potentially retries.
    *   **Tool Handling:** If the model responds with a function call for `get_relevant_examples`:
        *   The `aiLibrarianService.findRelevantExamples` function is called with the rule details and context snippet.
        *   Relevant examples are retrieved from the `ai_feedback_examples` table.
        *   The examples are formatted and sent back to the AI model in a follow-up call.
    *   The final text response from the AI, containing the flag blocks, is received.
5.  **Output Parsing:** The structured text response from the AI is parsed to extract the details for each generated flag (rule ID, ruling, confidence, context, etc.).
6.  **Flag Creation:** For each valid flag extracted from the AI output, a new record is created in the `flags` table in the database, linked to the `content_item` and the specific `rule_id`. Flags with invalid rule IDs are discarded.

## Integration Points

*   **Rule Engine:** Provides the set of rules to be evaluated.
*   **Scan Process:** Triggers the analysis after content ingestion.
*   **Database:** Stores AI feedback examples (`ai_feedback_examples`), AI usage logs (`ai_usage_logs`), and the generated compliance flags (`flags`).
*   **External AI Service:** Google Generative AI / Vertex AI (or potentially Voyage AI based on user requirements).
*   **AI Librarian Service:** Provides historical examples to the AI model upon request.

## Best Practices & Considerations

*   **Model Selection:** Ensure the chosen AI model (e.g., Voyage 3 large) is suitable for the complexity of the rules and content. Note the discrepancy between user requirement (Voyage) and code reference (Gemini Flash).
*   **Prompt Clarity:** The effectiveness of the analysis heavily depends on the clarity, detail, and accuracy of the prompt provided to the AI. Continuous refinement is often necessary.
*   **Tool Use:** The AI Librarian tool can improve accuracy in ambiguous cases but adds latency and cost. Monitor its usage and effectiveness.
*   **Confidence Thresholds:** Use the AI's confidence scores to prioritize review efforts (e.g., focus on low-confidence violations or high-confidence violations). Rule-specific bypass thresholds (`bypass_threshold` in the schema) might automatically close high-confidence compliant flags.
*   **Feedback Loop:** Implement a mechanism for reviewers to provide feedback on AI-generated flags (`ai_feedback_examples` table seems designed for this), which can be used to fine-tune prompts or potentially retrain models (if applicable).
*   **Cost & Rate Limiting:** Be mindful of API costs and potential rate limits when making calls to external AI services, especially with parallel processing. Implement throttling (`aiThrottler` utility exists) if necessary.
*   **Data Privacy:** Ensure sensitive information within the content is handled appropriately according to privacy regulations when sending data to external AI services.
