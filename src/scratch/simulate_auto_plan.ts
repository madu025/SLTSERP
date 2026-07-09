import { primaryClient } from '../lib/prisma';

async function main() {
  const projectId = 'cmr3b0q2a00f5si6khytg417j';
  const routes = await primaryClient.gISRoute.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${routes.length} routes for project:`);
  for (const r of routes) {
    const meta = r.metadata as any;
    console.log(`Route ID: ${r.id}, Name: ${r.name}, versionType: ${r.versionType}, CreatedAt: ${r.createdAt}`);
    console.log(`- polygon coords count: ${meta?.polygon?.length || 0}`);
    console.log(`- boundaryPolygon coords count: ${meta?.boundaryPolygon?.length || 0}`);
    const geojson = r.geojsonData as any;
    const poles = geojson?.features?.filter((f: any) => f.properties?.layer === 'POLE') || [];
    console.log(`- poles count in geojson: ${poles.length}`);
  }
}

main().catch(console.error);
