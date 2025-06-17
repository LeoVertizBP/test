# Database Migrations Guide

This guide outlines the process for applying database schema changes using Prisma Migrate, especially within the Docker development environment.

## Standard Migration Process (Docker)

When you make changes to the `prisma/schema.prisma` file, you need to generate and apply a database migration.

1.  **Ensure Docker containers are running:** Use `docker-compose up -d` if needed.
2.  **Run the migration command:** Execute the following command from your host machine's terminal in the project root directory:

    ```bash
    docker-compose exec backend npx prisma migrate dev --name <migration_name>
    ```

    Replace `<migration_name>` with a descriptive name for your changes (e.g., `add_user_roles`, `update_product_fields`).

    This command does the following:
    *   Connects to the `backend` service container.
    *   Runs `prisma migrate dev`.
    *   Compares your `prisma/schema.prisma` with the database schema.
    *   Generates a new SQL migration file in `prisma/migrations/TIMESTAMP_<migration_name>/migration.sql`.
    *   Applies the generated SQL migration to the database.
    *   Updates the `_prisma_migrations` table in the database to record that the migration was applied.
    *   Generates the Prisma Client based on the updated schema.

## Troubleshooting Migration Issues

Sometimes, Prisma's migration state can become inconsistent between the local filesystem (inside the container), the database schema, and the `_prisma_migrations` table history. This often happens after interrupted migrations or manual database changes.

### Scenario: "Drift detected" or "P3015: Could not find the migration file..." Errors

If you encounter errors like "Drift detected" or `P3015` ("Could not find the migration file...") when running `prisma migrate dev`, and you **cannot reset the database** (e.g., using `prisma migrate reset`), follow these steps:

1.  **Ensure Schema File is Correct:** Verify that your `prisma/schema.prisma` file accurately reflects the *final desired state* of your database schema, including the changes you want to apply.
2.  **Pull Current DB Schema (Optional but Recommended):** To ensure your local schema matches the *actual* database state before applying new changes, run:
    ```bash
    docker-compose exec backend npx prisma db pull
    ```
    *Note:* This overwrites your local `prisma/schema.prisma`. If you run this, you'll need to manually re-add the schema changes you intended to make. It's often better to skip this if you're confident your schema file is correct and just proceed to the next steps.
3.  **Generate SQL Diff:** Create a SQL script containing only the differences between the current database state and your desired schema state. Replace `<descriptive_migration_name>` appropriately.
    ```bash
    # Make sure prisma/schema.prisma reflects the desired end state
    docker-compose exec backend sh -c "npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/<descriptive_migration_name>.sql"
    ```
    *   `--from-schema-datasource prisma/schema.prisma`: Tells Prisma to connect to the database specified in the schema file to get the *current* state.
    *   `--to-schema-datamodel prisma/schema.prisma`: Tells Prisma to use the local schema file as the *desired* state.
    *   `--script`: Outputs raw SQL.
    *   `> prisma/<descriptive_migration_name>.sql`: Saves the SQL to a file (e.g., `prisma/add_ai_bypass_fields.sql`).
4.  **Inspect the SQL Script:** Review the generated `.sql` file (e.g., `prisma/add_ai_bypass_fields.sql`) to ensure it contains the expected `ALTER TABLE`, `CREATE TABLE`, etc. statements.
5.  **Execute the SQL Script:** Apply the changes directly to the database:
    ```bash
    docker-compose exec backend npx prisma db execute --file prisma/<descriptive_migration_name>.sql --schema=prisma/schema.prisma
    ```
6.  **Manually Mark Migration as Applied:** Since `db execute` doesn't update Prisma's migration history table, you need to tell Prisma that these changes correspond to a migration entry.
    *   **Important:** You first need to create a corresponding migration *folder* locally so Prisma can track it. Run `migrate dev` with `--create-only`:
        ```bash
        # Use the SAME name as your .sql file/intended migration
        docker-compose exec backend npx prisma migrate dev --name <descriptive_migration_name> --create-only
        ```
        This will create `prisma/migrations/TIMESTAMP_<descriptive_migration_name>/migration.sql` (the SQL content might be empty or reflect the diff again, which is okay).
    *   Now, resolve the migration, telling Prisma it's applied:
        ```bash
        # Use the FULL timestamped name created by the previous command
        docker-compose exec backend npx prisma migrate resolve --applied TIMESTAMP_<descriptive_migration_name>
        ```
7.  **Verify Status:** Check that Prisma now sees the database as up-to-date:
    ```bash
    docker-compose exec backend npx prisma migrate status
    ```
    It should report that the database schema is in sync.
8.  **Generate Prisma Client:**
    ```bash
    docker-compose exec backend npx prisma generate
    ```

This process manually applies the schema changes and updates Prisma's history tracking without requiring a database reset.
