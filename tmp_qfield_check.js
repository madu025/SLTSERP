const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  console.log("=== QFIELD SYNC LOGS ===");
  const logs = await p.qFieldCloudSyncLog.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, action: true, createdAt: true, message: true } });
  console.log(JSON.stringify(logs, null, 2));

  console.log("\n=== SURVEY POINTS ===");
  const pts = await p.surveyPoint.count();
  console.log(`Total survey points: ${pts}`);

  console.log("\n=== FIELD TASKS ===");
  const tasks = await p.fieldTask.count();
  console.log(`Total field tasks: ${tasks}`);

  await p.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });