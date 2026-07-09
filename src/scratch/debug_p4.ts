import { primaryClient } from '../lib/prisma';

async function main() {
  const projectId = 'cmr3b0q2a00f5si6khytg417j';
  const existingRoute = await primaryClient.gISRoute.findFirst({
    where: { projectId, versionType: 'PLANNED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!existingRoute) return;
  const metadata = existingRoute.metadata as any;
  const cables = metadata.cables || [];
  console.log('Total cables:', cables.length);
  for (const c of cables) {
    const coords = c.coordinates || [];
    // Check if cable contains P-1 coordinate [80.36706857961239, 7.486825723321555] or P-25 coordinate [80.3633454794006, 7.483345479400607]
    const hasP1 = coords.some((pt: any) => Math.abs(pt[0] - 80.367068579) < 0.0001 && Math.abs(pt[1] - 7.4868257) < 0.0001);
    const hasP25 = coords.some((pt: any) => Math.abs(pt[0] - 80.3633454) < 0.0001 && Math.abs(pt[1] - 7.4833454) < 0.0001);
    if (hasP1 || hasP25) {
      console.log(`Cable ${c.index}: type ${c.cableType}, fiberCount ${c.fiberCount}, len ${c.length.toFixed(1)}m, hasP1: ${hasP1}, hasP25: ${hasP25}, coords length: ${coords.length}`);
      console.log('Coordinates:', coords);
    }
  }
}

main().catch(console.error);
