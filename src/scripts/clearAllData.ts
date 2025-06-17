// src/scripts/clearAllData.ts
import prisma from '../utils/prismaClient'; // Import shared prisma client

async function main() {
  console.log('Starting comprehensive data deletion process...');

  // Deleting in an order that attempts to respect dependencies.
  // Many of these might be cascade-deleted by scan_jobs, but explicit deletion is safer.

  console.log('Deleting all Flag Comments...');
  const deletedFlagComments = await prisma.flag_comments.deleteMany({});
  console.log(`Deleted ${deletedFlagComments.count} flag comments.`);

  console.log('Deleting all Scan Job Runs...');
  const deletedScanJobRuns = await prisma.scan_job_runs.deleteMany({});
  console.log(`Deleted ${deletedScanJobRuns.count} scan job runs.`);

  console.log('Deleting all Scan Job Channels...');
  const deletedScanJobChannels = await prisma.scan_job_channels.deleteMany({});
  console.log(`Deleted ${deletedScanJobChannels.count} scan job channels.`);

  console.log('Deleting all Scan Job Product Focus entries...');
  const deletedScanJobProductFocus = await prisma.scan_job_product_focus.deleteMany({});
  console.log(`Deleted ${deletedScanJobProductFocus.count} scan job product focus entries.`);

  console.log('Deleting all Scan Job Publishers...');
  const deletedScanJobPublishers = await prisma.scan_job_publishers.deleteMany({});
  console.log(`Deleted ${deletedScanJobPublishers.count} scan job publishers.`);

  console.log('Deleting all Flags...');
  const deletedFlags = await prisma.flags.deleteMany({});
  console.log(`Deleted ${deletedFlags.count} flags.`);

  console.log('Deleting all Content Images...');
  const deletedContentImages = await prisma.content_images.deleteMany({});
  console.log(`Deleted ${deletedContentImages.count} content images.`);

  console.log('Deleting all Content Items...');
  const deletedContentItems = await prisma.content_items.deleteMany({});
  console.log(`Deleted ${deletedContentItems.count} content items.`);

  // Deleting Scan Jobs might be redundant for some items above if cascades worked,
  // but ensures complete cleanup of the scan_jobs table itself.
  console.log('Deleting all Scan Jobs...');
  const deletedScanJobs = await prisma.scan_jobs.deleteMany({});
  console.log(`Deleted ${deletedScanJobs.count} scan jobs.`);

  console.log('Deleting all Audit Logs...');
  const deletedAuditLogs = await prisma.audit_logs.deleteMany({});
  console.log(`Deleted ${deletedAuditLogs.count} audit logs.`);

  console.log('Deleting all AI Usage Logs...');
  const deletedAiUsageLogs = await prisma.ai_usage_logs.deleteMany({});
  console.log(`Deleted ${deletedAiUsageLogs.count} AI usage logs.`);

  console.log('Comprehensive data deletion process completed.');
}

main()
  .catch((e) => {
    console.error('Error during data deletion:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
