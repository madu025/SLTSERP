import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    orderBy: { startDate: 'desc' },
    take: 5,
  });
  console.log("Recent Projects in Database:");
  for (const p of projects) {
    console.log(`Code: ${p.projectCode} | ID: ${p.id} | GIS Mapping:`, JSON.stringify(p.gisMapping));
  }
}

main().finally(() => prisma.$disconnect());
