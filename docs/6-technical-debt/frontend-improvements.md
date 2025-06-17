# Frontend Technical Debt & Improvement Areas

This document tracks areas in the frontend codebase that could be improved for better maintainability, scalability, or adherence to best practices.

## Platform List Management

*   **Current State:** The list of available platforms (YouTube, TikTok, Instagram, YouTube Shorts) used in dropdowns for channel management (e.g., `AddPublisherModal`, `EditPublisherModal`) and potentially scan creation is currently hardcoded in `frontend/src/components/management/modals/mockData.ts`.
*   **Issue:** Hardcoding this list means that adding or removing supported platforms requires manual code changes in the frontend. It also duplicates information that ideally should originate from the backend or a central configuration.
*   **Proposed Improvement:**
    1.  Create a backend API endpoint (e.g., `/api/v1/platforms` or similar) that returns the list of currently supported platform identifiers and their display names.
    2.  Modify the relevant frontend components (channel modals, scan creation form) to fetch this list from the API when they load.
    3.  Use the fetched list to dynamically populate the platform selection dropdowns.
*   **Benefit:** Makes the platform list centrally managed and easier to update without frontend code deployments. Reduces potential inconsistencies.
