import prisma from './prismaClient'; // Using relative path
import { Prisma } from '../../generated/prisma/client'; // Using relative path
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Define the type for selectable fields more explicitly
type SelectableFields = keyof Prisma.ai_usage_logsSelect;

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('scanJobId', {
            alias: 's',
            type: 'string',
            description: 'Optional: The ID of the ScanJob to check logs for. If omitted, checks all recent logs.',
            // Removed demandOption: true
        })
        .option('contentItemId', {
            alias: 'c',
            type: 'string',
            description: 'Optional: Filter logs by content item ID. Can be specified multiple times for multiple IDs.',
            array: true // This allows --contentItemId id1 --contentItemId id2 or --contentItemId=id1 --contentItemId=id2
        })
        .option('status', {
            type: 'string',
            description: 'Optional: Filter logs by status (e.g., ERROR, SUCCESS)',
        })
        .option('errorMessageContains', {
            alias: 'e',
            type: 'string',
            description: 'Optional: Filter error logs by message content (case-insensitive)',
        })
        .option('limit', {
            alias: 'l',
            type: 'number',
            description: 'Optional: Limit the number of logs returned',
            default: 100, // Default limit
        })
        .option('fields', {
            alias: 'f',
            type: 'string',
            description: 'Optional: Comma-separated list of fields to display (e.g., id,timestamp,status,error_message)',
            default: 'id,timestamp,service_name,action_name,status,error_message,total_tokens,latency_ms,related_context', // Default fields
        })
        .help()
        .alias('help', 'h')
        .argv;

    const { scanJobId, contentItemId, status, errorMessageContains, limit } = argv;
    const fieldsToShow = argv.fields.split(',').map(f => f.trim()).filter(Boolean) as SelectableFields[];

    console.log(`Checking AI usage logs...`);
    if (scanJobId) console.log(`  - Scan Job ID: ${scanJobId}`);
    if (contentItemId && contentItemId.length > 0) console.log(`  - Content Item ID(s): ${contentItemId.join(', ')}`);
    if (status) console.log(`  - Status: ${status}`);
    if (errorMessageContains) console.log(`  - Error Message Contains: "${errorMessageContains}"`);
    console.log(`  - Limit: ${limit}`);
    console.log(`  - Fields: ${fieldsToShow.join(', ')}`);

    try {
        // Build the WHERE clause dynamically
        const whereClause: Prisma.ai_usage_logsWhereInput = {};

        if (status) {
            whereClause.status = status.toUpperCase(); // Ensure status is uppercase if needed by DB schema
        }

        if (errorMessageContains) {
            // Ensure we only apply this filter if status is also ERROR or not specified
            if (!status || status.toUpperCase() === 'ERROR') {
                whereClause.error_message = {
                    contains: errorMessageContains,
                    mode: 'insensitive', // Case-insensitive search
                };
                // If status wasn't explicitly set to ERROR, set it now
                if (!status) {
                    whereClause.status = 'ERROR';
                    console.log(`  - (Implicitly filtering for status: ERROR due to --errorMessageContains)`);
                }
            } else {
                console.warn("Warning: --errorMessageContains is only applied when filtering for ERROR status or when no status is specified. Ignoring this filter.");
            }
        }

        // Handle filtering by scanJobId and/or contentItemId
        let orConditions: Prisma.ai_usage_logsWhereInput[] = [];

        // Add scanJobId filter if provided
        if (scanJobId) {
            const contentItems = await prisma.content_items.findMany({
                where: { scan_job_id: scanJobId },
                select: { id: true }
            });

            if (contentItems.length === 0) {
                console.log(`No content items found for Scan Job ID: ${scanJobId}`);
                await prisma.$disconnect();
                return;
            }
            const contentItemIds = contentItems.map((item: any) => item.id);
            console.log(`  - Found ${contentItemIds.length} content items for this scan job.`);

            // Add conditions for each content item ID from the scan job
            const scanJobConditions = contentItemIds.map((id: any) => ({
                related_context: {
                    path: ['contentItemId'],
                    equals: id as string // Ensure id is treated as string if needed by Prisma JSON filter
                }
            }));
            orConditions = [...orConditions, ...scanJobConditions];
        }

        // Add contentItemId filter if provided
        if (contentItemId && contentItemId.length > 0) {
            // Add conditions for each directly specified content item ID
            const contentItemConditions = contentItemId.map(id => ({
                related_context: {
                    path: ['contentItemId'],
                    equals: id
                }
            }));
            orConditions = [...orConditions, ...contentItemConditions];
        }

        // Apply OR conditions if any were added
        if (orConditions.length > 0) {
            whereClause.OR = orConditions;
        }

        // If both scanJobId and contentItemId are provided, log a note
        if (scanJobId && contentItemId && contentItemId.length > 0) {
            console.log(`  - Note: Both Scan Job ID and Content Item ID(s) provided. Will show logs matching EITHER condition.`);
        }

        // Build the SELECT clause dynamically
        const selectClause: Prisma.ai_usage_logsSelect = {};
        fieldsToShow.forEach(field => {
            // Ensure the field is a valid key before adding
            // This basic check prevents selecting non-existent fields
            // A more robust solution might involve checking against Prisma generated types
            const fieldStr = String(field); // Ensure field is treated as string
            if (fieldStr in Prisma.Ai_usage_logsScalarFieldEnum || ['related_context', 'request_payload', 'response_payload'].includes(fieldStr)) {
                 (selectClause as any)[fieldStr] = true; // Use fieldStr as key
            } else {
                console.warn(`Warning: Field "${fieldStr}" is not a valid ai_usage_logs field. Skipping.`);
            }
        });
         // Ensure 'id' is always selected if not explicitly excluded, useful for reference
        if (!selectClause.id && fieldsToShow.includes('id')) {
             selectClause.id = true;
        }


        // Fetch the logs
        const relevantLogs = await prisma.ai_usage_logs.findMany({
            where: whereClause,
            orderBy: {
                timestamp: 'desc' // Order by most recent first
            },
            take: limit, // Apply the limit
            select: Object.keys(selectClause).length > 0 ? selectClause : undefined, // Only apply select if fields were specified
        });

        if (relevantLogs.length === 0) {
            console.log('\nNo matching AI usage logs found.');
            return;
        }

        console.log(`\nFound ${relevantLogs.length} matching AI usage log entries (showing latest ${limit}):`);

        // Display the selected fields
        relevantLogs.forEach((log: any) => {
            console.log(`\n--- Log Entry ---`);
            fieldsToShow.forEach(field => {
                const fieldStr = String(field); // Ensure field is treated as string
                if (fieldStr in log) {
                    let value = log[fieldStr];
                    // Pretty print JSON fields if they exist and are selected
                    if ((fieldStr === 'related_context' || fieldStr === 'request_payload' || fieldStr === 'response_payload') && value !== null && typeof value === 'object') {
                         try {
                            value = JSON.stringify(value); // Keep it compact for this view
                         } catch (e) {
                            value = "[Unserializable Object]";
                         }
                    } else if (field === 'timestamp' && value instanceof Date) {
                        value = value.toISOString();
                    }
                    console.log(`${String(field)}: ${value ?? 'N/A'}`);
                }
            });
        });

    } catch (error: any) {
        console.error('\nAn error occurred while checking AI usage logs:', error.message || error);
    } finally {
        await prisma.$disconnect();
        console.log('\nDatabase connection closed.');
    }
}

main();
