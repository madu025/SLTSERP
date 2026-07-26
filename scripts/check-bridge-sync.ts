import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

let directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
if (directUrl.includes(':5432')) {
  directUrl = directUrl.replace(':5432', ':6543');
}
if (!directUrl.includes('pgbouncer=true')) {
  directUrl += (directUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: directUrl,
    },
  },
});

async function main() {
  const todayStart = new Date('2026-07-26T00:00:00.000Z');
  const todayEnd = new Date('2026-07-26T23:59:59.999Z');

  console.log('=== DETAILED BREAKDOWN OF TODAY\'S (2026-07-26) SOD SYNC / UPDATES ===');

  // Breakdown of SOD creation flags today
  const sodsCreatedToday = await prisma.serviceOrder.findMany({
    where: {
      createdAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    select: {
      soNum: true,
      voiceNumber: true,
      status: true,
      sltsStatus: true,
      isManualEntry: true,
      isLegacyImport: true,
      isOfflineWorkOrder: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const manualCount = sodsCreatedToday.filter(s => s.isManualEntry).length;
  const legacyCount = sodsCreatedToday.filter(s => s.isLegacyImport).length;
  const offlineCount = sodsCreatedToday.filter(s => s.isOfflineWorkOrder).length;
  const autoSyncCount = sodsCreatedToday.filter(s => !s.isManualEntry && !s.isLegacyImport && !s.isOfflineWorkOrder).length;

  console.log(`Total SODs Created Today: ${sodsCreatedToday.length}`);
  console.log(`  - Auto / API / Extension Sync: ${autoSyncCount}`);
  console.log(`  - Manual Entry: ${manualCount}`);
  console.log(`  - Legacy / Bulk Import: ${legacyCount}`);
  console.log(`  - Offline Work Orders: ${offlineCount}`);

  if (autoSyncCount > 0) {
    console.log('\nSample Auto/API Synced SODs Created Today:');
    sodsCreatedToday
      .filter(s => !s.isManualEntry && !s.isLegacyImport && !s.isOfflineWorkOrder)
      .slice(0, 5)
      .forEach(s => {
        console.log(`  - SO: ${s.soNum} | Voice: ${s.voiceNumber || 'N/A'} | Status: ${s.status} | Created: ${s.createdAt.toISOString()}`);
      });
  }
}

main()
  .catch((e) => console.error('EXECUTION ERROR:', e))
  .finally(() => prisma.$disconnect());
