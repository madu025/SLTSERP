import RBush from 'rbush';
import { MinPriorityQueue } from '@datastructures-js/priority-queue';
import { RoadSegment, Building, RoadIndexItem } from './types';
import { GISGeometry } from './GISGeometry';

/** Latitude-aware meters → degrees conversion helpers */
const metersToLatDeg = (m: number): number => m / 111320.0;
const metersToLonDeg = (m: number, lat: number): number => m / (111320.0 * Math.cos(lat * Math.PI / 180));

export class GISRoadNetwork {
  static getRoundaboutCenters(roads: RoadSegment[]): { lat: number; lon: number; points: { lat: number; lon: number }[] }[] {
    const roundabouts: { lat: number; lon: number }[][] = [];
    for (const r of roads) {
      if (r.junction === 'roundabout' || r.highwayType === 'roundabout') {
        const pts = r.coordinates.map(c => ({ lat: c[1], lon: c[0] }));
        let added = false;
        for (const group of roundabouts) {
          const close = group.some(g => GISGeometry.getDistanceMeters(pts[0].lat, pts[0].lon, g.lat, g.lon) < 80.0);
          if (close) {
            group.push(...pts);
            added = true;
            break;
          }
        }
        if (!added) {
          roundabouts.push(pts);
        }
      }
    }
    return roundabouts.map(group => {
      let latSum = 0, lonSum = 0;
      for (const pt of group) {
        latSum += pt.lat;
        lonSum += pt.lon;
      }
      return {
        lat: latSum / group.length,
        lon: lonSum / group.length,
        points: group
      };
    });
  }

  static isInsideRoundaboutCenterIsland(lat: number, lon: number, centers: any[]): boolean {
    for (const center of centers) {
      const dCenter = GISGeometry.getDistanceMeters(lat, lon, center.lat, center.lon);
      if (dCenter < 22.0) {
        let minRingDist = Infinity;
        for (const rp of center.points) {
          const d = GISGeometry.getDistanceMeters(lat, lon, rp.lat, rp.lon);
          if (d < minRingDist) minRingDist = d;
        }
        if (dCenter < minRingDist - 1.0) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Snaps a coordinate to the nearest segment of any road.
   */
  static snapToNearestRoad(lat: number, lon: number, roads: RoadSegment[], ignoreMultiplier = true): { lat: number; lon: number } {
    let minDistance = Infinity;
    let snappedLat = lat;
    let snappedLon = lon;

    const centers = this.getRoundaboutCenters(roads);

    for (const road of roads) {
      const hwType = road.highwayType ? road.highwayType.toLowerCase() : '';
      let multiplier = 1.0;
      if (!ignoreMultiplier) {
        if (hwType === 'trunk' || hwType === 'primary' || hwType === 'motorway' || hwType === 'secondary') {
          multiplier = 1.8; // Heavily penalize major high-speed roads for drop loops
        } else if (['residential', 'service', 'unclassified', 'tertiary'].includes(hwType)) {
          multiplier = 0.85; // Favor local residential/byroad streets
        }
      }

      for (let i = 0; i < road.coordinates.length - 1; i++) {
        const p1 = road.coordinates[i];
        const p2 = road.coordinates[i + 1];

        const snapped = GISGeometry.snapPointToSegmentAccurate(lon, lat, p1[0], p1[1], p2[0], p2[1]);
        


        const actualDist = GISGeometry.getDistanceMeters(lat, lon, snapped.lat, snapped.lon);
        const scaledDist = actualDist * multiplier;

        if (scaledDist < minDistance) {
          minDistance = scaledDist;
          snappedLat = snapped.lat;
          snappedLon = snapped.lon;
        }
      }
    }

    return { lat: snappedLat, lon: snappedLon };
  }

  /**
   * Snaps a point to a line segment.
   */
  static snapPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
      return { lat: y1, lon: x1 };
    }

    const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    const clampedT = Math.max(0, Math.min(1, t));

    return {
      lon: x1 + clampedT * dx,
      lat: y1 + clampedT * dy,
    };
  }

  /**
   * Builds an adjacency list representation of the road network graph.
   */
  static buildRoadGraph(roads: RoadSegment[]): Map<string, Map<string, number>> {
    const graph = new Map<string, Map<string, number>>();

    const addEdge = (u: string, v: string, weight: number) => {
      if (!graph.has(u)) graph.set(u, new Map());
      if (!graph.has(v)) graph.set(v, new Map());
      graph.get(u)!.set(v, weight);
      graph.get(v)!.set(u, weight);
    };

    for (const road of roads) {
      for (let i = 0; i < road.coordinates.length - 1; i++) {
        const p1 = road.coordinates[i];
        const p2 = road.coordinates[i + 1];
        const u = `${p1[0]},${p1[1]}`;
        const v = `${p2[0]},${p2[1]}`;
        const weight = GISGeometry.getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);
        addEdge(u, v, weight);
      }
    }

    return graph;
  }

  /**
   * Finds the closest graph vertex to a given coordinate.
   */
  static findClosestVertex(lon: number, lat: number, graph: Map<string, Map<string, number>>): string | null {
    let closestKey: string | null = null;
    let minDist = Infinity;

    for (const key of graph.keys()) {
      const [vLon, vLat] = key.split(',').map(Number);
      const dist = GISGeometry.getDistanceMeters(lat, lon, vLat, vLon);
      if (dist < minDist) {
        minDist = dist;
        closestKey = key;
      }
    }

    return closestKey;
  }

  /**
   * Dynamically heals isolated road components by creating virtual stitching segments
   * between the closest points of disconnected sub-graphs, up to a maximum distance of 200m.
   */
  static healRoadNetwork(roads: RoadSegment[]): RoadSegment[] {
    const graph = this.buildRoadGraph(roads);
    if (graph.size === 0) return roads;

    const visited = new Set<string>();
    const components: Set<string>[] = [];

    for (const startNode of graph.keys()) {
      if (!visited.has(startNode)) {
        const component = new Set<string>();
        const queue = [startNode];
        visited.add(startNode);
        component.add(startNode);

        while (queue.length > 0) {
          const node = queue.shift()!;
          const neighbors = graph.get(node);
          if (neighbors) {
            for (const neighbor of neighbors.keys()) {
              if (!visited.has(neighbor)) {
                visited.add(neighbor);
                component.add(neighbor);
                queue.push(neighbor);
              }
            }
          }
        }
        components.push(component);
      }
    }

    if (components.length <= 1) return roads;

    // Sort components by size descending. The largest component is the "main" network.
    components.sort((a, b) => b.size - a.size);
    const mainComponent = components[0];
    const otherComponents = components.slice(1);

    const healedRoads = [...roads];
    let stitchId = 999000;

    for (const comp of otherComponents) {
      let minDistance = Infinity;
      let bestU: [number, number] | null = null;
      let bestV: [number, number] | null = null;

      for (const uKey of comp) {
        const [uLon, uLat] = uKey.split(',').map(Number);
        for (const vKey of mainComponent) {
          const [vLon, vLat] = vKey.split(',').map(Number);
          const dist = GISGeometry.getDistanceMeters(uLat, uLon, vLat, vLon);
          if (dist < minDistance) {
            minDistance = dist;
            bestU = [uLon, uLat];
            bestV = [vLon, vLat];
          }
        }
      }

      // If the gap is within 55 meters, we stitch it to heal junctions without crossing blocks
      if (minDistance <= 55 && bestU && bestV) {
        healedRoads.push({
          id: stitchId++,
          coordinates: [bestU, bestV],
          highwayType: 'virtual_stitch'
        });
        // Merge this component's nodes into the main component to allow subsequent stitchings to route through it
        for (const node of comp) {
          mainComponent.add(node);
        }
      }
    }

    return healedRoads;
  }

  /**
   * Filters the roads array to only include roads that belong to the largest connected component.
   * This removes isolated road islands that trap DPs and cause straight-line fallback bridges.
   */
  static filterLargestConnectedComponent(roads: RoadSegment[]): RoadSegment[] {
    const healedRoads = this.healRoadNetwork(roads);
    const graph = this.buildRoadGraph(healedRoads);
    if (graph.size === 0) return healedRoads;

    const visited = new Set<string>();
    let largestComponent = new Set<string>();

    for (const startNode of graph.keys()) {
      if (!visited.has(startNode)) {
        const component = new Set<string>();
        const queue = [startNode];
        visited.add(startNode);
        component.add(startNode);

        while (queue.length > 0) {
          const node = queue.shift()!;
          const neighbors = graph.get(node);
          if (neighbors) {
            for (const neighbor of neighbors.keys()) {
              if (!visited.has(neighbor)) {
                visited.add(neighbor);
                component.add(neighbor);
                queue.push(neighbor);
              }
            }
          }
        }

        if (component.size > largestComponent.size) {
          largestComponent = component;
        }
      }
    }

    return healedRoads.filter(road => {
      for (const coord of road.coordinates) {
        const key = `${coord[0]},${coord[1]}`;
        if (largestComponent.has(key)) return true;
      }
      return false;
    });
  }
  

  /**
   * Helper: getNodeOffsetCoordinate calculates the coordinate offset to the left or right shoulder.
   */
  static getNodeOffsetCoordinate(
    lon: number,
    lat: number,
    side: 'LEFT' | 'RIGHT',
    roads: RoadSegment[]
  ): [number, number] {
    let minDistance = Infinity;
    let bestP1: [number, number] | null = null;
    let bestP2: [number, number] | null = null;
    let bestRoad: RoadSegment | null = null;

    for (const road of roads) {
      for (let i = 0; i < road.coordinates.length - 1; i++) {
        const p1 = road.coordinates[i];
        const p2 = road.coordinates[i + 1];
        const snapped = this.snapPointToSegment(lon, lat, p1[0], p1[1], p2[0], p2[1]);
        const dist = GISGeometry.getDistanceMeters(lat, lon, snapped.lat, snapped.lon);
        if (dist < minDistance) {
          minDistance = dist;
          bestP1 = p1;
          bestP2 = p2;
          bestRoad = road;
        }
      }
    }

    if (bestP1 && bestP2 && bestRoad) {
      let dx = bestP2[0] - bestP1[0];
      let dy = bestP2[1] - bestP1[1];
      let len = Math.sqrt(dx * dx + dy * dy);
      
      if (len === 0) {
        // Look for any non-degenerate segment in the same road to extract normal direction
        for (let i = 0; i < bestRoad.coordinates.length - 1; i++) {
          const pt1 = bestRoad.coordinates[i];
          const pt2 = bestRoad.coordinates[i + 1];
          const d_x = pt2[0] - pt1[0];
          const d_y = pt2[1] - pt1[1];
          const l = Math.sqrt(d_x * d_x + d_y * d_y);
          if (l > 0) {
            dx = d_x;
            dy = d_y;
            len = l;
            break;
          }
        }
      }

      if (len === 0) {
        // Hard fallback to horizontal unit direction to ensure non-degenerate normal
        dx = 1;
        dy = 0;
        len = 1;
      }

      let offsetMeters = 3.5;
      if (bestRoad.highwayType) {
        const lower = bestRoad.highwayType.toLowerCase();
        if (lower === 'trunk' || lower === 'motorway' || lower === 'primary') {
          offsetMeters = 7.5;
        } else if (lower === 'secondary') {
          offsetMeters = 5.0;
        }
      }
      // Roads with 4+ lanes are treated as major regardless of highwayType classification
      if (bestRoad.lanes !== undefined && bestRoad.lanes >= 4) {
        offsetMeters = Math.max(offsetMeters, 7.5);
      }
      // Use separate lat/lon degree-per-meter factors for accurate shoulder placement
      const offsetLatDeg = metersToLatDeg(offsetMeters);
      const offsetLonDeg = metersToLonDeg(offsetMeters, lat);

      const nx = -dy / len;
      const ny = dx / len;

      if (side === 'LEFT') {
        return [lon + nx * offsetLonDeg, lat + ny * offsetLatDeg];
      } else {
        return [lon - nx * offsetLonDeg, lat - ny * offsetLatDeg];
      }
    }

    return [lon, lat];
  }

  /**
   * Helper: getRoadShoulderCoords generates left/right offset coordinates along the road.
   */
  static getRoadShoulderCoords(
    coords: [number, number][],
    side: 'LEFT' | 'RIGHT',
    offsetMeters: number
  ): [number, number][] {
    const offsetCoords: [number, number][] = [];

    for (let i = 0; i < coords.length; i++) {
      const pCurr = coords[i];
      let nx = 0;
      let ny = 0;

      if (coords.length < 2) {
        offsetCoords.push(pCurr);
        continue;
      }

      if (i === 0) {
        const pNext = coords[1];
        const dx = pNext[0] - pCurr[0];
        const dy = pNext[1] - pCurr[1];
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          nx = -dy / len;
          ny = dx / len;
        }
      } else if (i === coords.length - 1) {
        const pPrev = coords[i - 1];
        const dx = pCurr[0] - pPrev[0];
        const dy = pCurr[1] - pPrev[1];
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          nx = -dy / len;
          ny = dx / len;
        }
      } else {
        const pPrev = coords[i - 1];
        const pNext = coords[i + 1];
        
        const dx1 = pCurr[0] - pPrev[0];
        const dy1 = pCurr[1] - pPrev[1];
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        
        const dx2 = pNext[0] - pCurr[0];
        const dy2 = pNext[1] - pCurr[1];
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        
        if (len1 > 0 && len2 > 0) {
          const nx1 = -dy1 / len1; const ny1 = dx1 / len1;
          const nx2 = -dy2 / len2; const ny2 = dx2 / len2;
          nx = (nx1 + nx2) / 2;
          ny = (ny1 + ny2) / 2;
          const nLen = Math.sqrt(nx * nx + ny * ny);
          if (nLen > 0) {
            nx /= nLen;
            ny /= nLen;
          }
        }
      }

      // Use separate lat/lon degree-per-meter factors for accurate shoulder placement
      const offsetLonDeg = metersToLonDeg(offsetMeters, pCurr[1]);
      const offsetLatDeg = metersToLatDeg(offsetMeters);
      const factor = side === 'LEFT' ? 1 : -1;
      offsetCoords.push([
        pCurr[0] + factor * nx * offsetLonDeg,
        pCurr[1] + factor * ny * offsetLatDeg
      ]);
    }

    return offsetCoords;
  }

  /**
   * Helper: checkIsRoundaboutSegment determines if the node connection is on a roundabout way.
   */
  private static checkIsRoundaboutSegment(k1: string, k2: string, roads: RoadSegment[]): boolean {
    const [lon1, lat1] = k1.split(',').map(Number);
    const [lon2, lat2] = k2.split(',').map(Number);
    
    for (const road of roads) {
      if (road.junction === 'roundabout' || road.highwayType === 'roundabout') {
        for (let i = 0; i < road.coordinates.length - 1; i++) {
          const p1 = road.coordinates[i];
          const p2 = road.coordinates[i + 1];
          const match1 = Math.abs(p1[0] - lon1) < 1e-6 && Math.abs(p1[1] - lat1) < 1e-6 &&
                         Math.abs(p2[0] - lon2) < 1e-6 && Math.abs(p2[1] - lat2) < 1e-6;
          const match2 = Math.abs(p1[0] - lon2) < 1e-6 && Math.abs(p1[1] - lat2) < 1e-6 &&
                         Math.abs(p2[0] - lon1) < 1e-6 && Math.abs(p2[1] - lat1) < 1e-6;
          if (match1 || match2) return true;
        }
      }
    }
    return false;
  }


  /**
   * Inserts snapped points into road segment arrays to represent them as graph vertices.
   */
  static insertNodeIntoRoads(snap: { lat: number; lon: number }, roads: RoadSegment[]) {
    let bestRoad: RoadSegment | null = null;
    let bestSegIndex = -1;
    let minDistance = Infinity;

    for (const road of roads) {
      for (let i = 0; i < road.coordinates.length - 1; i++) {
        const p1 = road.coordinates[i];
        const p2 = road.coordinates[i + 1];
        const snapped = GISGeometry.snapPointToSegmentAccurate(snap.lon, snap.lat, p1[0], p1[1], p2[0], p2[1]);
        const dist = GISGeometry.getDistanceMeters(snap.lat, snap.lon, snapped.lat, snapped.lon);
        if (dist < minDistance) {
          minDistance = dist;
          bestRoad = road;
          bestSegIndex = i;
        }
      }
    }

    if (bestRoad && bestSegIndex !== -1) {
      const u = bestRoad.coordinates[bestSegIndex];
      const v = bestRoad.coordinates[bestSegIndex + 1];
      
      const d1 = GISGeometry.getDistanceMeters(snap.lat, snap.lon, u[1], u[0]);
      const d2 = GISGeometry.getDistanceMeters(snap.lat, snap.lon, v[1], v[0]);
      if (d1 > 1.0 && d2 > 1.0) {
        bestRoad.coordinates.splice(bestSegIndex + 1, 0, [snap.lon, snap.lat]);
      } else if (d1 <= 1.0) {
        snap.lon = u[0];
        snap.lat = u[1];
      } else if (d2 <= 1.0) {
        snap.lon = v[0];
        snap.lat = v[1];
      }
    }
  }

  /**
   * Generates left and right shoulders graph for side-aware OSP routing.
   */
  static buildDualShoulderGraph(
    roads: RoadSegment[],
    usedRoadShoulders?: Map<number, 'LEFT' | 'RIGHT'>
  ): {
    graph: Map<string, Map<string, number>>;
    shoulderNodeMap: Map<string, string[]>;
    nodeToRoadSide: Map<string, { roadId: number; side: 'LEFT' | 'RIGHT' }>;
  } {
    const graph = new Map<string, Map<string, number>>();
    const shoulderNodeMap = new Map<string, string[]>();
    const nodeToRoadSide = new Map<string, { roadId: number; side: 'LEFT' | 'RIGHT' }>();
    const roundaboutCenters = this.getRoundaboutCenters(roads);



    const intersections: { lat: number; lon: number }[] = [];
    try {
      const topo = this.buildRoadTopology(roads);
      intersections.push(...topo.intersections);
    } catch (e) {
      console.error('[buildDualShoulderGraph] Failed to build topology', e);
    }

    const addEdge = (u: string, v: string, weight: number) => {
      if (!graph.has(u)) graph.set(u, new Map());
      if (!graph.has(v)) graph.set(v, new Map());
      
      const existingU = graph.get(u)!.get(v);
      if (existingU === undefined || weight < existingU) {
        graph.get(u)!.set(v, weight);
      }
      
      const existingV = graph.get(v)!.get(u);
      if (existingV === undefined || weight < existingV) {
        graph.get(v)!.set(u, weight);
      }
    };

    const roadShoulderData: {
      road: RoadSegment;
      leftCoords: [number, number][];
      rightCoords: [number, number][];
    }[] = [];

    const getOffsetDistance = (road: RoadSegment): number => {
      const type = road.highwayType;
      if (!type) return (road.lanes !== undefined && road.lanes >= 4) ? 7.5 : 3.5;
      const lower = type.toLowerCase();
      if (lower === 'trunk' || lower === 'motorway' || lower === 'primary') return 7.5;
      if (lower === 'secondary') return 5.0;
      // Roads with 4+ lanes are treated as major regardless of highwayType
      if (road.lanes !== undefined && road.lanes >= 4) return 7.5;
      return 3.5;
    };

    for (const road of roads) {
      const offsetMeters = getOffsetDistance(road);
      const lowerType = road.highwayType ? road.highwayType.toLowerCase() : '';
      const isMajorRoad = lowerType === 'motorway' || lowerType === 'trunk' || lowerType === 'primary' || lowerType === 'secondary' || (road.lanes && road.lanes >= 4);
      
      const leftCoords = this.getRoadShoulderCoords(road.coordinates, 'LEFT', offsetMeters);
      let rightCoords = this.getRoadShoulderCoords(road.coordinates, 'RIGHT', offsetMeters);

      if (!isMajorRoad || road.oneway) {
        // Force single-sided distribution on minor roads OR oneway major roads (collapse inner right shoulder to outer left shoulder)
        rightCoords = leftCoords;
      }

      // Populate nodeToRoadSide map
      for (let i = 0; i < leftCoords.length; i++) {
        const leftKey = `${leftCoords[i][0]},${leftCoords[i][1]}`;
        nodeToRoadSide.set(leftKey, { roadId: road.id, side: 'LEFT' });
      }
      for (let i = 0; i < rightCoords.length; i++) {
        const rightKey = `${rightCoords[i][0]},${rightCoords[i][1]}`;
        nodeToRoadSide.set(rightKey, { roadId: road.id, side: 'RIGHT' });
      }

      roadShoulderData.push({ road, leftCoords, rightCoords });

      for (let i = 0; i < leftCoords.length - 1; i++) {
        const u = `${leftCoords[i][0]},${leftCoords[i][1]}`;
        const v = `${leftCoords[i+1][0]},${leftCoords[i+1][1]}`;
        const dist = GISGeometry.getDistanceMeters(leftCoords[i][1], leftCoords[i][0], leftCoords[i+1][1], leftCoords[i+1][0]);
        let penalty = 0;
        if (road.junction === 'roundabout' || road.highwayType === 'roundabout') {
          penalty += 200;
        }
        if (usedRoadShoulders && usedRoadShoulders.get(road.id) === 'RIGHT') {
          penalty += 5000;
        }
        addEdge(u, v, dist + penalty);
      }

      for (let i = 0; i < rightCoords.length - 1; i++) {
        const u = `${rightCoords[i][0]},${rightCoords[i][1]}`;
        const v = `${rightCoords[i+1][0]},${rightCoords[i+1][1]}`;
        const dist = GISGeometry.getDistanceMeters(rightCoords[i][1], rightCoords[i][0], rightCoords[i+1][1], rightCoords[i+1][0]);
        let penalty = 0;
        if (road.junction === 'roundabout' || road.highwayType === 'roundabout') {
          penalty += 200;
        }
        if (usedRoadShoulders && usedRoadShoulders.get(road.id) === 'LEFT') {
          penalty += 5000;
        }
        addEdge(u, v, dist + penalty);
      }

      for (let i = 0; i < leftCoords.length; i++) {
        const leftKey = `${leftCoords[i][0]},${leftCoords[i][1]}`;
        const rightKey = `${rightCoords[i][0]},${rightCoords[i][1]}`;
        
        let swapPenalty = 600; // SHOULDER_SWAP_PENALTY
        const lowerType = road.highwayType ? road.highwayType.toLowerCase() : '';
        const isRoundabout = road.junction === 'roundabout' || road.highwayType === 'roundabout';
        const isMajorRoad = lowerType === 'motorway' || lowerType === 'trunk' || lowerType === 'primary' || lowerType === 'secondary' || (road.lanes && road.lanes >= 4);

        if (isMajorRoad) {
          // Allow major road centerline crossing ONLY at intersections (within 35m to handle dual-carriageways)
          const clNode = road.coordinates[i];
          const isIntersection = intersections.some(ix => 
            GISGeometry.getDistanceMeters(clNode[1], clNode[0], ix.lat, ix.lon) < 35.0
          );
          
          if (!isIntersection) {
            const clKey = `${clNode[0]},${clNode[1]}`;
            if (!shoulderNodeMap.has(clKey)) {
              shoulderNodeMap.set(clKey, []);
            }
            shoulderNodeMap.get(clKey)!.push(leftKey, rightKey);
            continue;
          }
        }

        if (isRoundabout) {
          swapPenalty += 1500; // ROUNDABOUT_CENTER_PENALTY (Forces bypass preference)
        } else if (lowerType === 'trunk' || lowerType === 'motorway') {
          swapPenalty += 2000;
        } else if (lowerType === 'primary') {
          swapPenalty += 1200;
        } else if (lowerType === 'secondary') {
          swapPenalty += 800;
        }

        addEdge(leftKey, rightKey, swapPenalty);

        const centerlineNode = road.coordinates[i];
        const clKey = `${centerlineNode[0]},${centerlineNode[1]}`;
        if (!shoulderNodeMap.has(clKey)) {
          shoulderNodeMap.set(clKey, []);
        }
        shoulderNodeMap.get(clKey)!.push(leftKey, rightKey);
      }
    }

    const centerlineIntersections = new Map<string, { roadId: number; leftKey: string; rightKey: string; isMajor?: boolean; isRoundabout?: boolean }[]>();

    for (const data of roadShoulderData) {
      const lower = data.road.highwayType ? data.road.highwayType.toLowerCase() : '';
      const isMajor = lower === 'motorway' || lower === 'trunk' || lower === 'primary' || lower === 'secondary' || (data.road.lanes !== undefined && data.road.lanes >= 4);
      const isRoundabout = data.road.junction === 'roundabout' || data.road.highwayType === 'roundabout';

      for (let i = 0; i < data.road.coordinates.length; i++) {
        const clNode = data.road.coordinates[i];
        const clKey = `${clNode[0]},${clNode[1]}`;
        
        if (!centerlineIntersections.has(clKey)) {
          centerlineIntersections.set(clKey, []);
        }
        centerlineIntersections.get(clKey)!.push({
          roadId: data.road.id,
          leftKey: `${data.leftCoords[i][0]},${data.leftCoords[i][1]}`,
          rightKey: `${data.rightCoords[i][0]},${data.rightCoords[i][1]}`,
          isMajor,
          isRoundabout
        });
      }
    }

    // Treat roundabout junction nodes (where roundabout meets normal road) as topological intersections
    for (const [clKey, connList] of centerlineIntersections.entries()) {
      const hasRoundabout = connList.some(c => c.isRoundabout);
      const hasNonRoundabout = connList.some(c => !c.isRoundabout);
      if (hasRoundabout && hasNonRoundabout) {
        const [lon, lat] = clKey.split(',').map(Number);
        intersections.push({ lat, lon });
      }
    }

    // Merge parallel carriageway centerline intersections within 35 meters of topological intersections
    for (const ix of intersections) {
      const closeKeys: string[] = [];
      
      for (const [clKey, connList] of centerlineIntersections.entries()) {
        const [clLon, clLat] = clKey.split(',').map(Number);
        
        // Block merging if the path from the intersection center (ix) to the clKey crosses the roundabout center island
        let crossesRoundabout = false;
        const checkPoints = [0.25, 0.5, 0.75];
        for (const ratio of checkPoints) {
          const checkLat = ix.lat + (clLat - ix.lat) * ratio;
          const checkLon = ix.lon + (clLon - ix.lon) * ratio;
          if (this.isInsideRoundaboutCenterIsland(checkLat, checkLon, roundaboutCenters)) {
            crossesRoundabout = true;
            break;
          }
        }
        if (crossesRoundabout) continue;

        const dist = GISGeometry.getDistanceMeters(ix.lat, ix.lon, clLat, clLon);
        if (dist <= 35.0) {
          closeKeys.push(clKey);
        }
      }

      if (closeKeys.length >= 2) {
        // Collect all connections across close keys
        const allConns: { roadId: number; leftKey: string; rightKey: string; isMajor?: boolean; isRoundabout?: boolean }[] = [];
        for (const key of closeKeys) {
          allConns.push(...centerlineIntersections.get(key)!);
        }
        
        // Keep only unique connections per road to prevent duplicate edges
        const uniqueConns: typeof allConns = [];
        const seenRoads = new Set<number>();
        for (const conn of allConns) {
          if (!seenRoads.has(conn.roadId)) {
            seenRoads.add(conn.roadId);
            uniqueConns.push(conn);
          }
        }

        // Apply back the merged connections
        for (const key of closeKeys) {
          centerlineIntersections.set(key, uniqueConns);
        }
      }
    }

    for (const [clKey, connections] of centerlineIntersections.entries()) {
      if (connections.length > 1) {
        const degree = connections.length;
        let junctionPenalty = 150;
        if (degree >= 4) {
          junctionPenalty = 500;
        }

        for (let i = 0; i < connections.length; i++) {
          for (let j = i + 1; j < connections.length; j++) {
            const c1 = connections[i];
            const c2 = connections[j];

            addEdge(c1.leftKey, c2.leftKey, junctionPenalty);
            addEdge(c1.rightKey, c2.rightKey, junctionPenalty);
            
            // Only block cross-shoulder edges if BOTH connecting roads are major roads (prevent diagonal crossings of the same major road)
            if (!(c1.isMajor && c2.isMajor)) {
              addEdge(c1.leftKey, c2.rightKey, junctionPenalty + 600);
              addEdge(c1.rightKey, c2.leftKey, junctionPenalty + 600);
            }
          }
        }
      }
    }

    // Spatial proximity connection: Connect shoulders of parallel/adjacent roads within 25 meters
    for (let i = 0; i < roadShoulderData.length; i++) {
      for (let j = i + 1; j < roadShoulderData.length; j++) {
        const r1 = roadShoulderData[i];
        const r2 = roadShoulderData[j];
        if (r1.road.id === r2.road.id) continue;

        const isR1Major = r1.road.highwayType === 'motorway' || r1.road.highwayType === 'trunk' || r1.road.highwayType === 'primary' || r1.road.highwayType === 'secondary';
        const isR2Major = r2.road.highwayType === 'motorway' || r2.road.highwayType === 'trunk' || r2.road.highwayType === 'primary' || r2.road.highwayType === 'secondary';

        for (let k = 0; k < r1.road.coordinates.length; k++) {
          const pt1 = r1.road.coordinates[k];
          let bestM = -1;
          let minDist = Infinity;

          for (let m = 0; m < r2.road.coordinates.length; m++) {
            const pt2 = r2.road.coordinates[m];
            const dist = GISGeometry.getDistanceMeters(pt1[1], pt1[0], pt2[1], pt2[0]);
            if (dist < minDist) {
              minDist = dist;
              bestM = m;
            }
          }

          if (minDist <= 35.0 && bestM >= 0) {
            const pt2 = r2.road.coordinates[bestM];
            
            // Block spatial connections that cross a roundabout center island
            const checkPoints = [0.25, 0.5, 0.75];
            let crossesRoundabout = false;
            for (const ratio of checkPoints) {
              const checkLat = pt1[1] + (pt2[1] - pt1[1]) * ratio;
              const checkLon = pt1[0] + (pt2[0] - pt1[0]) * ratio;
              if (this.isInsideRoundaboutCenterIsland(checkLat, checkLon, roundaboutCenters)) {
                crossesRoundabout = true;
                break;
              }
            }
            if (crossesRoundabout) continue;

            const r1Left = `${r1.leftCoords[k][0]},${r1.leftCoords[k][1]}`;
            const r1Right = `${r1.rightCoords[k][0]},${r1.rightCoords[k][1]}`;
            const r2Left = `${r2.leftCoords[bestM][0]},${r2.leftCoords[bestM][1]}`;
            const r2Right = `${r2.rightCoords[bestM][0]},${r2.rightCoords[bestM][1]}`;

            const crossPenalty = (isR1Major || isR2Major) ? 3000 : 800;

            addEdge(r1Left, r2Left, minDist + crossPenalty);
            addEdge(r1Right, r2Right, minDist + crossPenalty);
            addEdge(r1Left, r2Right, minDist + crossPenalty + 500);
            addEdge(r1Right, r2Left, minDist + crossPenalty + 500);
          }
        }
      }
    }

    const nodesList = Array.from(graph.keys());
    const visited = new Set<string>();
    const components: Set<string>[] = [];

    for (const startNode of nodesList) {
      if (!visited.has(startNode)) {
        const component = new Set<string>();
        const queue = [startNode];
        visited.add(startNode);
        component.add(startNode);

        while (queue.length > 0) {
          const node = queue.shift()!;
          const neighbors = graph.get(node);
          if (neighbors) {
            for (const neighbor of neighbors.keys()) {
              if (!visited.has(neighbor)) {
                visited.add(neighbor);
                component.add(neighbor);
                queue.push(neighbor);
              }
            }
          }
        }
        components.push(component);
      }
    }

    if (components.length > 1) {
      components.sort((a, b) => b.size - a.size);
      const mainComponent = components[0];
      
      for (let cIdx = 1; cIdx < components.length; cIdx++) {
        const comp = components[cIdx];
        let minDist = Infinity;
        let bestU: string | null = null;
        let bestV: string | null = null;
        let addedCount = 0;

        for (const u of comp) {
          const [uLon, uLat] = u.split(',').map(Number);
          for (const v of mainComponent) {
            const [vLon, vLat] = v.split(',').map(Number);
            const dist = GISGeometry.getDistanceMeters(uLat, uLon, vLat, vLon);
            if (dist < minDist) {
              minDist = dist;
              bestU = u;
              bestV = v;
            }
            // Bridge all nodes within 30 meters to merge parallel/adjacent disconnected roadways (like dual-carriageway lanes or service roads)
            if (dist <= 30.0) {
              addEdge(u, v, dist + 1000);
              addedCount++;
            }
          }
        }

        if (addedCount === 0 && minDist <= 55 && bestU && bestV) {
          addEdge(bestU, bestV, minDist + 1000);
        }

        for (const node of comp) {
          mainComponent.add(node);
        }
      }
    }

    return { graph, shoulderNodeMap, nodeToRoadSide };
  }

  /**
   * Finds the shortest road path between two coordinates using Dual-Shoulder Graph Dijkstra's algorithm.
   */
  static dijkstraRoute(
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    roads: RoadSegment[],
    usedRoadShoulders?: Map<number, 'LEFT' | 'RIGHT'>
  ): { 
    pathCoords: [number, number][]; 
    isFallback: boolean; 
    nodeToRoadSide: Map<string, { roadId: number; side: 'LEFT' | 'RIGHT' }>;
  } {
    const clonedRoads = roads.map(r => ({
      ...r,
      coordinates: [...r.coordinates]
    }));

    const startSnap = this.snapToNearestRoad(startLat, startLon, clonedRoads);
    const endSnap = this.snapToNearestRoad(endLat, endLon, clonedRoads);

    this.insertNodeIntoRoads(startSnap, clonedRoads);
    this.insertNodeIntoRoads(endSnap, clonedRoads);

    const { graph, shoulderNodeMap, nodeToRoadSide } = this.buildDualShoulderGraph(clonedRoads, usedRoadShoulders);

    // Identify start/end shoulder coordinates.
    // Primary lookup: exact match in shoulderNodeMap (O(1)).
    // Fallback: nearest shoulderNodeMap entry within 15m (handles floating-point snap drift).
    const resolveShoulderKey = (snapLon: number, snapLat: number, origLat: number, origLon: number): string => {
      const shoulders = shoulderNodeMap.get(`${snapLon},${snapLat}`) || [];
      if (shoulders.length > 0) {
        if (shoulders.length === 1) return shoulders[0];
        let bestKey = shoulders[0];
        let bestDist = Infinity;
        for (const k of shoulders) {
          const [kLon, kLat] = k.split(',').map(Number);
          const d = GISGeometry.getDistanceMeters(origLat, origLon, kLat, kLon);
          if (d < bestDist) { bestDist = d; bestKey = k; }
        }
        return bestKey;
      }
      // Proximity fallback: scan shoulderNodeMap for closest entry within 15m
      let bestKey = `${snapLon},${snapLat}`;
      let bestDist = 15; // max 15m tolerance
      for (const [clKey, shList] of shoulderNodeMap.entries()) {
        const [clLon, clLat] = clKey.split(',').map(Number);
        const dSnap = GISGeometry.getDistanceMeters(snapLat, snapLon, clLat, clLon);
        if (dSnap < bestDist && shList.length > 0) {
          bestDist = dSnap;
          // Pick the shoulder closest to the original (pre-snap) point
          let bk = shList[0];
          let bd = Infinity;
          for (const k of shList) {
            const [kLon, kLat] = k.split(',').map(Number);
            const d = GISGeometry.getDistanceMeters(origLat, origLon, kLat, kLon);
            if (d < bd) { bd = d; bk = k; }
          }
          bestKey = bk;
        }
      }
      return bestKey;
    };

    const startShoulderKey = resolveShoulderKey(startSnap.lon, startSnap.lat, startLat, startLon);
    const endShoulderKey   = resolveShoulderKey(endSnap.lon, endSnap.lat, endLat, endLon);

    if (GISGeometry.getDistanceMeters(startSnap.lat, startSnap.lon, endSnap.lat, endSnap.lon) < 1) {
      return {
        pathCoords: [
          [startLon, startLat],
          startShoulderKey.split(',').map(Number) as [number, number],
          [endLon, endLat]
        ],
        isFallback: false,
        nodeToRoadSide
      };
    }

    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const settled = new Set<string>();

    const pq = new MinPriorityQueue<string>((key: string) => distances.get(key) ?? Infinity);

    for (const key of graph.keys()) {
      distances.set(key, Infinity);
      previous.set(key, null);
    }

    distances.set(startShoulderKey, 0);
    pq.enqueue(startShoulderKey);

    while (!pq.isEmpty()) {
      const minNode = pq.dequeue();
      if (minNode === null) break;
      const minDist = distances.get(minNode);
      if (minDist === undefined || minDist === Infinity) break;
      if (settled.has(minNode)) continue;

      if (minNode === endShoulderKey) break;

      settled.add(minNode);

      const neighbors = graph.get(minNode);
      if (neighbors) {
        for (const [neighbor, weight] of neighbors.entries()) {
          if (settled.has(neighbor)) continue;
          const alt = minDist + weight;
          if (alt < (distances.get(neighbor) ?? Infinity)) {
            distances.set(neighbor, alt);
            previous.set(neighbor, minNode);
            pq.enqueue(neighbor);
          }
        }
      }
    }

    const pathCoords: [number, number][] = [];
    let current: string | null = endShoulderKey;

    while (current !== null) {
      const [lon, lat] = current.split(',').map(Number);
      pathCoords.unshift([lon, lat]);
      current = previous.get(current) ?? null;
    }

    if (pathCoords.length <= 1) {
      return {
        pathCoords: [
          [startLon, startLat],
          startShoulderKey.split(',').map(Number) as [number, number],
          endShoulderKey.split(',').map(Number) as [number, number],
          [endLon, endLat],
        ],
        isFallback: true,
        nodeToRoadSide
      };
    }

    pathCoords.unshift([startLon, startLat]);
    pathCoords.push([endLon, endLat]);

    return { pathCoords, isFallback: false, nodeToRoadSide };
  }

  static snapToIntersectionIfClose(
    lat: number,
    lon: number,
    roads: RoadSegment[],
    thresholdMeters: number
  ): { lat: number; lon: number } {
    const graph = this.buildRoadGraph(roads);
    let bestIntersection: { lat: number; lon: number } | null = null;
    let minDistance = thresholdMeters;

    const centers = this.getRoundaboutCenters(roads);

    for (const [key, neighbors] of graph.entries()) {
      if (neighbors.size > 2) {
        const [vLon, vLat] = key.split(',').map(Number);



        const dist = GISGeometry.getDistanceMeters(lat, lon, vLat, vLon);
        if (dist < minDistance) {
          minDistance = dist;
          bestIntersection = { lat: vLat, lon: vLon };
        }
      }
    }

    return bestIntersection || { lat, lon };
  }

  /**
   * Identifies intersections, dead-ends, and branch points in the road network graph.
   */
  static buildRoadTopology(
    roads: RoadSegment[]
  ): {
    intersections: { lat: number; lon: number }[];
    deadEnds: { lat: number; lon: number }[];
    branchPoints: { lat: number; lon: number }[];
  } {
    const graph = this.buildRoadGraph(roads);
    const intersections: { lat: number; lon: number }[] = [];
    const deadEnds: { lat: number; lon: number }[] = [];
    const branchPoints: { lat: number; lon: number }[] = [];

    const edgeTypes = new Map<string, string>();
    for (const road of roads) {
      const type = road.highwayType || 'unknown';
      for (let i = 0; i < road.coordinates.length - 1; i++) {
        const p1 = road.coordinates[i];
        const p2 = road.coordinates[i + 1];
        const k1 = `${p1[0]},${p1[1]}|${p2[0]},${p2[1]}`;
        const k2 = `${p2[0]},${p2[1]}|${p1[0]},${p1[1]}`;
        edgeTypes.set(k1, type);
        edgeTypes.set(k2, type);
      }
    }

    for (const [key, neighbors] of graph.entries()) {
      const [lon, lat] = key.split(',').map(Number);
      const degree = neighbors.size;

      if (degree > 2) {
        intersections.push({ lat, lon });
      } else if (degree === 1) {
        deadEnds.push({ lat, lon });
      } else if (degree === 2) {
        const connectedRoads = new Set<string>();
        for (const neighborKey of neighbors.keys()) {
           const edgeKey = `${key}|${neighborKey}`;
           const type = edgeTypes.get(edgeKey);
           if (type) connectedRoads.add(type);
        }
        if (connectedRoads.size >= 2) {
          branchPoints.push({ lat, lon });
        }
      }
    }

    return { intersections, deadEnds, branchPoints };
  }

  /**
   * Snaps a point onto a specific road's geometry.
   */
  static snapPointToSegmentOnRoad(
    lon: number, lat: number, road: RoadSegment
  ): { lat: number; lon: number } | null {
    let minDist = Infinity;
    let bestSnap: { lat: number; lon: number } | null = null;

    for (let i = 0; i < road.coordinates.length - 1; i++) {
      const p1 = road.coordinates[i];
      const p2 = road.coordinates[i + 1];
      const snapped = GISGeometry.snapPointToSegmentAccurate(lon, lat, p1[0], p1[1], p2[0], p2[1]);
      const dist = GISGeometry.getDistanceMeters(lat, lon, snapped.lat, snapped.lon);
      if (dist < minDist) {
        minDist = dist;
        bestSnap = snapped;
      }
    }

    return bestSnap;
  }

  /**
   * Maps buildings to their nearest road segment using RBush spatial index.
   */
  static mapBuildingsToRoadSegments(
    buildings: Building[],
    roads: RoadSegment[]
  ): Map<number, number> {
    const mapping = new Map<number, number>();

    const roadIndex = new RBush<RoadIndexItem>();
    const items: RoadIndexItem[] = [];
    for (const road of roads) {
      for (let i = 0; i < road.coordinates.length - 1; i++) {
        const p1 = road.coordinates[i];
        const p2 = road.coordinates[i + 1];
        const minX = Math.min(p1[0], p2[0]);
        const maxX = Math.max(p1[0], p2[0]);
        const minY = Math.min(p1[1], p2[1]);
        const maxY = Math.max(p1[1], p2[1]);
        items.push({ minX, minY, maxX, maxY, roadId: road.id, p1, p2 });
      }
    }
    roadIndex.load(items);

    // Build a map of road segment structures by ID to look up types quickly
    const roadMap = new Map<number, RoadSegment>();
    for (const road of roads) {
      roadMap.set(road.id, road);
    }

    for (const building of buildings) {
      const latBuffer = 50 / 111320;
      const lonBuffer = 50 / (111320 * Math.cos(building.lat * Math.PI / 180));
      
      const searchBox = {
        minX: building.lon - lonBuffer,
        minY: building.lat - latBuffer,
        maxX: building.lon + lonBuffer,
        maxY: building.lat + latBuffer
      };
      
      const results = roadIndex.search(searchBox);
      let minDist = Infinity;
      let nearestRoadId = roads.length > 0 ? roads[0].id : -1;
      
      const candidates = results.length > 0 ? results : items;
      
      for (const item of candidates) {
        const snapped = this.snapPointToSegment(building.lon, building.lat, item.p1[0], item.p1[1], item.p2[0], item.p2[1]);
        const actualDist = GISGeometry.getDistanceMeters(building.lat, building.lon, snapped.lat, snapped.lon);

        const road = roadMap.get(item.roadId);
        const hwType = road?.highwayType ? road.highwayType.toLowerCase() : '';
        let multiplier = 1.0;
        if (hwType === 'trunk' || hwType === 'primary' || hwType === 'motorway' || hwType === 'secondary') {
          multiplier = 1.8; // Heavily penalize major roads for drop loops
        } else if (['residential', 'service', 'unclassified', 'tertiary'].includes(hwType)) {
          multiplier = 0.85; // Favor local residential/byroad streets
        }

        const scaledDist = actualDist * multiplier;
        if (scaledDist < minDist) {
          minDist = scaledDist;
          nearestRoadId = item.roadId;
        }
      }

      mapping.set(building.id, nearestRoadId);
    }

    return mapping;
  }
}
