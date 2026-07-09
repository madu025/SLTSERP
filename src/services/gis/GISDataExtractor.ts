import { OSMNode, OSMWay, Building, RoadSegment } from './types';
import { GISGeometry } from './GISGeometry';

export class GISDataExtractor {
  public static parseOverpassElements(data: unknown) {
    const nodes = new Map<number, OSMNode>();
    const ways: OSMWay[] = [];

    const raw = data as { elements?: { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string> }[] } | null | undefined;
    if (raw && Array.isArray(raw.elements)) {
      for (const el of raw.elements) {
        if (el && el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
          nodes.set(el.id, { id: el.id, lat: el.lat, lon: el.lon, tags: el.tags });
        } else if (el && el.type === 'way') {
          ways.push({
            id: el.id,
            nodes: el.nodes || [],
            tags: el.tags,
          });
        }
      }
    }

    return { nodes, ways };
  }

  public static extractBuildings(nodes: Map<number, OSMNode>, ways: OSMWay[]): Building[] {
    const buildings: Building[] = [];

    const isBusinessNode = (tags?: Record<string, string>): boolean => {
      if (!tags) return false;
      return !!(
        tags.shop ||
        tags.office ||
        tags.amenity ||
        tags.tourism
      );
    };

    const checkIsMDU = (tags?: Record<string, string>): boolean => {
      if (!tags) return false;
      const levels = parseInt(tags['building:levels'] || '1', 10);
      if (levels >= 4) return true;

      const bType = tags.building || '';
      const amenity = tags.amenity || '';
      const office = tags.office || '';
      const shop = tags.shop || '';
      const tourism = tags.tourism || '';

      const mduTypes = ['apartments', 'school', 'hospital', 'commercial', 'office', 'hotel', 'retail', 'public'];
      if (mduTypes.includes(bType)) return true;
      if (['school', 'hospital', 'university', 'bank', 'townhall', 'police', 'government'].includes(amenity)) return true;
      if (['government', 'company', 'educational'].includes(office)) return true;
      if (['supermarket', 'department_store'].includes(shop)) return true;
      if (['hotel'].includes(tourism)) return true;

      return false;
    };

    // 1. First, parse all building polygons (ways)
    const buildingWays: { way: OSMWay; lat: number; lon: number; isMDU: boolean; name: string; polygonCoords: [number, number][] }[] = [];
    
    for (const way of ways) {
      if (way.tags) {
        const isBuildingTag = way.tags.building !== undefined;
        const isBusinessTag = way.tags.shop !== undefined || way.tags.office !== undefined || way.tags.tourism !== undefined;
        const isAmenityTag = way.tags.amenity !== undefined && !['parking', 'parking_space', 'waste_disposal', 'grave_yard', 'bicycle_parking', 'motorcycle_parking'].includes(way.tags.amenity);
        
        if (isBuildingTag || isBusinessTag || isAmenityTag) {
        let sumLat = 0;
        let sumLon = 0;
        let validCount = 0;
        const polygonCoords: [number, number][] = [];

        for (const nodeId of way.nodes) {
          const node = nodes.get(nodeId);
          if (node) {
            sumLat += node.lat;
            sumLon += node.lon;
            validCount++;
            polygonCoords.push([node.lon, node.lat]);
          }
        }

        if (validCount > 0) {
          const lat = sumLat / validCount;
          const lon = sumLon / validCount;
          const isMDU = checkIsMDU(way.tags);
          const name = way.tags.name || way.tags['addr:housename'] || '';

          buildingWays.push({
            way,
            lat,
            lon,
            isMDU,
            name,
            polygonCoords
          });
        }
      }
    }
  }

    // 2. Identify shops/offices inside building polygons
    const waySubCustomers = new Map<number, OSMNode[]>();
    const standaloneNodes: OSMNode[] = [];

    for (const node of nodes.values()) {
      if (node.tags && isBusinessNode(node.tags)) {
        // Find if this node is inside any building way
        let insideWayId: number | null = null;
        for (const bw of buildingWays) {
          if (GISGeometry.isPointInPolygon([node.lon, node.lat], bw.polygonCoords)) {
            insideWayId = bw.way.id;
            break;
          }
        }

        if (insideWayId !== null) {
          if (!waySubCustomers.has(insideWayId)) {
            waySubCustomers.set(insideWayId, []);
          }
          waySubCustomers.get(insideWayId)!.push(node);
        } else {
          standaloneNodes.push(node);
        }
      } else if (node.tags && node.tags.building) {
        // Node tagged as building (point building)
        standaloneNodes.push(node);
      }
    }

    // 3. Construct the final building/customer list
    // A. For each building polygon:
    for (const bw of buildingWays) {
      const subs = waySubCustomers.get(bw.way.id) || [];
      if (subs.length > 1) {
        // Multi-tenant building: Chunk the sub-customers by at most 16 units
        const chunkSize = 16;
        for (let i = 0; i < subs.length; i += chunkSize) {
          const chunk = subs.slice(i, i + chunkSize);
          const chunkNum = Math.floor(i / chunkSize) + 1;
          const totalChunks = Math.ceil(subs.length / chunkSize);
          
          let suffix = ` - Part ${chunkNum}`;
          if (totalChunks === 1) {
            suffix = '';
          }
          
          const fullName = bw.name 
            ? `${bw.name}${suffix} (${chunk.length} units)` 
            : `Commercial Building${suffix} (${chunk.length} units)`;
            
          buildings.push({
            id: bw.way.id * 100 + chunkNum, // Ensure unique ID per chunk
            lat: bw.lat,
            lon: bw.lon,
            isMDU: true, // Mark as MDU to get dedicated placement
            name: fullName,
            demand: chunk.length,
          });
        }
      } else if (subs.length === 1) {
        // Single business inside building
        const sub = subs[0];
        const subName = sub.tags?.name || sub.tags?.shop || sub.tags?.office || sub.tags?.amenity || 'Business';
        const fullName = bw.name ? `${bw.name} - ${subName}` : subName;
        buildings.push({
          id: bw.way.id,
          lat: bw.lat,
          lon: bw.lon,
          isMDU: bw.isMDU,
          name: fullName,
          demand: 1,
        });
      } else {
        // Single tenant / residential building
        const isHotel = bw.isMDU && (bw.way.tags?.tourism === 'hotel' || bw.way.tags?.building === 'hotel');
        let demand = 1;
        if (bw.isMDU) {
          const flats = bw.way.tags?.['building:flats'] || bw.way.tags?.flats || bw.way.tags?.units;
          if (flats) {
            demand = parseInt(flats, 10) || (isHotel ? 3 : 4);
          } else {
            const levels = parseInt(bw.way.tags?.['building:levels'] || '1', 10);
            if (levels > 1) {
              demand = isHotel ? Math.min(24, levels * 3) : Math.min(16, levels * 2);
            } else {
              demand = isHotel ? 3 : 4; // Use 3 for hotels, 4 for other MDUs
            }
          }
        }

        buildings.push({
          id: bw.way.id,
          lat: bw.lat,
          lon: bw.lon,
          isMDU: bw.isMDU,
          name: bw.name || (bw.isMDU ? (isHotel ? 'Hotel' : 'Commercial Building/Apartments') : 'Building'),
          demand,
        });
      }
    }

    // B. Add standalone business nodes and point buildings:
    for (const node of standaloneNodes) {
      const name = node.tags?.name || node.tags?.['addr:housename'] || node.tags?.shop || node.tags?.office || node.tags?.amenity || 'Business';
      buildings.push({
        id: node.id,
        lat: node.lat,
        lon: node.lon,
        isMDU: checkIsMDU(node.tags),
        name,
        demand: 1,
      });
    }

    return buildings;
  }

  public static extractRoads(nodes: Map<number, OSMNode>, ways: OSMWay[], polygon: [number, number][]): RoadSegment[] {
    const roads: RoadSegment[] = [];

    for (const way of ways) {
      if (way.tags && way.tags.highway) {
        const type = way.tags.highway;
        if (['footway', 'path', 'steps', 'pedestrian', 'corridor', 'bridleway', 'cycleway', 'proposed', 'construction', 'abandoned'].includes(type)) {
          continue;
        }

        let hasCoordinatesNearPolygon = false;
        const coords: [number, number][] = [];

        for (const nodeId of way.nodes) {
          const node = nodes.get(nodeId);
          if (node) {
            coords.push([node.lon, node.lat]);
            if (!hasCoordinatesNearPolygon) {
              const isInside = GISGeometry.isPointInPolygon([node.lon, node.lat], polygon);
              const dist = isInside ? 0 : GISGeometry.getDistanceToPolygon([node.lon, node.lat], polygon);
              if (dist <= 150) { // Keep road if it enters or is within 150m of the polygon to preserve junctions
                hasCoordinatesNearPolygon = true;
              }
            }
          }
        }

        if (hasCoordinatesNearPolygon && coords.length >= 2) {
          roads.push({
            id: way.id,
            coordinates: coords,
            highwayType: type,
            junction: way.tags.junction,
            lanes: way.tags.lanes ? parseInt(way.tags.lanes, 10) : undefined,
            oneway: way.tags.oneway === 'yes' || way.tags.oneway === '1' || way.tags.junction === 'roundabout' || type === 'motorway'
          });
        }
      }
    }

    return roads;
  }
}
