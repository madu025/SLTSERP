import { prisma } from './src/lib/prisma';
import { GISGeometry } from './src/services/gis/GISGeometry';

async function main() {
  const projectId = 'cmr3b0q2a00f5si6khytg417j';
  const route = await prisma.gISRoute.findFirst({
    where: { projectId, versionType: 'PLANNED' },
    include: {
      poles: true,
      closures: true,
    }
  });

  if (!route) {
    console.error('No route found!');
    return;
  }

  console.log('Poles:');
  for (const p of route.poles) {
    console.log(`Pole P-${p.poleNumber}: ${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
