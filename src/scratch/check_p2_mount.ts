import { primaryClient } from '../lib/prisma';

async function main() {
  const routeId = 'cmr8vhjnr0001siv4layfz3b4';
  
  // Find pole with poleNumber = 2
  const pole = await primaryClient.gISPole.findFirst({
    where: { routeId, poleNumber: 2 }
  });

  if (!pole) {
    console.log('Pole P-2 not found');
    return;
  }

  console.log('Pole P-2 properties:', pole);

  // Find any closures at this pole's location
  const closures = await primaryClient.gISClosure.findMany({
    where: { routeId }
  });

  console.log('Closures close to Pole P-2:');
  for (const c of closures) {
    const dist = getDistanceMeters(pole.latitude, pole.longitude, c.latitude, c.longitude);
    if (dist < 1.0) {
      console.log(`- Closure Number: ${c.closureNumber}, Type: ${c.closureType}, Notes: ${c.notes}, Dist: ${dist.toFixed(3)}m`);
      
      // Also get all cables connected to this closure in the GeoJSON!
      const route = await primaryClient.gISRoute.findUnique({ where: { id: routeId } });
      const geojson = route?.geojsonData as any;
      const features = geojson?.features || [];
      const connectedCables = features.filter((f: any) => {
        if (f.properties?.layer !== 'CABLE') return false;
        const coords = f.geometry.coordinates;
        if (coords.length < 2) return false;
        const start = coords[0];
        const end = coords[coords.length - 1];
        const matchStart = Math.abs(start[0] - c.longitude) < 0.00001 && Math.abs(start[1] - c.latitude) < 0.00001;
        const matchEnd = Math.abs(end[0] - c.longitude) < 0.00001 && Math.abs(end[1] - c.latitude) < 0.00001;
        return matchStart || matchEnd;
      });

      console.log(`  Connected cables (${connectedCables.length}):`);
      for (const cab of connectedCables) {
        console.log(`    * Index: ${cab.properties.index}, Type: ${cab.properties.cableType}, Fiber: ${cab.properties.fiberCount}, Length: ${cab.properties.length}`);
      }
    }
  }
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

main().catch(console.error);
