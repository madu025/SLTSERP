import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.qFieldCloudSyncLog.findMany({
    orderBy: { startedAt: 'desc' },
    take: 5
  });
  console.log("Sync Logs:");
  for (const l of logs) {
    console.log(`Sync ID: ${l.id} | Status: ${l.status} | Features: ${l.featuresCount} | Error: ${l.errorMessage}`);
  }
}

main().finally(() => prisma.$disconnect());
