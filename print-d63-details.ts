import { prisma } from './src/lib/prisma';
import { GISGeometry } from './src/services/gis/GISGeometry';

async function main() {
  const projectId = 'cmr3b0q2a00f5si6khytg417j';
  const route = await prisma.gISRoute.findFirst({
    where: { projectId, versionType: 'PLANNED' },
    include: {
      cableSegments: true,
      closures: true,
    }
  });

  if (!route) {
    console.error('No route found!');
    return;
  }

  const cab = route.cableSegments.find(c => c.segmentNumber === 63);
  if (!cab) {
    console.error('Cable 63 not found!');
    return;
  }

  const props = cab.properties as { coordinates?: [number, number][] } | null;
  const coords = props?.coordinates || [];

  console.log(`Cable 63 (${cab.cableType}): Start: ${coords[0][1]}, ${coords[0][0]} | End: ${coords[coords.length-1][1]}, ${coords[coords.length-1][0]}`);

  // Find closest closure to start
  const startC = route.closures.find(c => 
    GISGeometry.getDistanceMeters(c.latitude, c.longitude, coords[0][1], coords[0][0]) < 1.0
  );
  console.log(`Starts at Closure: ${startC?.closureNumber} (${startC?.notes})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
