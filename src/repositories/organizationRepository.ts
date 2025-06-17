import { organizations as Organization, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient';

/**
 * Creates a new organization in the database.
 * @param data - The data for the new organization. Requires 'name'.
 * @returns The newly created organization.
 */
export const createOrganization = async (data: Prisma.organizationsCreateInput): Promise<Organization> => {
    // Basic validation: Ensure name is provided
    if (!data.name) {
        throw new Error("Organization name is required.");
    }
    return prisma.organizations.create({
        data: data,
    });
};

/**
 * Retrieves a single organization by its unique ID.
 * @param id - The UUID of the organization to retrieve.
 * @param id - The UUID of the organization to retrieve.
 * @param options - Optional query options (e.g., select specific fields).
 * @returns The organization object (or a partial object based on select) or null if not found.
 */
export const getOrganizationById = async <T extends Prisma.organizationsFindUniqueArgs>(
    id: string,
    options?: Prisma.SelectSubset<T, Prisma.organizationsFindUniqueArgs>
): Promise<Prisma.organizationsGetPayload<T> | null> => {
    const queryOptions: Prisma.organizationsFindUniqueArgs = {
        where: { id: id },
        ...options, // Spread the optional select/include options
    };
    return prisma.organizations.findUnique(queryOptions) as Promise<Prisma.organizationsGetPayload<T> | null>;
};

/**
 * Retrieves all organizations from the database.
 * TODO: Add pagination in the future for large datasets.
 * @returns An array of all organization objects.
 */
export const getAllOrganizations = async (): Promise<Organization[]> => {
    return prisma.organizations.findMany();
};

/**
 * Updates an existing organization.
 * @param id - The UUID of the organization to update.
 * @param id - The UUID of the organization to update.
 * @param data - An object containing the fields to update.
 * @param tx - Optional Prisma transaction client.
 * @returns The updated organization object.
 */
export const updateOrganization = async (
    id: string,
    data: Prisma.organizationsUpdateInput,
    tx?: Prisma.TransactionClient // Accept optional transaction client
): Promise<Organization> => {
    const db = tx || prisma; // Use transaction client if provided, otherwise use global prisma client
    return db.organizations.update({
        where: { id: id },
        data: data,
    });
};

/**
 * Deletes an organization by its unique ID.
 * @param id - The UUID of the organization to delete.
 * @returns The deleted organization object.
 */
export const deleteOrganization = async (id: string): Promise<Organization> => {
    return prisma.organizations.delete({
        where: { id: id },
    });
};

// Optional: Add a function to disconnect Prisma client when the application shuts down
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};

// Example of how you might use these functions (for testing/demonstration)
// async function main() {
//     try {
//         // Example: Create
//         // const newOrg = await createOrganization({ name: 'Test Corp', settings: { theme: 'dark' } });
//         // console.log('Created Org:', newOrg);
//
//         // Example: Get All
//         // const allOrgs = await getAllOrganizations();
//         // console.log('All Orgs:', allOrgs);
//
//         // Example: Get By ID (replace with an actual ID from your DB)
//         // const orgId = 'some-uuid-string';
//         // const singleOrg = await getOrganizationById(orgId);
//         // console.log('Single Org:', singleOrg);
//
//         // Example: Update (replace with an actual ID)
//         // const updatedOrg = await updateOrganization(orgId, { name: 'Test Corp Updated' });
//         // console.log('Updated Org:', updatedOrg);
//
//         // Example: Delete (use with caution!)
//         // const deletedOrg = await deleteOrganization(orgId);
//         // console.log('Deleted Org:', deletedOrg);
//
//     } catch (error) {
//         console.error('Error:', error);
//     } finally {
//         await disconnectPrisma();
//     }
// }
//
// main(); // Uncomment to run example usage
