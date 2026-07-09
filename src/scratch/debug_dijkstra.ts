import { primaryClient } from '../lib/prisma';
import { GISRoadNetwork } from '../services/gis/GISRoadNetwork';
import { GISGeometry } from '../services/gis/GISGeometry';

async function main() {
  const projectId = 'cmr3b0q2a00f5si6khytg417j';
  const existingRoute = await primaryClient.gISRoute.findFirst({
    where: { projectId, versionType: 'PLANNED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!existingRoute) return;
  const metadata = existingRoute.metadata as any;
  const roads = metadata.osmData.roads || [];
  const closures = metadata.closures || [];

  console.log('Total closures:', closures.length);

  // Re-run the snap loop to match GISAutoPlanService.generatePlan
  const snappedClosures = closures.map((closure: any) => {
    const snap = GISRoadNetwork.snapToNearestRoad(closure.latitude, closure.longitude, roads);
    const leftCoord = GISRoadNetwork.getNodeOffsetCoordinate(snap.lon, snap.lat, 'LEFT', roads);
    const rightCoord = GISRoadNetwork.getNodeOffsetCoordinate(snap.lon, snap.lat, 'RIGHT', roads);
    
    const dLeft = GISGeometry.getDistanceMeters(closure.latitude, closure.longitude, leftCoord[1], leftCoord[0]);
    const dRight = GISGeometry.getDistanceMeters(closure.latitude, closure.longitude, rightCoord[1], rightCoord[0]);
    
    let shoulder = dLeft < dRight ? leftCoord : rightCoord;
    const centerlineDist = GISGeometry.getDistanceMeters(shoulder[1], shoulder[0], snap.lat, snap.lon);
    if (centerlineDist < 1.0) {
      shoulder = [shoulder[0] + 0.00003, shoulder[1] + 0.00003];
    }
    return {
      ...closure,
      latitude: shoulder[1],
      longitude: shoulder[0]
    };
  });

  // Find start closure (index 0)
  const startClosure = snappedClosures.find((c: any) => c.index === 0);
  if (!startClosure) {
    console.error('No start closure found!');
    return;
  }

  console.log(`Start closure snapped coord: [${startClosure.longitude}, ${startClosure.latitude}]`);

  for (const dp of snappedClosures) {
    if (dp.index === startClosure.index) continue;
    const res = GISRoadNetwork.dijkstraRoute(startClosure.latitude, startClosure.longitude, dp.latitude, dp.longitude, roads);
    if (res.isFallback) {
      console.log(`FAIL: Dijkstra returned fallback for DP ${dp.index} at [${dp.longitude}, ${dp.latitude}]!`);
    } else {
      console.log(`SUCCESS: Dijkstra found path for DP ${dp.index} with length ${res.pathCoords.length}`);
    }
  }
}

main().catch(console.error);
