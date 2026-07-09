import { primaryClient } from '../lib/prisma';

async function main() {
  const projectId = 'cmr3b0q2a00f5si6khytg417j';
  const routes = await primaryClient.gISRoute.findMany({
    where: { projectId, versionType: 'PLANNED' },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${routes.length} PLANNED routes in DB.`);
  if (routes.length === 0) return;

  const activeRoute = routes[0];
  console.log(`Active Route ID: ${activeRoute.id}, Created At: ${activeRoute.createdAt}`);

  const geojson = activeRoute.geojsonData as any;
  const features = geojson?.features || [];

  const closures = features.filter((f: any) => 
    f.properties?.layer === 'FDP' || 
    f.properties?.layer === 'FIBER_JOINT' || 
    f.properties?.layer === 'CLOSURE'
  );

  console.log(`Total closures in GeoJSON: ${closures.length}`);
  for (const c of closures) {
    console.log(`- Layer: ${c.properties.layer}, Number: ${c.properties.closureNumber}, Name: ${c.properties.name}, Notes: ${c.properties.notes}`);
  }

  const p2 = features.find((f: any) => 
    f.properties?.closureNumber === 2 || 
    f.properties?.index === 2 || 
    f.properties?.name === 'P-2'
  );

  if (p2) {
    console.log('P-2 is present in GeoJSON!', p2.properties);
    // Find all drops connected to P-2
    const p2Coords = p2.geometry.coordinates;
    const connectedDrops = features.filter((f: any) => {
      if (f.properties?.layer !== 'CABLE') return false;
      if (f.properties?.cableType !== 'DROP') return false;
      const coords = f.geometry.coordinates;
      const end = coords[1];
      return Math.abs(end[0] - p2Coords[0]) < 0.00001 && Math.abs(end[1] - p2Coords[1]) < 0.00001;
    });
    console.log(`Connected drops in GeoJSON: ${connectedDrops.length}`);
  } else {
    console.log('P-2 is NOT present in GeoJSON!');
  }
}

main().catch(console.error);
