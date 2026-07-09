import { primaryClient } from '../lib/prisma';

async function main() {
  const projectId = 'cmr3b0q2a00f5si6khytg417j';
  const routes = await primaryClient.gISRoute.findMany({
    where: { projectId, versionType: 'PLANNED' },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Planned routes in DB: ${routes.length}`);
  if (routes.length === 0) return;

  const activeRoute = routes[0];
  console.log(`Active Route: ID = ${activeRoute.id}, Created At = ${activeRoute.createdAt}`);

  const geojson = activeRoute.geojsonData as any;
  const features = geojson?.features || [];

  const closures = features.filter((f: any) => 
    f.properties?.layer === 'FDP' || 
    f.properties?.layer === 'FIBER_JOINT' || 
    f.properties?.layer === 'CLOSURE'
  );

  console.log(`Total closures in GeoJSON: ${closures.length}`);
  for (const c of closures) {
    const coords = c.geometry.coordinates;
    const connectedDrops = features.filter((f: any) => {
      if (f.properties?.layer !== 'CABLE') return false;
      if (f.properties?.cableType !== 'DROP') return false;
      const start = f.geometry.coordinates[0];
      const end = f.geometry.coordinates[1];
      const matchEnd = Math.abs(end[0] - coords[0]) < 0.00001 && Math.abs(end[1] - coords[1]) < 0.00001;
      return matchEnd;
    });

    console.log(`- Layer: ${c.properties.layer}, Number: ${c.properties.closureNumber}, Name: ${c.properties.name}, Notes: ${c.properties.notes}, Connected Drops: ${connectedDrops.length}`);
  }
}

main().catch(console.error);
