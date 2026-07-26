import { PrismaClient } from '@prisma/client';
import { FixedAssetService } from '../src/services/finance/fixed-asset.service';

const prisma = new PrismaClient();

async function runDepreciation() {
  console.log('🔄 Starting Automated Monthly Fixed Asset Depreciation Cron Job...');
  const now = new Date();
  const year = now.getFullYear();
  // If it's the 1st to 28th, run for current month. Otherwise, usually this runs on the 28th.
  const month = now.getMonth() + 1; 

  try {
    const result = await prisma.$transaction(async (tx) => {
      return await FixedAssetService.runMonthlyDepreciation(tx, year, month, 'system-cron');
    }, { timeout: 30000 });

    console.log(`✅ Depreciation successfully posted for ${year}-${month}.`);
    console.log(`📊 Processed Assets: ${result.logsCount} | Total Amount: LKR ${result.batchDepreciationTotal}`);
  } catch (error: any) {
    console.error('❌ Failed to run automated depreciation:', error.message);
    process.exit(1);
  }
}

runDepreciation()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
