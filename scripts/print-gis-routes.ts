import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const routes = await prisma.gISRoute.findMany({
    include: {
      poles: { take: 2 },
      chambers: { take: 2 },
      closures: { take: 2 },
      cableSegments: { take: 2 }
    }
  });

  console.log(`Total Routes: ${routes.length}`);
  for (const r of routes) {
    console.log(`Route ID: ${r.id} | Name: ${r.name}`);
    console.log(`Route Length: ${r.routeLength}`);
    console.log(`GeoJSON Type: ${r.geojsonData ? typeof r.geojsonData : 'null'}`);
    console.log(`GeoJSON keys: ${r.geojsonData ? Object.keys(r.geojsonData as any) : ''}`);
    console.log(`First 2 Poles:`, JSON.stringify(r.poles));
    console.log(`First 2 Cable Segments:`, JSON.stringify(r.cableSegments));
  }
}

main().finally(() => prisma.$disconnect());
