# Database Access (Prisma)

## Overview

Database access in the backend application is managed exclusively through the Prisma ORM. Prisma provides a type-safe client for interacting with the PostgreSQL database based on the schema defined in `prisma/schema.prisma`.

## Prisma Client

*   **Generation:** The Prisma Client is automatically generated based on the `prisma/schema.prisma` file. This typically happens during `npm install` or can be triggered manually via `npx prisma generate`. The generated client code resides in `generated/prisma`.
*   **Instantiation:** A singleton instance of the Prisma Client is typically created and reused throughout the application. This is often done in a utility file (e.g., `src/utils/prismaClient.ts`) to ensure efficient connection management.
    ```typescript
    // Example: src/utils/prismaClient.ts
    import { PrismaClient } from '../../generated/prisma/client';
    const prisma = new PrismaClient();
    export default prisma;
    ```
*   **Usage:** The instantiated `prisma` client is imported into repository files (`src/repositories/`) to perform database operations.

## Repository Pattern

The application uses the repository pattern to encapsulate database query logic.

*   **Structure:** Each major database model (e.g., `users`, `products`, `flags`) has a corresponding repository file (e.g., `userRepository.ts`, `productRepository.ts`, `flagRepository.ts`).
*   **Functionality:** Repositories contain functions that perform specific CRUD (Create, Read, Update, Delete) operations for their associated model using the Prisma Client.
    *   **Example (`flagRepository.ts`):**
        ```typescript
        import prisma from '../utils/prismaClient';
        import { flags, Prisma, FlagStatus, HumanVerdict } from '../../generated/prisma/client';

        // Find flags based on criteria
        export const findFlags = async (where: Prisma.flagsWhereInput): Promise<flags[]> => {
          return prisma.flags.findMany({ where });
        };

        // Update flag status and review details
        export const updateFlagReviewStatus = async (
            flagId: string,
            reviewerId: string,
            data: { /* ... fields like status, human_verdict ... */ }
        ): Promise<flags> => {
          return prisma.flags.update({
            where: { id: flagId },
            data: {
              ...data,
              reviewer_id: reviewerId,
              reviewed_at: new Date(), // Or based on status change
              // Add other timestamp updates as needed (e.g., decision_made_at)
            },
          });
        };
        // ... other functions like createFlag, findFlagById etc.
        ```
*   **Benefits:** This pattern decouples the business logic (in services) from the specific database interaction details, making the code more modular, testable, and easier to maintain. Services call repository methods instead of directly using the `prisma` client.

## Common Prisma Operations

Repositories utilize the Prisma Client's methods, such as:

*   `prisma.modelName.findUnique({ where: { id: '...' } })`: Find a single record by ID or unique field.
*   `prisma.modelName.findMany({ where: { ... }, include: { ... }, select: { ... } })`: Find multiple records matching criteria, optionally including related records or selecting specific fields.
*   `prisma.modelName.create({ data: { ... } })`: Create a new record.
*   `prisma.modelName.update({ where: { id: '...' }, data: { ... } })`: Update an existing record.
*   `prisma.modelName.upsert({ where: { ... }, create: { ... }, update: { ... } })`: Update a record or create it if it doesn't exist.
*   `prisma.modelName.delete({ where: { id: '...' } })`: Delete a record.
*   `prisma.$transaction([...])`: Perform multiple operations within a database transaction.

## Schema Migrations

*   Changes to the database structure are managed through Prisma Migrate.
*   Developers modify `prisma/schema.prisma`.
*   Running `npx prisma migrate dev` creates a new SQL migration file in `prisma/migrations/` and applies the changes to the development database.
*   In staging/production environments, `npx prisma migrate deploy` applies pending migrations.
*   *(Note: The project also uses `node-pg-migrate` (`npm run migrate`), indicating a potential mix of migration strategies or a transition phase. Prisma Migrate is generally the standard approach when using Prisma.)*

## Best Practices

*   **Use Repositories:** Always interact with the database via repository methods from services. Avoid using the `prisma` client directly in services or route handlers.
*   **Type Safety:** Leverage the generated Prisma types for function parameters and return types to ensure data consistency.
*   **Selective Data:** Use `select` or `include` judiciously in `findMany` or `findUnique` calls to fetch only the necessary data, improving performance.
*   **Error Handling:** Repositories should generally let Prisma errors propagate up to the service layer, where they can be handled or mapped to application-specific errors.
*   **Connection Management:** Rely on the singleton Prisma Client instance for connection pooling and management.
