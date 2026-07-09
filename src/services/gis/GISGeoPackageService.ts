import Database from 'better-sqlite3';
import path from 'path';
import { OSMNode, OSMWay } from './types';

export class GISGeoPackageService {
  private static db: Database.Database | null = null;
  // In-memory cache for fast spatial lookups since the raw GPKG lacks an explicit RTree table for WKT
  private static cachedRoads: { fid: number, wkt: string, minLat: number, maxLat: number, minLon: number, maxLon: number }[] | null = null;

  private static getDB(): Database.Database {
    if (!this.db) {
      // Path relative to project root
      const dbPath = path.resolve(process.cwd(), 'LK_mapwithai_road_data.gpkg');
      this.db = new Database(dbPath, { readonly: true });
    }
    return this.db;
  }

  private static loadAndCacheAllRoads() {
    if (this.cachedRoads) return;
    
    const db = this.getDB();
    const rows = db.prepare('SELECT fid, wkt FROM LK_mapwithai_road_data WHERE wkt IS NOT NULL').all() as { fid: number, wkt: string }[];
    
    this.cachedRoads = [];
    
    // Very fast pre-parsing to get bounding boxes for each linestring
    for (const row of rows) {
      if (!row.wkt.startsWith('LINESTRING')) continue;
      
      const content = row.wkt.substring(row.wkt.indexOf('(') + 1, row.wkt.indexOf(')'));
      const pairs = content.split(', ');
      
      let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
      
      for (const pair of pairs) {
        const [lonStr, latStr] = pair.split(' ');
        const lon = parseFloat(lonStr);
        const lat = parseFloat(latStr);
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
      }
      
      this.cachedRoads.push({
        fid: row.fid,
        wkt: row.wkt,
        minLat, maxLat, minLon, maxLon
      });
    }
    console.log(`[GISGeoPackageService] Cached ${this.cachedRoads.length} AI road bounding boxes in memory.`);
  }

  /**
   * Returns OSMNodes and OSMWays for AI roads that intersect the given polygon bounding box.
   */
  public static getRoadsInBoundingBox(polygon: [number, number][]): { nodes: Map<number, OSMNode>, ways: OSMWay[] } {
    try {
      this.loadAndCacheAllRoads();
    } catch (err) {
      console.error('[GISGeoPackageService] Failed to load GeoPackage. Returning empty roads.', err);
      return { nodes: new Map(), ways: [] };
    }

    if (!this.cachedRoads) return { nodes: new Map(), ways: [] };

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

    const nodes = new Map<number, OSMNode>();
    const ways: OSMWay[] = [];
    
    // Synthetic IDs to avoid colliding with OSM node/way IDs
    // MapWithAI IDs can be strings in the DB, so we use negative IDs starting from -100M
    let syntheticNodeId = -100000000;
    let syntheticWayId = -200000000;

    // 2. Filter cached roads by bounding box intersection
    for (const road of this.cachedRoads) {
      // Check intersection
      if (
        road.minLat > polyMaxLat || road.maxLat < polyMinLat ||
        road.minLon > polyMaxLon || road.maxLon < polyMinLon
      ) {
        continue;
      }

      // Parse full WKT
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
    return { nodes, ways };
  }
}
