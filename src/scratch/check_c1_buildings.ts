import { primaryClient } from '../lib/prisma';

async function main() {
  const routeId = 'cmr8vnf7d0001siboejlz67z9';
  
  const route = await primaryClient.gISRoute.findUnique({ where: { id: routeId } });
  const geojson = route?.geojsonData as any;
  const features = geojson?.features || [];

  const c1 = features.find((f: any) => 
    f.properties?.closureNumber === 1 && (f.properties?.layer === 'FDP' || f.properties?.layer === 'FIBER_JOINT')
  );

  if (!c1) {
    console.log('Closure #1 not found in GeoJSON');
    return;
  }

  console.log('Closure #1 Coordinates:', c1.geometry.coordinates);

  const connectedDrops = features.filter((f: any) => {
    if (f.properties?.layer !== 'CABLE') return false;
    if (f.properties?.cableType !== 'DROP') return false;
    const coords = f.geometry.coordinates;
    const end = coords[1];
    return Math.abs(end[0] - c1.geometry.coordinates[0]) < 0.00001 && 
           Math.abs(end[1] - c1.geometry.coordinates[1]) < 0.00001;
  });

  console.log(`Connected drops to Closure #1 (${connectedDrops.length}):`);
  for (const cab of connectedDrops) {
    const start = cab.geometry.coordinates[0];
    // Find building at start coordinates
    const b = features.find((f: any) => 
      f.properties?.layer === 'BUILDING' && 
      Math.abs(f.geometry.coordinates[0] - start[0]) < 0.00001 &&
      Math.abs(f.geometry.coordinates[1] - start[1]) < 0.00001
    );

    console.log(`  - Cable Index: ${cab.properties.index}, Length: ${cab.properties.length}, Fiber: ${cab.properties.fiberCount}`);
    if (b) {
      console.log(`    * Building Name: ${b.properties.name || 'unnamed'}, isMDU: ${b.properties.isMDU}`);
    } else {
      console.log(`    * Building not found at coords:`, start);
    }
  }
}

main().catch(console.error);
