import { scan_job_product_focus as ScanJobProductFocus, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

/**
 * Links a scan job to a specific product focus.
 * Creates an entry in the scan_job_product_focus join table.
 * @param scanJobId - The UUID of the scan job.
 * @param productId - The UUID of the product to focus on.
 * @returns The newly created scan_job_product_focus link entry.
 */
export const linkScanJobToProductFocus = async (scanJobId: string, productId: string): Promise<ScanJobProductFocus> => {
    // Basic validation
    if (!scanJobId || !productId) {
        throw new Error("Scan Job ID and Product ID are required to link.");
    }

    // Use upsert to handle potential duplicate links gracefully or create if not exists
    return prisma.scan_job_product_focus.upsert({
        where: {
            scan_job_id_product_id: { // Use the @@unique constraint name from the schema
                scan_job_id: scanJobId,
                product_id: productId,
            }
        },
        update: {}, // No fields to update on conflict
        create: {
            scan_job_id: scanJobId,
            product_id: productId,
        },
    });
};

/**
 * Unlinks a scan job from a product focus.
 * Deletes the entry from the scan_job_product_focus join table.
 * @param scanJobId - The UUID of the scan job.
 * @param productId - The UUID of the product.
 * @returns The result of the delete operation (count of deleted records).
 */
export const unlinkScanJobFromProductFocus = async (scanJobId: string, productId: string): Promise<Prisma.BatchPayload> => {
    // Basic validation
    if (!scanJobId || !productId) {
        throw new Error("Scan Job ID and Product ID are required to unlink.");
    }

    return prisma.scan_job_product_focus.deleteMany({
        where: {
            scan_job_id: scanJobId,
            product_id: productId,
        },
    });
};

/**
 * Retrieves all product focuses linked to a specific scan job.
 * @param scanJobId - The UUID of the scan job.
 * @returns An array of product objects linked to the scan job for focus.
 */
export const getProductFocusByScanJobId = async (scanJobId: string): Promise<Prisma.productsGetPayload<{}>[]> => {
    const links = await prisma.scan_job_product_focus.findMany({
        where: { scan_job_id: scanJobId },
        include: { products: true }, // Include the related product data
    });
    return links.map(link => link.products);
};

/**
 * Retrieves all scan jobs linked to a specific product focus.
 * @param productId - The UUID of the product.
 * @returns An array of scan job objects linked to the product focus.
 */
export const getScanJobsByProductFocusId = async (productId: string): Promise<Prisma.scan_jobsGetPayload<{}>[]> => {
    const links = await prisma.scan_job_product_focus.findMany({
        where: { product_id: productId },
        include: { scan_jobs: true }, // Include the related scan job data
    });
    return links.map(link => link.scan_jobs);
};


// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
