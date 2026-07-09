import { prisma } from '@/lib/prisma';
import { OSMNode, OSMWay } from './types';

export class GISGeoPackageService {
  /**
   * Returns OSMNodes and OSMWays for AI roads that intersect the given polygon bounding box from PostgreSQL.
   */
  public static async getRoadsInBoundingBox(polygon: [number, number][]): Promise<{ nodes: Map<number, OSMNode>, ways: OSMWay[] }> {
    const nodes = new Map<number, OSMNode>();
    const ways: OSMWay[] = [];
    
    // Synthetic IDs to avoid colliding with OSM node/way IDs
    let syntheticNodeId = -100000000;
    let syntheticWayId = -200000000;

    // 1. Calculate polygon bounding box
    let polyMinLat = 90, polyMaxLat = -90, polyMinLon = 180, polyMaxLon = -180;
    for (const [lon, lat] of polygon) {
      if (lat < polyMinLat) polyMinLat = lat;
      if (lat > polyMaxLat) polyMaxLat = lat;
      if (lon < polyMinLon) polyMinLon = lon;
      if (lon > polyMaxLon) polyMaxLon = lon;
    }

    // Expand bounding box slightly (by ~2km) to catch roads that span across the border
    const padding = 0.018; // approx 2km in degrees
    polyMinLat -= padding;
    polyMaxLat += padding;
    polyMinLon -= padding;
    polyMaxLon += padding;

    try {
      // 2. Query only roads that intersect the bounding box (database index accelerated)
      const roads = await prisma.gISRoadData.findMany({
        where: {
          minLat: { lte: polyMaxLat },
          maxLat: { gte: polyMinLat },
          minLon: { lte: polyMaxLon },
          maxLon: { gte: polyMinLon }
        },
        select: {
          fid: true,
          wkt: true
        }
      });

      // 3. Process the filtered intersecting roads
      for (const road of roads) {
        if (!road.wkt || !road.wkt.startsWith('LINESTRING')) continue;

        // Parse WKT LINESTRING (...) coordinates
        const content = road.wkt.substring(road.wkt.indexOf('(') + 1, road.wkt.indexOf(')'));
        const pairs = content.split(', ');
        
        const wayNodes: number[] = [];
        
        for (const pair of pairs) {
          const [lonStr, latStr] = pair.split(' ');
          const lon = parseFloat(lonStr);
          const lat = parseFloat(latStr);
          
          const nId = syntheticNodeId--;
          nodes.set(nId, { id: nId, lat, lon });
          wayNodes.push(nId);
        }
        
        ways.push({
          id: syntheticWayId--,
          nodes: wayNodes,
          tags: { highway: 'residential', source: 'mapwithai' } // Treat AI roads as residential
        });
      }

      console.log(`[GISGeoPackageService] Extracted ${ways.length} AI roads intersecting target polygon.`);
    } catch (err) {
      console.error('[GISGeoPackageService] Failed to load roads from database. Returning empty.', err);
    }

    return { nodes, ways };
  }
}
