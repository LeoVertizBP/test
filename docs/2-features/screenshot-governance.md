# Screenshot Governance and Compliance

This document outlines the governance policies related to the storage and use of screenshots captured from content sources (e.g., YouTube) as part of the compliance review process.

## Purpose Limitation
Frames captured via the screenshot feature are stored solely as evidentiary artifacts for internal compliance reviews and audits. They are not intended for redistribution or public display.

## Retention Policy
Screenshots follow a tiered retention policy, configurable via GCS Lifecycle Rules:
*   **Hot Storage (Standard):** 0-90 days (Immediate access)
*   **Warm Storage (Nearline/IA):** 91-365 days (Slightly delayed access, lower cost)
*   **Cold Storage (Coldline):** 1-3 years (Delayed access, further cost reduction)
*   **Archive Storage (Archive):** 3-10 years (Long-term archival, lowest cost, retrieval time applies)
*   **Deletion:** Objects are automatically deleted after 10 years (configurable) or upon client request according to data processing agreements (Right to be Forgotten).

*(Note: The exact transition ages and final deletion time should be confirmed and configured in the GCS bucket's lifecycle rules.)*

## Security
*   **Storage:** Screenshots are stored in a private Google Cloud Storage (GCS) bucket.
*   **Encryption:** Data is encrypted at rest using Google-managed keys or Customer-Managed Encryption Keys (CMEK) if configured. Object ACLs are set to private by default.
*   **Integrity:** The SHA-256 hash of each screenshot file is calculated upon capture and stored in the `content_images` database table alongside the file path. This allows for integrity verification if needed (e.g., upon restore from archive).

## Access Control
*   Access to view screenshot objects in the GCS bucket is restricted via IAM roles. Typically:
    *   `compliance.viewer` (or similar role): Read-only access (`storage.objects.get`).
    *   `compliance.admin` (or similar role): Delete access (`storage.objects.delete`).
*   The backend service account requires permissions to write objects (`storage.objects.create`) and potentially check existence (`storage.objects.get`).

## Deletion / Right to be Forgotten
*   An administrative API endpoint (e.g., `DELETE /api/evidence/{contentItemId}` or similar, potentially cascading from flag deletion) should be implemented to handle deletion requests.
*   Deletion must remove both the object from the GCS bucket and the corresponding metadata row from the `content_images` table.
*   Manual deletion processes must be available to fulfill Right to be Forgotten requests as per applicable regulations (e.g., GDPR, CCPA).

## Audit Trail
*   Google Cloud Audit Logs (specifically Cloud Storage access logs) should be enabled for the bucket.
*   These logs should be streamed or exported to a Security Information and Event Management (SIEM) system or a centralized logging solution (e.g., Cloud Logging bucket with appropriate retention).
*   Audit logs should be retained for a defined period (e.g., 7 years) to meet compliance and security requirements.

## Legal Stance
*   The capture and internal storage of single frames for compliance verification purposes is considered transformative internal use.
*   Screenshots must not be redistributed externally.
*   The original source URL of the content (e.g., the YouTube video URL) must always be cited and linked within the compliance platform interface when displaying or referencing the screenshot.
