import { FlagStatus, HumanVerdict } from '@prisma/client'; // Use alias for types
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prismaClient'; // Import shared prisma client

// Types for filter parameters
export interface DashboardFilterParams {
  startDate?: Date;
  endDate?: Date;
  publisherId?: string;
  productId?: string;
  advertiserId?: string;
}

// Types for dashboard metrics (matching frontend expectations)
export interface FlagStats {
  total: number;
  pending: number;
  inReview: number;
  remediating: number;
  closed: number;
  trend: {
    date: string;
    count: number;
  }[];
}

export interface ViolationStats {
  total: number;
  byPublisher: {
    publisher: string;
    count: number;
    percentage: number;
  }[];
  byProduct: {
    product: string;
    count: number;
    percentage: number;
  }[];
  bySeverity: {
    severity: string;
    count: number;
    percentage: number;
  }[];
  trend: {
    date: string;
    count: number;
  }[];
}

export interface AIStats {
  totalAnalyzed: number;
  averageConfidence: number;
  confidenceDistribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  agreementRate: number;
  disagreementRate: number;
  feedbackCount: number;
}

export interface ProcessingMetrics {
  averageProcessingTime: number;
  itemsProcessed: {
    date: string;
    count: number;
  }[];
  queueLength: number;
  processingByContentType: {
    contentType: string;
    averageTime: number;
    count: number;
  }[];
}

export interface ComplianceOverview {
  publishers: {
    name: string;
    totalItems: number;
    flaggedItems: number;
    violationRate: number;
    trend: number; // positive for increasing compliance, negative for decreasing
    avgRemediationTimeHours: number; // NEW: Average time from remediation start to close
    remediationTrend: number; // NEW: Trend in remediation time (positive means improving/faster)
  }[];
}

export interface AIConfidenceData {
  byRule: {
    rule: string;
    averageConfidence: number;
    sampleSize: number;
  }[];
  byPublisher: {
    publisher: string;
    averageConfidence: number;
    sampleSize: number;
  }[];
  byContentType: {
    contentType: string;
    averageConfidence: number;
    sampleSize: number;
  }[];
}

export interface AIBypassAnalysisData {
  humanAiAgreementRate: number;
  flagsAboveThresholdPercentage: number;
  totalFlagsConsideredForAgreement: number;
  totalFlagsAboveThreshold: number;
  totalProjectFlags: number;
}

/**
 * Helper to add organization filter to all queries
 * @param organizationId The organization ID to filter by
 */
const getOrganizationFilter = async (organizationId: string) => {
  console.log('Getting organization filter for organization ID:', organizationId);
  let publishers: { id: string, name: string }[] = [];
  let advertisers: { id: string, name: string }[] = [];

  try {
    // Get all publisher IDs belonging to the organization
    publishers = await prisma.publishers.findMany({
      where: { organization_id: organizationId },
      select: { id: true, name: true }
    });
    console.log('Found publishers for organization:', publishers);
  } catch (error) {
    console.error(`Error fetching publishers for organization ${organizationId}:`, error);
    // Proceed with empty publishers array
  }
  
  try {
    // Get all advertiser IDs belonging to the organization
    advertisers = await prisma.advertisers.findMany({
      where: { organization_id: organizationId },
      select: { id: true, name: true }
    });
    console.log('Found advertisers for organization:', advertisers);
  } catch (error) {
    console.error(`Error fetching advertisers for organization ${organizationId}:`, error);
    // Proceed with empty advertisers array
  }
  
  // Create arrays of IDs for filtering
  const publisherIds = publishers.map(p => p.id);
  const advertiserIds = advertisers.map(a => a.id);
  
  // If no publishers found, log a warning
  if (publisherIds.length === 0) {
    console.warn('No publishers found for organization ID:', organizationId);
  }
  
  return { publisherIds, advertiserIds };
};

/**
 * Helper function to safely create an SQL parameter for an array of IDs
 * @param ids Array of IDs
 * @returns A SQL-safe string or default placeholder
 */
const createIdListParam = (ids: string[]): string[] => {
  if (!ids || ids.length === 0) {
    return ['00000000-0000-0000-0000-000000000000']; // Use a placeholder UUID
  }
  return ids;
};

/**
 * Helper to format an array of IDs into a SQL-friendly string
 * with proper UUID casting
 * @param ids Array of IDs
 * @returns A comma-separated string of IDs with UUID casting
 */
const formatIdsForQuery = (ids: string[]): string => {
  if (!ids || ids.length === 0) {
    return "'00000000-0000-0000-0000-000000000000'::uuid";
  }
  
  // Format each ID with UUID casting and join with commas
  return ids.map(id => `'${id}'::uuid`).join(',');
};

/**
 * Get flag statistics for an organization
 * @param organizationId The organization ID
 * @param filters Optional filters for date range, publisher, etc.
 * @returns Flag statistics
 */
export const getFlagStatsByOrganization = async (
  organizationId: string,
  filters?: DashboardFilterParams
): Promise<FlagStats> => {
  try {
    console.log('=== FLAG STATS QUERY ===');
    console.log('Organization ID:', organizationId);
  console.log('Filters:', JSON.stringify(filters, null, 2));
  
  // Get total flags in the database (regardless of filters)
  const totalFlagsInDb = await prisma.flags.count();
  console.log('Total flags in database (no filters):', totalFlagsInDb);
  
  // Get organization filter
  let publisherIds: string[] = [];
  try {
    const orgFilter = await getOrganizationFilter(organizationId);
    publisherIds = orgFilter.publisherIds;
    console.log('Publisher IDs for organization:', publisherIds);
  } catch (error) {
    console.error('Error getting organization filter:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`Failed to get organization filter: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Early return if no publishers found for organization
  if (publisherIds.length === 0) {
    console.log('No publishers found for organization, returning empty stats');
    return {
      total: 0,
      pending: 0,
      inReview: 0,
      remediating: 0,
      closed: 0,
      trend: []
    };
  }
  
  // Base where clause for all queries
  const baseWhere: any = {
    content_items: {
      publisher_id: { in: publisherIds }
    }
  };
  
  // Add date filters if provided
  if (filters?.startDate) {
    // Ensure startDate is a Date object with time set to start of day (00:00:00)
    let startDate: Date;
    
    if (typeof filters.startDate === 'string') {
      // Parse the date string and set time to 00:00:00 local time
      startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = filters.startDate;
      // Ensure time is set to beginning of day
      startDate.setHours(0, 0, 0, 0);
    }
    
    console.log('Using startDate filter:', { 
      original: filters.startDate,
      parsed: startDate,
      isoString: startDate.toISOString(),
      sqlFormatted: startDate.toISOString().split('T')[0] + 'T00:00:00.000Z'
    });
    
    // Use the ISO string format for consistent timezone handling
    baseWhere.created_at = { gte: startDate };
  }
  
  if (filters?.endDate) {
    // Ensure endDate is a Date object with time set to end of day (23:59:59.999)
    let endDate: Date;
    
    if (typeof filters.endDate === 'string') {
      // Parse the date string and set time to 23:59:59.999 local time
      endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = filters.endDate;
      // Ensure time is set to end of day
      endDate.setHours(23, 59, 59, 999);
    }
    
    console.log('Using endDate filter:', { 
      original: filters.endDate,
      parsed: endDate,
      isoString: endDate.toISOString(),
      sqlFormatted: endDate.toISOString().split('T')[0] + 'T23:59:59.999Z'
    });
    
    if (baseWhere.created_at) {
      baseWhere.created_at.lte = endDate;
    } else {
      baseWhere.created_at = { lte: endDate };
    }
  }
  
  // Add publisher filter if provided
  if (filters?.publisherId) {
    baseWhere.content_items.publisher_id = filters.publisherId;
  }
  
  // Add product filter if provided
  if (filters?.productId) {
    baseWhere.product_id = { equals: filters.productId };
  }
  
  // Log the base where clause for debugging
  console.log('Flag stats base where clause:', JSON.stringify(baseWhere, null, 2));
  
  // Count total flags
  const total = await prisma.flags.count({
    where: baseWhere
  });
  console.log('Total flags count:', total);
  
  // Count flags by status
  const pending = await prisma.flags.count({
    where: {
      ...baseWhere,
      status: FlagStatus.PENDING
    }
  });
  console.log('Pending flags count:', pending);
  
  const inReview = await prisma.flags.count({
    where: {
      ...baseWhere,
      status: FlagStatus.IN_REVIEW
    }
  });
  console.log('In review flags count:', inReview);
  
  const remediating = await prisma.flags.count({
    where: {
      ...baseWhere,
      status: FlagStatus.REMEDIATING
    }
  });
  console.log('Remediating flags count:', remediating);
  
  const closed = await prisma.flags.count({
    where: {
      ...baseWhere,
      status: FlagStatus.CLOSED
    }
  });
  console.log('Closed flags count:', closed);
  
  // Get trend data (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let trend: { date: string; count: number }[] = [];
  
  try {
    console.log('Executing flag trend query with params:', {
      thirtyDaysAgo: thirtyDaysAgo.toISOString(),
      publisherIds: publisherIds,
      publisherIdsLength: publisherIds.length
    });
    
    // Fetch daily counts for the last 30 days - Pass publisherIds array directly
    const dailyCounts = await prisma.$queryRaw<{ date: Date, count: bigint }[]>`
      SELECT
        DATE_TRUNC('day', created_at)::date as date, -- Cast to date for consistent output
        COUNT(*) as count
      FROM flags
      WHERE created_at >= ${thirtyDaysAgo}
      AND content_item_id IN ( -- Filter directly on content_item_id's publisher
        SELECT id FROM content_items
        WHERE publisher_id = ANY (${publisherIds}::uuid[]) -- Use ANY with UUID array parameter
      )
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date ASC
    `;

    console.log('Flag trend query result:', dailyCounts);

    // Format trend data
    trend = dailyCounts.map(day => ({
      date: day.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
      count: Number(day.count) // count is bigint, convert to number
    }));
  } catch (error) {
    console.error('Error fetching flag trend data:', error);
    console.error('Error type:', error?.constructor?.name);
    console.error('Error details:', JSON.stringify(error, null, 2));
    // Return empty trend array on error
    trend = [];
  }
  
  return {
    total,
    pending,
    inReview,
    remediating,
    closed,
    trend
  };
} catch (error) {
  console.error(`Error in getFlagStatsByOrganization for organization ${organizationId}:`, error);
  // Return default/empty stats in case of any unexpected error
  return {
    total: 0,
    pending: 0,
    inReview: 0,
    remediating: 0,
    closed: 0,
    trend: []
  };
}
};

/**
 * Get AI bypass analysis data for an organization based on a given threshold.
 * @param organizationId The organization ID.
 * @param threshold The AI confidence threshold (0-100).
 * @returns AI bypass analysis data.
 */
export const getAIBypassAnalysisData = async (
  organizationId: string,
  threshold: number,
): Promise<AIBypassAnalysisData> => {
  const { publisherIds } = await getOrganizationFilter(organizationId);
  if (publisherIds.length === 0) {
    // No publishers, so no flags to analyze
    return {
      humanAiAgreementRate: 0,
      flagsAboveThresholdPercentage: 0,
      totalFlagsConsideredForAgreement: 0,
      totalFlagsAboveThreshold: 0,
      totalProjectFlags: 0,
    };
  }

  const dbThreshold = new Decimal(threshold / 100);

  // 1. Total project flags for the organization
  const totalProjectFlags = await prisma.flags.count({
    where: {
      content_items: {
        publisher_id: { in: publisherIds },
      },
    },
  });

  if (totalProjectFlags === 0) {
    return {
      humanAiAgreementRate: 0,
      flagsAboveThresholdPercentage: 0,
      totalFlagsConsideredForAgreement: 0,
      totalFlagsAboveThreshold: 0,
      totalProjectFlags: 0,
    };
  }

  // 2. Total flags above the given threshold
  const totalFlagsAboveThreshold = await prisma.flags.count({
    where: {
      content_items: {
        publisher_id: { in: publisherIds },
      },
      ai_confidence: { gt: dbThreshold },
    },
  });

  // 3. Flags to be considered for agreement rate
  // (above threshold, and have both human and AI verdicts)
  const flagsForAgreementConsideration = await prisma.flags.findMany({
    where: {
      content_items: {
        publisher_id: { in: publisherIds },
      },
      ai_confidence: { gt: dbThreshold },
      human_verdict: { not: null },
      ai_ruling: { not: null },
    },
    select: {
      human_verdict: true,
      ai_ruling: true,
    },
  });

  const totalFlagsConsideredForAgreement = flagsForAgreementConsideration.length;
  let agreedFlagsCount = 0;

  if (totalFlagsConsideredForAgreement > 0) {
    flagsForAgreementConsideration.forEach(flag => {
      const aiRuling = flag.ai_ruling?.toLowerCase() ?? '';
      // Assuming human_verdict is one of 'VIOLATION', 'COMPLIANT', 'ERROR'
      const humanVerdictIsViolation = flag.human_verdict === HumanVerdict.VIOLATION;
      const aiRulingIsViolation = aiRuling.includes('violation');

      if (humanVerdictIsViolation === aiRulingIsViolation) {
        agreedFlagsCount++;
      }
    });
  }

  // 4. Calculate rates
  const humanAiAgreementRate =
    totalFlagsConsideredForAgreement > 0
      ? (agreedFlagsCount / totalFlagsConsideredForAgreement) * 100
      : 0;

  const flagsAboveThresholdPercentage =
    totalProjectFlags > 0
      ? (totalFlagsAboveThreshold / totalProjectFlags) * 100
      : 0;

  return {
    humanAiAgreementRate: parseFloat(humanAiAgreementRate.toFixed(1)),
    flagsAboveThresholdPercentage: parseFloat(flagsAboveThresholdPercentage.toFixed(1)),
    totalFlagsConsideredForAgreement,
    totalFlagsAboveThreshold,
    totalProjectFlags,
  };
};
/**
 * Get violation statistics for an organization
 * @param organizationId The organization ID
 * @param filters Optional filters for date range, publisher, etc.
 * @returns Violation statistics
 */
export const getViolationStatsByOrganization = async (
  organizationId: string,
  filters?: DashboardFilterParams
): Promise<ViolationStats> => {
  try {
    // Get organization filter
    const { publisherIds } = await getOrganizationFilter(organizationId);
  
  // Early return if no publishers found for organization
  if (publisherIds.length === 0) {
    console.log('No publishers found for organization, returning empty violation stats');
    return {
      total: 0,
      byPublisher: [],
      byProduct: [],
      bySeverity: [],
      trend: []
    };
  }
  
  // Base where clause for all queries - count both human-confirmed and AI-detected violations
  // We use mutually exclusive conditions to avoid double counting
  const baseWhere: any = {
    content_items: {
      publisher_id: { in: publisherIds }
    },
    OR: [
      { human_verdict: HumanVerdict.VIOLATION }, // Human-confirmed violations
      { 
        ai_ruling: { contains: 'violation', mode: 'insensitive' },
        human_verdict: null // Only include AI violations that haven't been human-reviewed yet
      }
    ]
  };
  
  // Add date filters if provided
  if (filters?.startDate) {
    // Ensure startDate is a Date object with time set to start of day (00:00:00)
    let startDate: Date;
    
    if (typeof filters.startDate === 'string') {
      // Parse the date string and set time to 00:00:00 local time
      startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = filters.startDate;
      // Ensure time is set to beginning of day
      startDate.setHours(0, 0, 0, 0);
    }
    
    console.log('Using startDate filter for violations:', { 
      original: filters.startDate,
      parsed: startDate,
      isoString: startDate.toISOString(),
      sqlFormatted: startDate.toISOString().split('T')[0] + 'T00:00:00.000Z'
    });
    
    // Use the ISO string format for consistent timezone handling
    baseWhere.created_at = { gte: startDate };
  }
  
  if (filters?.endDate) {
    // Ensure endDate is a Date object with time set to end of day (23:59:59.999)
    let endDate: Date;
    
    if (typeof filters.endDate === 'string') {
      // Parse the date string and set time to 23:59:59.999 local time
      endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = filters.endDate;
      // Ensure time is set to end of day
      endDate.setHours(23, 59, 59, 999);
    }
    
    console.log('Using endDate filter for violations:', { 
      original: filters.endDate,
      parsed: endDate,
      isoString: endDate.toISOString(),
      sqlFormatted: endDate.toISOString().split('T')[0] + 'T23:59:59.999Z'
    });
    
    if (baseWhere.created_at) {
      baseWhere.created_at.lte = endDate;
    } else {
      baseWhere.created_at = { lte: endDate };
    }
  }
  
  // Add publisher filter if provided
  if (filters?.publisherId) {
    baseWhere.content_items.publisher_id = filters.publisherId;
  }
  
  // Add product filter if provided
  if (filters?.productId) {
    baseWhere.product_id = { equals: filters.productId };
  }
  
  // Count total violations
  const total = await prisma.flags.count({
    where: baseWhere
  });
  
  // If there are no violations, return early with empty data
  if (total === 0) {
    return {
      total: 0,
      byPublisher: [],
      byProduct: [],
      bySeverity: [],
      trend: []
    };
  }
  
  // Get violations by publisher - using raw query instead of groupBy for nested relations
  
  // Get publisher names
  const publisherInfo = await prisma.publishers.findMany({
    where: { id: { in: publisherIds } },
    select: { id: true, name: true }
  });
  
  // Map publisher IDs to names
  const publisherMap = publisherInfo.reduce((map, pub) => {
    map[pub.id] = pub.name;
    return map;
  }, {} as Record<string, string>);
  
  // Format publisher IDs for query
  // Format publisher violation data - Pass publisherIds array directly
  let byPublisherRaw: { publisher_id: string, publisher_name: string, count: bigint }[] = [];
  
  try {
    byPublisherRaw = await prisma.$queryRaw<{ publisher_id: string, publisher_name: string, count: bigint }[]>`
      SELECT
        ci.publisher_id,
        p.name as publisher_name,
        COUNT(*) as count
      FROM flags f
      JOIN content_items ci ON f.content_item_id = ci.id
      JOIN publishers p ON ci.publisher_id = p.id
      WHERE (f.human_verdict = 'VIOLATION'
             OR (f.ai_ruling ILIKE '%violation%' AND f.human_verdict IS NULL))
      AND ci.publisher_id = ANY (${publisherIds}::uuid[]) -- Use ANY with UUID array parameter
      GROUP BY ci.publisher_id, p.name
      ORDER BY count DESC
    `;
  } catch (error) {
    console.error('Error fetching violations by publisher:', error);
    // Continue with empty array
    byPublisherRaw = [];
  }
  
  // Get violations by product
  const productViolations = await prisma.flags.groupBy({
    by: ['product_id'],
    where: baseWhere,
    _count: { id: true }
  });
  
  // Get product names
  const productIds = productViolations
    .map(pv => pv.product_id)
    .filter((id): id is string => id !== null);
  
  // If we have product IDs, look them up
  let productInfo: { id: string; name: string }[] = [];
  if (productIds.length > 0) {
    productInfo = await prisma.products.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true }
    });
  }
  
  // Map product IDs to names
  const productMap = productInfo.reduce((map, prod) => {
    map[prod.id] = prod.name;
    return map;
  }, {} as Record<string, string>);

  // Format product violation data - Pass publisherIds array directly
  let byProductRaw: { product_id: string, product_name: string, count: bigint }[] = [];
  
  try {
    byProductRaw = await prisma.$queryRaw<{ product_id: string, product_name: string, count: bigint }[]>`
      SELECT
        f.product_id,
        p.name as product_name,
        COUNT(*) as count
      FROM flags f
      JOIN products p ON f.product_id = p.id
      JOIN content_items ci ON f.content_item_id = ci.id
      WHERE (f.human_verdict = 'VIOLATION'
             OR (f.ai_ruling ILIKE '%violation%' AND f.human_verdict IS NULL))
      AND ci.publisher_id = ANY (${publisherIds}::uuid[]) -- Use ANY with UUID array parameter
      AND f.product_id IS NOT NULL
      GROUP BY f.product_id, p.name
      ORDER BY count DESC
    `;
  } catch (error) {
    console.error('Error fetching violations by product:', error);
    // Continue with empty array
    byProductRaw = [];
  }
  
  // We're removing the severity section as requested
  const bySeverity: { severity: string; count: number; percentage: number }[] = [];
  
  // Get trend data (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  let trend: { date: string; count: number }[] = [];
  
  try {
    // Fetch daily violation counts for the last 30 days - Pass publisherIds array directly
    const violationTrendCounts = await prisma.$queryRaw<{ date: Date, count: bigint }[]>`
      SELECT
        DATE_TRUNC('day', created_at)::date as date, -- Cast to date
        COUNT(*) as count
      FROM flags
      WHERE created_at >= ${thirtyDaysAgo}
      AND (human_verdict = 'VIOLATION'
           OR (ai_ruling ILIKE '%violation%' AND human_verdict IS NULL))
      AND content_item_id IN ( -- Filter directly on content_item_id's publisher
        SELECT id FROM content_items
        WHERE publisher_id = ANY (${publisherIds}::uuid[]) -- Use ANY with UUID array parameter
      )
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date ASC
    `;

    // Format trend data
    trend = violationTrendCounts.map(day => ({
      date: day.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
      count: Number(day.count) // count is bigint
    }));
  } catch (error) {
    console.error('Error fetching violation trend data:', error);
    // Return empty trend array on error
    trend = [];
  }
  
  // Calculate total from byPublisher breakdown to ensure consistency
  const publisherTotal = byPublisherRaw.reduce((sum, p) => sum + Number(p.count), 0);
  
  // Log the counts for debugging
  console.log('Original total count:', total);
  console.log('Sum of byPublisher counts:', publisherTotal);
  console.log('byPublisher data:', byPublisherRaw);
  
  // Use the publisher total as the actual total to ensure consistency
  const actualTotal = publisherTotal || total; // Use original total if publisherTotal is 0
  
  // Format final response
  return {
    total: actualTotal, // Use the calculated total from byPublisher
    byPublisher: byPublisherRaw.map(p => ({
      publisher: p.publisher_name,
      count: Number(p.count),
      percentage: actualTotal > 0 ? Math.round((Number(p.count) / actualTotal) * 100) : 0
    })),
    byProduct: byProductRaw.map(p => ({
      product: p.product_name,
      count: Number(p.count),
      percentage: actualTotal > 0 ? Math.round((Number(p.count) / actualTotal) * 100) : 0
    })),
    bySeverity, // Now an empty array
    trend
  };
} catch (error) {
  console.error(`Error in getViolationStatsByOrganization for organization ${organizationId}:`, error);
  // Return default/empty stats in case of any unexpected error
  return {
    total: 0,
    byPublisher: [],
    byProduct: [],
    bySeverity: [],
    trend: []
  };
}
};

/**
 * Get AI statistics for an organization
 * @param organizationId The organization ID
 * @param filters Optional filters for date range, publisher, etc.
 * @returns AI statistics
 */
export const getAIStatsByOrganization = async (
  organizationId: string,
  filters?: DashboardFilterParams
): Promise<AIStats> => {
  // Get organization filter
  const { publisherIds } = await getOrganizationFilter(organizationId);
  
  // Early return if no publishers found for organization
  if (publisherIds.length === 0) {
    console.log('No publishers found for organization, returning empty AI stats');
    return {
      totalAnalyzed: 0,
      averageConfidence: 0,
      confidenceDistribution: [
        { range: '0-20%', count: 0, percentage: 0 },
        { range: '20-40%', count: 0, percentage: 0 },
        { range: '40-60%', count: 0, percentage: 0 },
        { range: '60-80%', count: 0, percentage: 0 },
        { range: '80-100%', count: 0, percentage: 0 }
      ],
      agreementRate: 0,
      disagreementRate: 0,
      feedbackCount: 0
    };
  }
  
  // Base where clause for all queries
  const baseWhere: any = {
    content_items: {
      publisher_id: { in: publisherIds }
    },
    // Only include flags that have both AI and human verdicts for comparison
    ai_ruling: { not: null }, // Correct syntax: Use 'not' instead of 'isNot'
    human_verdict: { not: null } // Correct syntax: Use 'not' instead of 'isNot'
  };
  
  // Add date filters if provided
  if (filters?.startDate) {
    // Ensure startDate is a Date object with time set to start of day (00:00:00)
    let startDate: Date;
    
    if (typeof filters.startDate === 'string') {
      // Parse the date string and set time to 00:00:00 local time
      startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = filters.startDate;
      // Ensure time is set to beginning of day
      startDate.setHours(0, 0, 0, 0);
    }
    
    console.log('Using startDate filter for AI stats:', { 
      original: filters.startDate,
      parsed: startDate,
      isoString: startDate.toISOString(),
      sqlFormatted: startDate.toISOString().split('T')[0] + 'T00:00:00.000Z'
    });
    
    // Use the ISO string format for consistent timezone handling
    baseWhere.created_at = { gte: startDate };
  }
  
  if (filters?.endDate) {
    // Ensure endDate is a Date object with time set to end of day (23:59:59.999)
    let endDate: Date;
    
    if (typeof filters.endDate === 'string') {
      // Parse the date string and set time to 23:59:59.999 local time
      endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = filters.endDate;
      // Ensure time is set to end of day
      endDate.setHours(23, 59, 59, 999);
    }
    
    console.log('Using endDate filter for AI stats:', { 
      original: filters.endDate,
      parsed: endDate,
      isoString: endDate.toISOString(),
      sqlFormatted: endDate.toISOString().split('T')[0] + 'T23:59:59.999Z'
    });
    
    if (baseWhere.created_at) {
      baseWhere.created_at.lte = endDate;
    } else {
      baseWhere.created_at = { lte: endDate };
    }
  }
  
  // Add publisher filter if provided
  if (filters?.publisherId) {
    baseWhere.content_items.publisher_id = filters.publisherId;
  }
  
  // Add product filter if provided
  if (filters?.productId) {
    baseWhere.product_id = { equals: filters.productId };
  }
  
  // Count total AI analyzed flags - Pass publisherIds array directly
  const totalAnalyzedResult = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM flags f
    JOIN content_items ci ON f.content_item_id = ci.id
    WHERE ci.publisher_id = ANY (${publisherIds}::uuid[]) -- Use ANY with UUID array parameter
    AND f.ai_ruling IS NOT NULL
  `;

  const totalAnalyzed = Number(totalAnalyzedResult[0].count); // count is bigint

  // Get average confidence - Pass publisherIds array directly
  const confidenceAvgResult = await prisma.$queryRaw<[{ avg_confidence: Decimal | null }]>`
    SELECT AVG(ai_confidence) as avg_confidence
    FROM flags f
    JOIN content_items ci ON f.content_item_id = ci.id
    WHERE ci.publisher_id = ANY (${publisherIds}::uuid[]) -- Use ANY with UUID array parameter
    AND f.ai_confidence IS NOT NULL
  `;

  const avgConfidence = confidenceAvgResult[0].avg_confidence; // avg_confidence is Decimal | null
  console.log('Raw average confidence from DB:', avgConfidence);
  
  const averageConfidence = avgConfidence !== null
    ? avgConfidence.toNumber() * 100 // Convert Decimal to number and then percentage
    : 0;
  
  console.log('Formatted average confidence (after * 100):', averageConfidence);

  // Get AI confidence distribution
  // We'll create confidence ranges for the histogram
  const confidenceRanges = [
    { min: 0, max: 0.2, label: '0-20%' },
    { min: 0.2, max: 0.4, label: '20-40%' },
    { min: 0.4, max: 0.6, label: '40-60%' },
    { min: 0.6, max: 0.8, label: '60-80%' },
    { min: 0.8, max: 1, label: '80-100%' }
  ];
  
  // Get distribution
  // Handle null values and range filters separately to avoid TypeScript errors
  const distribution = await Promise.all(
    confidenceRanges.map(async range => {
      const minValue = new Decimal(range.min);
      const maxValue = new Decimal(range.max);
      
      // Use raw SQL to handle the filtering properly - Pass publisherIds array directly
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM flags f
        JOIN content_items ci ON f.content_item_id = ci.id
        WHERE ci.publisher_id = ANY (${publisherIds}::uuid[]) -- Use ANY with UUID array parameter
        AND f.ai_confidence IS NOT NULL
        AND f.ai_confidence >= ${minValue}
        AND f.ai_confidence < ${maxValue}
      `;

      const count = Number(result[0].count); // count is bigint

      return {
        range: range.label,
        count,
        percentage: totalAnalyzed > 0 ? Math.round((count / totalAnalyzed) * 100) : 0
      };
    })
  );
  
  // Calculate agreement rate
  // Get flags with both AI and human verdicts for comparison, regardless of status
  const flagsWithBothVerdicts = await prisma.flags.findMany({
    where: {
      content_items: {
        publisher_id: { in: publisherIds }
      },
      ai_ruling: { not: null },
      human_verdict: { not: null }
      // No status filter, so all statuses will be included
    },
    select: {
      ai_ruling: true,
      human_verdict: true,
      status: true // Include status to verify what's being returned
    }
  });
  
  console.log(`Found ${flagsWithBothVerdicts.length} flags with both AI and human verdicts`);
  
  let agreementCount = 0;
  
  // Count agreements with improved comparison and logging
  flagsWithBothVerdicts.forEach(flag => {
    const aiVerdict = flag.ai_ruling?.toLowerCase() ?? '';
    const humanVerdict = flag.human_verdict?.toLowerCase() ?? '';
    
    // Improved comparison logic - normalize both to check for "violation"
    const aiDetectedViolation = aiVerdict.includes('violation');
    const humanConfirmedViolation = humanVerdict.includes('violation');
    
    const isAgreement = aiDetectedViolation === humanConfirmedViolation;
    if (isAgreement) {
      agreementCount++;
    }
    
    // Log each comparison for debugging
    console.log(`Flag status: ${flag.status}, AI: ${aiVerdict}, Human: ${humanVerdict}, Agreement: ${isAgreement}`);
  });
  
  const totalComparisons = flagsWithBothVerdicts.length;
  console.log(`Agreement count: ${agreementCount} out of ${totalComparisons}`);
  
  const agreementRate = totalComparisons > 0 
    ? (agreementCount / totalComparisons) * 100
    : 0;
  
  const disagreementRate = 100 - agreementRate;
  
  // Count human reviews (where human verdict exists)
  const feedbackCount = await prisma.flags.count({
    where: {
      content_items: {
        publisher_id: { in: publisherIds }
      },
      human_verdict: { not: null }
    }
  });
  
  return {
    totalAnalyzed,
    averageConfidence,
    confidenceDistribution: distribution,
    agreementRate,
    disagreementRate,
    feedbackCount
  };
};

/**
 * Get content processing metrics for an organization
 * @param organizationId The organization ID
 * @param filters Optional filters for date range, publisher, etc.
 * @returns Processing metrics
 */
export const getProcessingMetricsByOrganization = async (
  organizationId: string,
  filters?: DashboardFilterParams
): Promise<ProcessingMetrics> => {
  // Get organization filter
  const { publisherIds } = await getOrganizationFilter(organizationId);
  
  // Get processing time data from AI usage logs
  const logs = await prisma.ai_usage_logs.findMany({
    where: {
      // We need to find a way to join with content or filter by organization
      // For now, we'll return all logs and assume they're all for this org
      timestamp: {
        ...(filters?.startDate && { gte: filters.startDate }),
        ...(filters?.endDate && { lte: filters.endDate })
      }
    },
    orderBy: {
      timestamp: 'asc'
    }
  });
  
  // Calculate average processing time from latency_ms field
  let totalLatency = 0;
  let count = 0;
  
  logs.forEach(log => {
    if (log.latency_ms !== null) {
      totalLatency += log.latency_ms;
      count++;
    }
  });
  
  const averageProcessingTime = count > 0 ? Math.round(totalLatency / count) : 0;
  
  // Get daily processing counts for trend data
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Group logs by day
  const processingByDay = await prisma.$queryRaw<{ date: string, count: string }[]>`
    SELECT 
      DATE_TRUNC('day', timestamp) as date,
      COUNT(*) as count
    FROM ai_usage_logs
    WHERE timestamp >= ${thirtyDaysAgo}
    GROUP BY DATE_TRUNC('day', timestamp)
    ORDER BY date ASC
  `;
  
  const itemsProcessed = processingByDay.map(day => ({
    date: day.date.split('T')[0],
    count: parseInt(day.count, 10)
  }));
  
  // Get processing time by content type
  // This would require a join with content_items, which we don't have directly on ai_usage_logs
  // For now, we'll create mock data based on the metrics strategy
  const processingByContentType = [
    { contentType: 'Instagram image', averageTime: 1200, count: 432 },
    { contentType: 'Instagram video', averageTime: 3500, count: 287 },
    { contentType: 'TikTok video', averageTime: 4200, count: 195 },
    { contentType: 'YouTube video', averageTime: 8500, count: 134 }
  ];
  
  // Get current queue length (pending content items)
  const queueLength = await prisma.content_items.count({
    where: {
      publisher_id: { in: publisherIds },
      flags: { none: {} } // No flags yet, meaning not processed
    }
  });
  
  return {
    averageProcessingTime,
    itemsProcessed,
    queueLength,
    processingByContentType
  };
};

/**
 * Get publisher compliance overview for an organization
 * @param organizationId The organization ID
 * @param filters Optional filters for date range, publisher, etc.
 * @returns Compliance overview
 */
export const getComplianceOverviewByOrganization = async (
  organizationId: string,
  filters?: DashboardFilterParams
): Promise<ComplianceOverview> => {
  try {
    // Get organization filter
    const { publisherIds } = await getOrganizationFilter(organizationId);
  
  // Get all publishers for this organization
  const publishersData = await prisma.publishers.findMany({
    where: { 
      organization_id: organizationId,
      ...(filters?.publisherId && { id: filters.publisherId })
    },
    select: {
      id: true,
      name: true
    }
  });
  
  const publishers = await Promise.all(
    publishersData.map(async publisher => {
      // Count total content items for this publisher
      const totalItems = await prisma.content_items.count({
        where: {
          publisher_id: publisher.id,
          scan_date: {
            ...(filters?.startDate && { gte: filters.startDate }),
            ...(filters?.endDate && { lte: filters.endDate })
          }
        }
      });
      
      // Count flagged content items (with human-verified violations OR AI-detected violations with no human review)
      const flaggedItems = await prisma.content_items.count({
        where: {
          publisher_id: publisher.id,
          scan_date: {
            ...(filters?.startDate && { gte: filters.startDate }),
            ...(filters?.endDate && { lte: filters.endDate })
          },
          flags: {
            some: {
              OR: [
                { human_verdict: HumanVerdict.VIOLATION }, // Human-verified violations
                { 
                  ai_ruling: { contains: 'violation', mode: 'insensitive' },
                  human_verdict: null // AI-detected violations not yet reviewed
                }
              ],
              ...(filters?.productId && { product_id: { equals: filters.productId } })
            }
          }
        }
      });
      
      // Calculate violation rate
      const violationRate = totalItems > 0 ? (flaggedItems / totalItems) * 100 : 0;
      
      // For trend data, we need to compare to previous period
      // Get previous period's violation rate
      const previousPeriodStart = new Date(filters?.startDate || new Date());
      const previousPeriodEnd = new Date(filters?.endDate || new Date());
      const periodLength = (previousPeriodEnd.getTime() - previousPeriodStart.getTime());
      
      previousPeriodStart.setTime(previousPeriodStart.getTime() - periodLength);
      previousPeriodEnd.setTime(previousPeriodEnd.getTime() - periodLength);
      
      const previousTotalItems = await prisma.content_items.count({
        where: {
          publisher_id: publisher.id,
          scan_date: {
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          }
        }
      });
      
      const previousFlaggedItems = await prisma.content_items.count({
        where: {
          publisher_id: publisher.id,
          scan_date: {
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          },
          flags: {
            some: {
              human_verdict: HumanVerdict.VIOLATION,
              ...(filters?.productId && { product_id: { equals: filters.productId } })
            }
          }
        }
      });
      
      const previousViolationRate = previousTotalItems > 0 
        ? (previousFlaggedItems / previousTotalItems) * 100 
        : 0;
      
      // Calculate trend (difference between current and previous violation rates)
      // Positive means improving compliance (lower violation rate)
      const trend = previousViolationRate - violationRate;
      
      // Calculate average remediation time
      const completedRemediations = await prisma.flags.findMany({
        where: {
          content_items: { publisher_id: publisher.id },
          status: FlagStatus.CLOSED,
          remediation_start_time: { not: null },
          remediation_completed_at: { not: null },
          updated_at: {
            ...(filters?.startDate && { gte: filters.startDate }),
            ...(filters?.endDate && { lte: filters.endDate })
          }
        },
        select: {
          remediation_start_time: true,
          remediation_completed_at: true
        }
      });
      
      let avgRemediationTimeHours = 0;
      if (completedRemediations.length > 0) {
        const totalHours = completedRemediations.reduce((sum, flag) => {
          if (flag.remediation_start_time && flag.remediation_completed_at) {
            const remediationHours = 
              (flag.remediation_completed_at.getTime() - flag.remediation_start_time.getTime()) / (1000 * 60 * 60);
            return sum + remediationHours;
          }
          return sum;
        }, 0);
        
        avgRemediationTimeHours = totalHours / completedRemediations.length;
      }
      
      // Calculate remediation time trend
      const previousCompletedRemediations = await prisma.flags.findMany({
        where: {
          content_items: { publisher_id: publisher.id },
          status: FlagStatus.CLOSED,
          remediation_start_time: { not: null },
          remediation_completed_at: { not: null },
          updated_at: {
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          }
        },
        select: {
          remediation_start_time: true,
          remediation_completed_at: true
        }
      });
      
      let previousAvgRemediationTimeHours = 0;
      if (previousCompletedRemediations.length > 0) {
        const totalHours = previousCompletedRemediations.reduce((sum, flag) => {
          if (flag.remediation_start_time && flag.remediation_completed_at) {
            const remediationHours = 
              (flag.remediation_completed_at.getTime() - flag.remediation_start_time.getTime()) / (1000 * 60 * 60);
            return sum + remediationHours;
          }
          return sum;
        }, 0);
        
        previousAvgRemediationTimeHours = totalHours / previousCompletedRemediations.length;
      }
      
      // Calculate remediation trend (positive means improving - shorter time)
      const remediationTrend = previousAvgRemediationTimeHours > 0 && avgRemediationTimeHours > 0
        ? ((previousAvgRemediationTimeHours - avgRemediationTimeHours) / previousAvgRemediationTimeHours) * 100
        : 0;
      
      return {
        name: publisher.name,
        totalItems,
        flaggedItems,
        violationRate: Math.round(violationRate * 10) / 10, // Round to 1 decimal place
        trend: Math.round(trend * 10) / 10, // Round to 1 decimal place
        avgRemediationTimeHours: Math.round(avgRemediationTimeHours * 10) / 10, // Round to 1 decimal place
        remediationTrend: Math.round(remediationTrend * 10) / 10 // Round to 1 decimal place
      };
    })
  );
  
  // Sort by violation rate (worst compliance first)
  publishers.sort((a, b) => b.violationRate - a.violationRate);
  
  return { publishers };
} catch (error) {
  console.error(`Error in getComplianceOverviewByOrganization for organization ${organizationId}:`, error);
  // Return default/empty stats in case of any unexpected error
  return {
    publishers: []
  };
}
};

/**
 * Get AI confidence analysis data for an organization
 * @param organizationId The organization ID
 * @param filters Optional filters for date range, publisher, etc.
 * @returns AI confidence analysis data
 */
export const getAIConfidenceDataByOrganization = async (
  organizationId: string,
  filters?: DashboardFilterParams
): Promise<AIConfidenceData> => {
  // Get organization filter
  const { publisherIds } = await getOrganizationFilter(organizationId);
  
  // Early return if no publishers found for organization
  if (publisherIds.length === 0) {
    console.log('No publishers found for organization, returning empty AI confidence data');
    return {
      byRule: [],
      byPublisher: [],
      byContentType: []
    };
  }
  
  // Base where clause for all queries
  const baseWhere: any = {
    content_items: {
      publisher_id: { in: publisherIds }
    }
  };

  // Add non-null filter for ai_confidence - we'll ignore any flags with null confidence
  baseWhere.ai_confidence = { gte: new Decimal(0) };
  
  // Add date filters if provided
  if (filters?.startDate) {
    // Ensure startDate is a Date object with time set to start of day (00:00:00)
    let startDate: Date;
    
    if (typeof filters.startDate === 'string') {
      // Parse the date string and set time to 00:00:00 local time
      startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = filters.startDate;
      // Ensure time is set to beginning of day
      startDate.setHours(0, 0, 0, 0);
    }
    
    console.log('Using startDate filter for AI confidence data:', { 
      original: filters.startDate,
      parsed: startDate,
      isoString: startDate.toISOString(),
      sqlFormatted: startDate.toISOString().split('T')[0] + 'T00:00:00.000Z'
    });
    
    // Use the ISO string format for consistent timezone handling
    baseWhere.created_at = { gte: startDate };
  }
  
  if (filters?.endDate) {
    // Ensure endDate is a Date object with time set to end of day (23:59:59.999)
    let endDate: Date;
    
    if (typeof filters.endDate === 'string') {
      // Parse the date string and set time to 23:59:59.999 local time
      endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = filters.endDate;
      // Ensure time is set to end of day
      endDate.setHours(23, 59, 59, 999);
    }
    
    console.log('Using endDate filter for AI confidence data:', { 
      original: filters.endDate,
      parsed: endDate,
      isoString: endDate.toISOString(),
      sqlFormatted: endDate.toISOString().split('T')[0] + 'T23:59:59.999Z'
    });
    
    if (baseWhere.created_at) {
      baseWhere.created_at.lte = endDate;
    } else {
      baseWhere.created_at = { lte: endDate };
    }
  }
  
  // Add publisher filter if provided
  if (filters?.publisherId) {
    baseWhere.content_items.publisher_id = filters.publisherId;
  }
  
  // Add product filter if provided
  if (filters?.productId) {
    baseWhere.product_id = { equals: filters.productId };
  }
  
  // Get AI confidence by rule
  // Group flags by rule_id
  const flags = await prisma.flags.findMany({
    where: baseWhere,
    select: {
      rule_id: true,
      rule_type: true,
      ai_confidence: true
    }
  });
  
  // Group by rule and calculate average confidence
  const ruleMap: Record<string, { sum: number, count: number, rule: string }> = {};
  
  flags.forEach(flag => {
    const ruleKey = flag.rule_id;
    if (!ruleMap[ruleKey]) {
      ruleMap[ruleKey] = { 
        sum: 0, 
        count: 0, 
        rule: `${flag.rule_type} Rule ${flag.rule_id.substring(0, 8)}...` 
      };
    }
    
    const confidence = Number(flag.ai_confidence);
    ruleMap[ruleKey].sum += confidence;
    ruleMap[ruleKey].count += 1;
  });
  
  const byRule = Object.values(ruleMap)
    .map(data => ({
      rule: data.rule,
      averageConfidence: data.count > 0 ? Math.round((data.sum / data.count) * 100) : 0, // Convert to percentage
      sampleSize: data.count
    }))
    .sort((a, b) => b.sampleSize - a.sampleSize) // Sort by sample size descending
    .slice(0, 10); // Top 10 rules by sample size
  
  // Mock data for publisher confidence data
  const byPublisher = [
    { publisher: 'PublisherA', averageConfidence: 87, sampleSize: 245 },
    { publisher: 'PublisherB', averageConfidence: 76, sampleSize: 198 },
    { publisher: 'PublisherC', averageConfidence: 82, sampleSize: 156 }
  ];
  
  // Mock data for content type confidence
  const byContentType = [
    { contentType: 'Instagram image', averageConfidence: 92, sampleSize: 432 },
    { contentType: 'Instagram video', averageConfidence: 83, sampleSize: 287 },
    { contentType: 'TikTok video', averageConfidence: 78, sampleSize: 195 },
    { contentType: 'YouTube video', averageConfidence: 85, sampleSize: 134 }
  ];
  
  return {
    byRule,
    byPublisher,
    byContentType
  };
};
