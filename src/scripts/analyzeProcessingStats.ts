import { Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient'; // Import shared prisma client

// Helper function to format milliseconds into seconds or minutes/seconds
function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || isNaN(ms) || ms <= 0) return 'N/A';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(2);
  return `${minutes}m ${remainingSeconds}s`;
}

interface PlatformStats {
  totalMs: number;
  count: number;
}

// For storing token and cost stats
interface PlatformAiTokenCostStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDerivedThinkingTokens: number;
  totalReportedTotalTokens: number;
  totalCost: number;
  aiCallCount: number;
}

// Helper type for scan_job_runs with included publisher_channels platform
type ScanRunWithChannelPlatform = Prisma.scan_job_runsGetPayload<{
  include: {
    publisher_channels: {
      select: { platform: true }
    }
  }
}>;

async function analyzeProcessingStats() {
  console.log('Starting analysis of processing stats per platform...');

  try {
    // --- 1. Calculate Average Scrape Time per Content Item ---
    console.log('\n--- 1. Average Scrape Time per Content Item ---');
    // Fetch runs that are completed/failed
    const scanRuns = await prisma.scan_job_runs.findMany({
      where: {
        status: { notIn: ['STARTED', 'PENDING'] },
        // run_started_at is non-nullable, so no need for 'not: null' filter here
        run_finished_at: { not: null }, // run_finished_at is nullable
      },
      include: {
        publisher_channels: {
          select: { platform: true }
        }
      }
    }) as ScanRunWithChannelPlatform[]; // Cast to the explicit type
    console.log(`  (Fetched ${scanRuns.length} completed scan runs)`);

    // Fetch all content items to link them to runs and count items per run
    const allContentItemsForScrapeTime = await prisma.content_items.findMany({
        select: {
            id: true,
            platform: true, // Keep platform here for direct use if needed, though primarily using run's platform
            scan_job_id: true,
            publisher_channel_id: true,
        }
    });
    console.log(`  (Fetched ${allContentItemsForScrapeTime.length} content items for scrape time analysis)`);

    const itemsByRunLookup = new Map<string, number>(); // Key: "scanJobId_channelId", Value: count
    for (const item of allContentItemsForScrapeTime) {
        const key = `${item.scan_job_id}_${item.publisher_channel_id}`;
        itemsByRunLookup.set(key, (itemsByRunLookup.get(key) || 0) + 1);
    }

    interface PlatformScrapeStats { // Renamed from PlatformScanStats for clarity
        totalDurationMs: number;
        totalItems: number;
        runCount: number;
    }
    const platformScrapeStats: Record<string, PlatformScrapeStats> = {};

    for (const run of scanRuns) {
        if (run.run_started_at && run.run_finished_at && run.publisher_channels?.platform) {
            const platform = run.publisher_channels.platform;
            const durationMs = run.run_finished_at.getTime() - run.run_started_at.getTime();

            if (durationMs > 0) {
                const runKey = `${run.scan_job_id}_${run.publisher_channel_id}`;
                const itemsInRun = itemsByRunLookup.get(runKey) || 0;

                if (itemsInRun > 0) { // Only consider runs that processed items
                    if (!platformScrapeStats[platform]) {
                        platformScrapeStats[platform] = { totalDurationMs: 0, totalItems: 0, runCount: 0 };
                    }
                    platformScrapeStats[platform].totalDurationMs += durationMs;
                    platformScrapeStats[platform].totalItems += itemsInRun;
                    platformScrapeStats[platform].runCount++;
                }
            }
        }
    }

    console.log('\nResults for Average Scrape Time per Content Item:');
    for (const platform in platformScrapeStats) {
        const stats = platformScrapeStats[platform];
        const avgMsPerItem = stats.totalItems > 0 ? stats.totalDurationMs / stats.totalItems : 0;
        console.log(`  ${platform}: ${formatMs(avgMsPerItem)} (Total ${stats.totalItems} items from ${stats.runCount} runs)`);
    }
    if (Object.keys(platformScrapeStats).length === 0) {
        console.log('  No completed scan run data with associated content items found to calculate scrape time averages.');
    }

    // --- 2. Calculate Average Total AI Compute Time, Tokens & Cost per Content Item ---
    console.log('\n--- 2. Average Total AI Compute Time, Tokens & Cost per Content Item ---');

    // Fetch all content items to get their IDs and platforms
    const allContentItemsForAi = await prisma.content_items.findMany({
      select: { id: true, platform: true }
    });
    const contentItemPlatformMap = new Map<string, string>();
    allContentItemsForAi.forEach((item: { id: string; platform: string }) => {
      contentItemPlatformMap.set(item.id, item.platform);
    });
    console.log(`  (Fetched ${contentItemPlatformMap.size} content items for AI analysis mapping)`);

    // Fetch all relevant AI logs
    const allAiLogs = await prisma.ai_usage_logs.findMany({
      where: {
        // Ensure we have latency or tokens/cost to contribute
        OR: [
          { latency_ms: { gt: 0 } },
          { total_tokens: { gt: 0 } },
          { cost: { gt: 0 } }
        ]
        // related_context check is handled in the loop below
      },
      select: {
        latency_ms: true,
        input_tokens: true,
        output_tokens: true,
        total_tokens: true,
        cost: true,
        related_context: true
      }
    });
    console.log(`  (Processing ${allAiLogs.length} AI logs)`);

    // --- Step 2a: Aggregate AI stats per Content Item ---
    interface ContentItemAiTotals {
      platform: string;
      totalLatencyMs: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalDerivedThinkingTokens: number;
      totalReportedTotalTokens: number;
      totalCost: number;
      aiCallCount: number; // Keep track of calls for this item
    }
    const aiTotalsByContentItem = new Map<string, ContentItemAiTotals>();

    for (const log of allAiLogs) {
      let contentItemId: string | null = null;
      try {
        if (log.related_context && typeof log.related_context === 'object') {
          const context = log.related_context as any;
          if (context.contentItemId && typeof context.contentItemId === 'string') {
            contentItemId = context.contentItemId;
          }
        }
      } catch (e) { /* ignore parsing errors */ }

      if (contentItemId) {
        const platform = contentItemPlatformMap.get(contentItemId);
        if (platform) {
          if (!aiTotalsByContentItem.has(contentItemId)) {
            aiTotalsByContentItem.set(contentItemId, {
              platform: platform,
              totalLatencyMs: 0, totalInputTokens: 0, totalOutputTokens: 0,
              totalDerivedThinkingTokens: 0, totalReportedTotalTokens: 0,
              totalCost: 0, aiCallCount: 0,
            });
          }
          const itemTotals = aiTotalsByContentItem.get(contentItemId)!; // Assert non-null as we just set it

          itemTotals.totalLatencyMs += log.latency_ms || 0;
          itemTotals.totalInputTokens += log.input_tokens || 0;
          itemTotals.totalOutputTokens += log.output_tokens || 0;
          itemTotals.totalReportedTotalTokens += log.total_tokens || 0;
          itemTotals.totalDerivedThinkingTokens += (log.total_tokens || 0) - ((log.input_tokens || 0) + (log.output_tokens || 0));
          itemTotals.totalCost += log.cost ? parseFloat(log.cost.toString()) : 0;
          itemTotals.aiCallCount++;
        }
      }
    }
    console.log(`  (Aggregated AI stats for ${aiTotalsByContentItem.size} content items)`);

    // --- Step 2b: Average the per-item totals by Platform ---
    interface PlatformAiAvgStats {
      sumTotalLatencyMs: number;
      sumTotalInputTokens: number;
      sumTotalOutputTokens: number;
      sumTotalDerivedThinkingTokens: number;
      sumTotalReportedTotalTokens: number;
      sumTotalCost: number;
      contentItemCount: number; // Count of items contributing to this platform's average
    }
    const platformAiAvgStats: Record<string, PlatformAiAvgStats> = {};

    for (const itemTotals of aiTotalsByContentItem.values()) {
      const platform = itemTotals.platform;
      if (!platformAiAvgStats[platform]) {
        platformAiAvgStats[platform] = {
          sumTotalLatencyMs: 0, sumTotalInputTokens: 0, sumTotalOutputTokens: 0,
          sumTotalDerivedThinkingTokens: 0, sumTotalReportedTotalTokens: 0,
          sumTotalCost: 0, contentItemCount: 0,
        };
      }
      const platformStats = platformAiAvgStats[platform];
      platformStats.sumTotalLatencyMs += itemTotals.totalLatencyMs;
      platformStats.sumTotalInputTokens += itemTotals.totalInputTokens;
      platformStats.sumTotalOutputTokens += itemTotals.totalOutputTokens;
      platformStats.sumTotalDerivedThinkingTokens += itemTotals.totalDerivedThinkingTokens;
      platformStats.sumTotalReportedTotalTokens += itemTotals.totalReportedTotalTokens;
      platformStats.sumTotalCost += itemTotals.totalCost;
      platformStats.contentItemCount++;
    }

    console.log('\nResults for Average Total AI Stats per Content Item:');
    for (const platform in platformAiAvgStats) {
      const stats = platformAiAvgStats[platform];
      const count = stats.contentItemCount;
      if (count > 0) {
        console.log(`  Platform: ${platform} (Based on ${count} content items with AI logs)`);
        console.log(`    Avg. Total AI Compute Time: ${formatMs(stats.sumTotalLatencyMs / count)}`);
        console.log(`    Avg. Total Input Tokens: ${(stats.sumTotalInputTokens / count).toFixed(0)}`);
        console.log(`    Avg. Total Output Tokens: ${(stats.sumTotalOutputTokens / count).toFixed(0)}`);
        console.log(`    Avg. Total Derived Thinking Tokens: ${(stats.sumTotalDerivedThinkingTokens / count).toFixed(0)}`);
        console.log(`    Avg. Total Reported Tokens: ${(stats.sumTotalReportedTotalTokens / count).toFixed(0)}`);
        console.log(`    Avg. Total Cost: $${(stats.sumTotalCost / count).toFixed(6)}`);
      }
    }
    if (Object.keys(platformAiAvgStats).length === 0) {
        console.log('  No content items with associated AI logs found.');
    }

  } catch (error) {
    console.error('\nError analyzing processing stats:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\nDatabase connection closed.');
  }
}

analyzeProcessingStats();
