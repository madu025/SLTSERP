const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  console.log("=== PROJECTS ===");
  const projects = await p.project.findMany({ take: 5, select: { id: true, name: true, status: true, projectCode: true } });
  console.log(JSON.stringify(projects, null, 2));

  console.log("\n=== GIS ROUTES ===");
  const routes = await p.gISRoute.findMany({ take: 3, include: { _count: { select: { poles: true, chambers: true, closures: true, cableSegments: true } } } });
  console.log(JSON.stringify(routes, null, 2));

  console.log("\n=== INVENTORY ITEMS ===");
  const items = await p.inventoryItem.count();
  console.log(`Total inventory items: ${items}`);

  await p.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });