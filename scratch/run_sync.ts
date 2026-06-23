import { QFieldCloudSyncService } from '../src/services/qfieldcloud-sync.service';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projectId = 'cmqpa22sz0000sik8eos6y9o0';
  const qfieldProjectId = '7a55babe-8909-4554-8dd7-9bc03f7a1b9b';
  
  console.log(`Running pullSurveyPoints for project ${projectId}...`);
  const service = new QFieldCloudSyncService();
  const log = await prisma.qFieldCloudSyncLog.create({
    data: {
      projectId,
      syncType: 'DELTA_SYNC',
      status: 'STARTED',
    }
  });

  try {
    const result = await service.pullSurveyPoints(projectId, qfieldProjectId);
    console.log("Sync Result:", result);
    
    await prisma.qFieldCloudSyncLog.update({
      where: { id: log.id },
      data: {
        status: result.errors.length > 0 ? 'FAILED' : 'COMPLETED',
        featuresCount: result.syncedPoints,
        errorMessage: result.errors.join('; ') || null,
        completedAt: new Date(),
      }
    });
  } catch (err) {
    const error = err as Error;
    console.error("Sync failed:", error);
    await prisma.qFieldCloudSyncLog.update({
      where: { id: log.id },
      data: {
        status: 'FAILED',
        errorMessage: error.message || String(error),
        completedAt: new Date(),
      }
    });
  }
}

main().finally(() => prisma.$disconnect());
