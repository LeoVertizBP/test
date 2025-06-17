import prisma from '../utils/prismaClient';
import { ResolutionMethod, FlagStatus } from '../../generated/prisma/client';

async function revertAllAutoProcessedFlags() {
  console.log('Starting script to revert all auto-processed flags...');

  const targetResolutionMethods: ResolutionMethod[] = [
    ResolutionMethod.AI_AUTO_REMEDIATE,
    ResolutionMethod.AI_AUTO_CLOSE,
  ];

  try {
    const flagsToRevert = await prisma.flags.findMany({
      where: {
        resolution_method: {
          in: targetResolutionMethods,
        },
      },
      select: {
        id: true,
      },
    });

    if (flagsToRevert.length === 0) {
      console.log('No flags found with AI_AUTO_REMEDIATE or AI_AUTO_CLOSE resolution methods. No action taken.');
      return;
    }

    console.log(`Found ${flagsToRevert.length} flags to revert.`);

    const flagIdsToRevert = flagsToRevert.map(flag => flag.id);

    const updateResult = await prisma.flags.updateMany({
      where: {
        id: {
          in: flagIdsToRevert,
        },
      },
      data: {
        status: FlagStatus.PENDING,
        resolution_method: null,
        reviewed_at: null,
        decision_made_at: null,
        // Any other fields that should be reset can be added here
      },
    });

    console.log(`Successfully reverted ${updateResult.count} flags to PENDING status and cleared resolution details.`);

  } catch (error) {
    console.error('Error during script execution:', error);
    process.exitCode = 1; // Indicate an error
  } finally {
    await prisma.$disconnect();
    console.log('Script finished.');
  }
}

// Execute the main function
revertAllAutoProcessedFlags();
