import { primaryClient } from '../lib/prisma';
// GISGeoPackageService import removed — path was incorrect and not used in this script

async function main() {
  const projectId = 'cmr3b0q2a00f5si6khytg417j';
  // The roads are loaded via GISGeoPackageService. Let's just mock the polygon or use DB.
  // Actually, wait, the AI roads are loaded directly from GeoPackage in memory.
  // We can just query the roads from the DB route's metadata!
  const route = await primaryClient.gISRoute.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' }
  });
  if (!route) return console.log('No route');
  const metadata = route.metadata as any;
  const ways = metadata?.osmData?.ways || [];
  
  let count = 0;
  for (const way of ways) {
    if (way.tags?.name?.includes('Kurunegala') || way.tags?.highway === 'primary' || way.tags?.highway === 'trunk') {
      console.log(`Way ID: ${way.id}, Name: ${way.tags?.name}, Highway: ${way.tags?.highway}, Lanes: ${way.tags?.lanes}`);
      count++;
    }
  }
  console.log(`Found ${count} matching ways.`);
}

main().catch(console.error);
