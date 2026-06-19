import { PrismaClient } from '@prisma/client';
import { QFieldCloudSyncService } from '../src/services/qfieldcloud-sync.service';

const prisma = new PrismaClient();

async function main() {
  const projectId = 'cmqke3ejx0001siskrlijnbvg'; // E2E-TEST project ID
  const qfieldProjectId = '1735a7c0-5a73-483b-8082-3400c3377b66'; // QFieldCloud project ID

  console.log('Testing Pull/Sync from QFieldCloud to SLTSERP...');

  const service = new QFieldCloudSyncService();
  try {
    const result = await service.pullSurveyPoints(projectId, qfieldProjectId);
    console.log('✅ Sync Completed successfully!');
    console.log('Sync Results:', result);
  } catch (error: any) {
    console.error('❌ Sync failed:', error.message || error);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
