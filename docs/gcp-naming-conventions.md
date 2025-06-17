# GCP Resource Naming Conventions for Airora

This document outlines the naming conventions for Google Cloud Platform (GCP) resources used by the Airora application. Consistent naming helps in identifying, managing, and automating resources.

## Convention Format

The general format for naming resources is:

`airora-{environment}-{resource_type}-{identifier}`

Where:

*   `airora`: The application name.
*   `{environment}`: The deployment environment.
    *   `dev`: Development (if specific cloud resources are used for dev)
    *   `staging`: Staging/Pre-production environment
    *   `prod`: Production environment
*   `{resource_type}`: A short, descriptive code for the GCP resource type.
*   `{identifier}`: A unique name or purpose for that specific resource instance.

## Resource Type Codes

| Resource Type                      | Code    | Example Identifier | Full Example (Staging)             |
| ---------------------------------- | ------- | ------------------ | ---------------------------------- |
| Cloud SQL Instance                 | `db`    | `main`, `replica`  | `airora-staging-db-main`           |
| Cloud SQL Database (within instance) | `dbname`| `app`, `users`     | `airora_staging_app_db` (Note: underscores often used in DB names) |
| Memorystore for Redis Instance     | `redis` | `cache`, `queue`   | `airora-staging-redis-cache`       |
| Artifact Registry Repository       | `repo`  | `backend`, `frontend`| `airora-staging-repo-backend`      |
| Secret Manager Secret              | `secret`| `db-password`, `jwt`| `airora-staging-secret-db-password`|
| Cloud Run Service                  | `run`   | `backend`, `frontend`, `worker` | `airora-staging-run-backend`     |
| Cloud Storage Bucket               | `bucket`| `uploads`, `backups`| `airora-staging-bucket-uploads`    |
| Cloud Build Trigger                | `build` | `deploy-staging`   | `airora-staging-build-deploy`      |
| Service Account                    | `sa`    | `cloudrun`, `storage`| `airora-staging-sa-cloudrun`       |
| VPC Network                        | `vpc`   | `main`             | `airora-staging-vpc-main`          |
| Subnet                             | `subnet`| `us-south1`        | `airora-staging-subnet-us-south1`  |
| Firewall Rule                      | `fw`    | `allow-http`       | `airora-staging-fw-allow-http`     |
| Pub/Sub Topic                      | `topic` | `scan-jobs`        | `airora-staging-topic-scan-jobs`   |
| Pub/Sub Subscription               | `sub`   | `worker-process`   | `airora-staging-sub-worker-process`|

## General Guidelines

*   **Lowercase:** Use all lowercase letters.
*   **Hyphens:** Use hyphens (`-`) to separate components in the name. Underscores (`_`) may be used for identifiers where GCP resource constraints prefer them (e.g., database names within Cloud SQL).
*   **Conciseness:** Keep names reasonably short but descriptive.
*   **Uniqueness:** Ensure names are unique within their scope (e.g., globally unique for buckets, unique within a project/region for others).
*   **Environment Specificity:** Clearly indicate the environment (`staging`, `prod`) in the name.

## Examples Applied

*   **Staging Environment (region: `us-south1`)**
    *   Cloud SQL Instance: `airora-staging-db-main`
    *   Database within instance: `airora_staging_db`
    *   Memorystore for Redis: `airora-staging-redis-main`
    *   Artifact Registry (backend images): `airora-staging-repo-backend`
    *   Cloud Run (frontend service): `airora-staging-run-frontend`
    *   Secret for API Key: `airora-staging-secret-apify-key`

*   **Production Environment (region: `us-south1`)**
    *   Cloud SQL Instance: `airora-prod-db-main`
    *   Database within instance: `airora_prod_db`
    *   Memorystore for Redis: `airora-prod-redis-main`
    *   Artifact Registry (backend images): `airora-prod-repo-backend`
    *   Cloud Run (frontend service): `airora-prod-run-frontend`

This convention should be applied to all new resources created in GCP for the Airora project.
