/**
 * Overpass API Service
 * Fetches geospatial data from OpenStreetMap's Overpass API for intelligent OSP route planning.
 * 
 * Data Categories:
 * - Highways: Road centerlines for path snapping
 * - Buildings: Obstacle avoidance
 * - Waterways/Bridges: River crossing awareness, bridge-only crossings
 * - Restricted Areas: Forests, national parks, military zones (conditional avoidance)
 * - Utility Poles: Power/utility poles (ABSOLUTE AVOIDANCE - blacklisted)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface OverpassBounds {
  /** South latitude */
  south: number;
  /** West longitude */
  west: number;
  /** North latitude */
  north: number;
  /** East longitude */
  east: number;
}

export interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export interface OverpassWay {
  type: 'way';
  id: number;
  nodes: number[];
  geometry?: { lat: number; lon: number }[];
  tags: Record<string, string>;
}

export type OverpassElement = OverpassNode | OverpassWay;

export interface OverpassResponse {
  version: number;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
    copyright: string;
  };
  elements: OverpassElement[];
}

export interface GeoFeatures {
  /** Road centerlines for pathfinding (lat, lon pairs) */
  highways: GeoLineString[];
  /** Building polygons - absolute obstacles */
  buildings: GeoPolygon[];
  /** Waterways - river/canal linestrings */
  waterways: GeoLineString[];
  /** Bridges - crossing points */
  bridges: GeoLineString[];
  /** Utility/Power poles - BLACKLISTED (no routing through these) */
  utilityPoles: GeoPoint[];
  /** Restricted areas (forests, military, national parks) - conditional avoidance */
  restrictedAreas: GeoPolygon[];
}

export interface GeoPoint {
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export interface GeoLineString {
  coordinates: { lat: number; lon: number }[];
  tags: Record<string, string>;
}

export interface GeoPolygon {
  coordinates: { lat: number; lon: number }[];
  tags: Record<string, string>;
}

export class OverpassAPIService {
  private static readonly ENDPOINT = 'https://overpass-api.de/api/interpreter';

  /**
   * Builds an Overpass QL query to fetch all required geospatial data for a bounding box.
   */
  private static buildQuery(bounds: OverpassBounds): string {
    const bboxStr = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
    
    return `[out:json][timeout:25];
(
  // 1. Highways - Roads for path planning
  way["highway"](${bboxStr});
  way["highway"="service"](${bboxStr});
  
  // 2. Buildings - Obstacle avoidance
  way["building"](${bboxStr});
  relation["building"](${bboxStr});
  
  // 3. Waterways - Rivers and canals
  way["waterway"](${bboxStr});
  way["natural"="water"](${bboxStr});
  
  // 4. Bridges - Crossing infrastructure
  way["bridge"="yes"](${bboxStr});
  way["bridge"="viaduct"](${bboxStr});
  way["man_made"="bridge"](${bboxStr});
  
  // 5. Railways - High-cost crossing zones
  way["railway"="rail"](${bboxStr});
  way["railway"="light_rail"](${bboxStr});
  way["railway"="subway"](${bboxStr});
  
  // 6. Utility/Power Poles - BLACKLISTED nodes (absolute avoidance)
  node["power"="pole"](${bboxStr});
  node["power"="tower"](${bboxStr});
  node["man_made"="utility_pole"](${bboxStr});
  
  // 7. Restricted Areas & Forests - Conditional avoidance
  way["landuse"="forest"](${bboxStr});
  way["boundary"="national_park"](${bboxStr});
  way["military"="danger_area"](${bboxStr});
  relation["landuse"="forest"](${bboxStr});
  relation["boundary"="national_park"](${bboxStr});
  relation["military"="danger_area"](${bboxStr});
);

// Fetch full geometries
out body;
>;
out skel qt;`;
  }

  /**
   * Fetches geospatial features from Overpass API for the given bounding box.
   */
  static async fetchFeatures(bounds: OverpassBounds): Promise<GeoFeatures> {
    const query = this.buildQuery(bounds);
    
    // MD5 hash of query to uniquely identify bounding box and features requested
    const hash = crypto.createHash('md5').update(query).digest('hex');
    const cacheDir = path.join(process.cwd(), 'src/cache/osm');
    const cachePath = path.join(cacheDir, `${hash}.json`);

    // 1. Check local file cache first
    try {
      if (fs.existsSync(cachePath)) {
        console.log(`[OverpassAPI] Loading cached features from local storage: ${cachePath} (Hash: ${hash})`);
        const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as OverpassResponse;
        return this.processResponse(cachedData);
      }
    } catch (e) {
      console.warn('[OverpassAPI] Cache read failed (falling back to live fetch):', e);
    }
    
    console.log(`[OverpassAPI] Cache miss. Fetching live features from Overpass API for bounds: ${JSON.stringify(bounds)}`);
    
    try {
      const response = await fetch(this.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      let data: OverpassResponse;

      if (!response.ok) {
        // Overpass sometimes returns 429 for rate limiting or 504 for timeouts
        if (response.status === 429) {
          console.warn('[OverpassAPI] Live endpoint rate limited. Waiting 3s before retry...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          const retryResponse = await fetch(this.ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ data: query }).toString(),
            signal: AbortSignal.timeout(30000),
          });
          if (!retryResponse.ok) {
            throw new Error(`Overpass API error after retry: ${retryResponse.status}`);
          }
          data = await retryResponse.json();
        } else {
          throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
        }
      } else {
        data = await response.json();
      }

      // 2. Save raw response data to local file cache
      try {
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
        fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[OverpassAPI] Live data saved to local file cache: ${cachePath}`);
      } catch (e) {
        console.warn('[OverpassAPI] Failed to write cache:', e);
      }

      return this.processResponse(data);
    } catch (error) {
      console.error('[OverpassAPI] Live fetch failed:', error);
      // Return empty features on failure - don't block the user
      return {
        highways: [],
        buildings: [],
        waterways: [],
        bridges: [],
        utilityPoles: [],
        restrictedAreas: [],
      };
    }
  }

  /**
   * Processes raw Overpass API response into structured geo-features.
   */
  private static processResponse(data: OverpassResponse): GeoFeatures {
    const features: GeoFeatures = {
      highways: [],
      buildings: [],
      waterways: [],
      bridges: [],
      utilityPoles: [],
      restrictedAreas: [],
    };

    // First pass: collect all nodes with their coordinates
    const nodeCoords = new Map<number, { lat: number; lon: number }>();
    for (const el of data.elements) {
      if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
        nodeCoords.set(el.id, { lat: el.lat, lon: el.lon });
      }
    }

    // Second pass: process ways and nodes
    for (const el of data.elements) {
      if (el.type === 'node') {
        const node = el as OverpassNode;
        const tags = node.tags || {};

        // Utility/Power poles - BLACKLISTED
        if (tags.power === 'pole' || tags.power === 'tower' || tags.man_made === 'utility_pole') {
          features.utilityPoles.push({
            lat: node.lat,
            lon: node.lon,
            tags,
          });
        }
      }

      if (el.type === 'way') {
        const way = el as OverpassWay;
        const tags = way.tags || {};
        const coords = (way.nodes || [])
          .map(nid => nodeCoords.get(nid))
          .filter((c): c is { lat: number; lon: number } => c !== undefined);

        if (coords.length < 2) continue;

        const lineString: GeoLineString = { coordinates: coords, tags };

        // Categorize by tags
        if (tags.highway) {
          features.highways.push(lineString);
        }
        if (tags.building) {
          features.buildings.push(lineString);
        }
        if (tags.waterway || tags.natural === 'water') {
          features.waterways.push(lineString);
        }
        if (tags.bridge === 'yes' || tags.bridge === 'viaduct' || tags.man_made === 'bridge') {
          features.bridges.push(lineString);
        }
        if (
          tags.landuse === 'forest' ||
          tags.boundary === 'national_park' ||
          tags.military === 'danger_area'
        ) {
          features.restrictedAreas.push(lineString);
        }
      }
    }

    console.log(`[OverpassAPI] Processed: ${features.highways.length} highways, ${features.buildings.length} buildings, ${features.waterways.length} waterways, ${features.bridges.length} bridges, ${features.utilityPoles.length} utility poles (BLACKLISTED), ${features.restrictedAreas.length} restricted areas`);
    
    return features;
  }
}