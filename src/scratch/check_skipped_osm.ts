import { primaryClient } from '../lib/prisma';
import { GISDataExtractor } from '../services/gis/GISDataExtractor';
import { GISGeometry } from '../services/gis/GISGeometry';

async function main() {
  const projectId = 'cmr3b0q2a00f5si6khytg417j';
  const routes = await primaryClient.gISRoute.findMany({
    where: { projectId, versionType: 'PLANNED' },
    orderBy: { createdAt: 'desc' }
  });

  if (routes.length === 0) {
    console.log('No routes found');
    return;
  }

  const route = routes[0];
  const meta = route.metadata as any;
  if (!meta) {
    console.log('No metadata on route');
    return;
  }

  const polygon = meta.polygon;
  const osmData = meta.osmData;

  const { nodes, ways } = GISDataExtractor.parseOverpassElements(osmData);
  const buildings = GISDataExtractor.extractBuildings(nodes, ways);
  const buildingsInside = buildings.filter(b => GISGeometry.isPointInPolygon([b.lon, b.lat], polygon));

  console.log(`Total extracted buildings context-wide: ${buildings.length}`);
  console.log(`Buildings inside project polygon: ${buildingsInside.length}`);

  // Let's print all elements that have tags and are inside the polygon
  console.log('\nAll elements inside polygon with tags:');
  let count = 0;
  for (const el of osmData.elements) {
    if (!el.tags) continue;
    let lat = el.lat;
    let lon = el.lon;
    if (el.type === 'way') {
      // Find average lat/lon of nodes
      let sumLat = 0, sumLon = 0, valid = 0;
      for (const nId of el.nodes || []) {
        const node = nodes.get(nId);
        if (node) {
          sumLat += node.lat;
          sumLon += node.lon;
          valid++;
        }
      }
      if (valid > 0) {
        lat = sumLat / valid;
        lon = sumLon / valid;
      }
    }

    if (lat !== undefined && lon !== undefined) {
      if (GISGeometry.isPointInPolygon([lon, lat], polygon)) {
        count++;
        // Check if this element is present in our extracted buildingsInside
        const extracted = buildingsInside.some(b => {
          if (el.type === 'way') {
            return b.id === el.id || b.id === el.id * 100 + 1 || b.id === el.id * 100 + 2;
          } else {
            return b.id === el.id;
          }
        });
        
        // Also check if it's a road
        const isRoad = el.tags.highway !== undefined;

        console.log(`- Type: ${el.type}, ID: ${el.id}, Tags: ${JSON.stringify(el.tags)}, ExtractedAsBuilding: ${extracted}, IsRoad: ${isRoad}`);
      }
    }
  }

  console.log(`Total elements inside polygon with tags: ${count}`);
}

main().catch(console.error);
