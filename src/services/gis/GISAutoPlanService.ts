
interface OSMNode {
  id: number;
  lat: number;
  lon: number;
}

interface OSMWay {
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

interface Building {
  id: number;
  lat: number;
  lon: number;
  isMDU: boolean;
  name: string;
}

interface RoadSegment {
  id: number;
  coordinates: [number, number][]; // [lon, lat]
}

export interface PlannedPole {
  index: number;
  latitude: number;
  longitude: number;
  status: 'PLANNED';
  poleType: 'CONCRETE';
  height: number;
}

export interface PlannedClosure {
  index: number;
  closureType: 'TERMINAL' | 'DOME';
  latitude: number;
  longitude: number;
  capacity: number;
  status: 'PLANNED';
  notes: string;
}

export interface PlannedCable {
  index: number;
  length: number;
  coordinates: [number, number][]; // [lon, lat]
  status: 'PLANNED';
  cableType: 'ADSS';
  fiberCount: number;
}

export interface AutoPlanResult {
  poles: PlannedPole[];
  closures: PlannedClosure[];
  cables: PlannedCable[];
  summary: {
    totalBuildings: number;
    mduCount: number;
    sduCount: number;
    fdpCount: number;
    poleCount: number;
    totalCableLength: number;
  };
}

export class GISAutoPlanService {
  /**
   * Main planning coordinator.
   */
  static async generatePlan(
    polygon: [number, number][],
    overpassData: unknown,
    customClosures?: PlannedClosure[]
  ): Promise<AutoPlanResult> {
    const { nodes, ways } = this.parseOverpassElements(overpassData);
    
    // 2. Process road network
    const roads = this.extractRoads(nodes, ways);

    const plannedClosures: PlannedClosure[] = [];
    const plannedPoles: PlannedPole[] = [];
    const plannedCables: PlannedCable[] = [];

    let poleIndex = 1;
    let cableIndex = 1;

    let buildingsCount = 0;
    let mduCount = 0;
    let sduCount = 0;

    if (customClosures && customClosures.length > 0) {
      plannedClosures.push(...customClosures);
    } else {
      // 1. Process buildings
      const buildings = this.extractBuildings(nodes, ways);
      buildingsCount = buildings.length;
      const mdus = buildings.filter(b => b.isMDU);
      mduCount = mdus.length;
      const sdus = buildings.filter(b => !b.isMDU);
      sduCount = sdus.length;

      // 3. Cluster SDUs (Max 8 per FDP)
      const sduClusters = this.clusterSDUs(sdus, 100); // 100m max radius

      let closureIndex = 1;

      // 4. Place FDPs for MDUs (Dedicated FDPs)
      for (const mdu of mdus) {
        const snapped = this.snapToNearestRoad(mdu.lat, mdu.lon, roads);
        plannedClosures.push({
          index: closureIndex++,
          closureType: 'TERMINAL',
          latitude: snapped.lat,
          longitude: snapped.lon,
          capacity: 16, // MDUs get larger capacity
          status: 'PLANNED',
          notes: `Dedicated FDP for MDU: ${mdu.name || 'Apartment/School'}. +20m slack.`,
        });
      }

      // 5. Place FDPs for SDU clusters
      for (const cluster of sduClusters) {
        const centroid = this.calculateCentroid(cluster);
        const snapped = this.snapToNearestRoad(centroid.lat, centroid.lon, roads);
        plannedClosures.push({
          index: closureIndex++,
          closureType: 'TERMINAL',
          latitude: snapped.lat,
          longitude: snapped.lon,
          capacity: 8, // Standard 1:8 FDP
          status: 'PLANNED',
          notes: `FDP serving ${cluster.length} homes.`,
        });
      }
    }

    // 6. Connect FDPs to generate Cable paths and place Poles
    if (plannedClosures.length > 0) {
      // Connect closures in a simple Minimum Spanning Tree / nearest-neighbor path
      const sortedClosures = [...plannedClosures];
      
      for (let i = 0; i < sortedClosures.length - 1; i++) {
        const start = sortedClosures[i];
        const end = sortedClosures[i + 1];

        // Find road route between them using Dijkstra algorithm
        const pathCoords = this.findRoadPath(start.latitude, start.longitude, end.latitude, end.longitude, roads);
        const length = this.calculatePathLength(pathCoords);

        plannedCables.push({
          index: cableIndex++,
          length,
          coordinates: pathCoords,
          status: 'PLANNED',
          cableType: 'ADSS',
          fiberCount: 12,
        });

        // Place poles along this path every 35-40m (target: 38m)
        const segmentPoles = this.interpolatePoles(pathCoords, 38, poleIndex);
        plannedPoles.push(...segmentPoles);
        poleIndex += segmentPoles.length;
      }
    }

    const totalCableLength = plannedCables.reduce((acc, c) => acc + c.length, 0);

    return {
      poles: plannedPoles,
      closures: plannedClosures,
      cables: plannedCables,
      summary: {
        totalBuildings: buildingsCount,
        mduCount,
        sduCount,
        fdpCount: plannedClosures.length,
        poleCount: plannedPoles.length,
        totalCableLength,
      }
    };
  }

  private static parseOverpassElements(data: unknown) {
    const nodes = new Map<number, OSMNode>();
    const ways: OSMWay[] = [];

    const raw = data as { elements?: { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string> }[] } | null | undefined;
    if (raw && Array.isArray(raw.elements)) {
      for (const el of raw.elements) {
        if (el && el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
          nodes.set(el.id, { id: el.id, lat: el.lat, lon: el.lon });
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

  private static extractBuildings(nodes: Map<number, OSMNode>, ways: OSMWay[]): Building[] {
    const buildings: Building[] = [];

    for (const way of ways) {
      if (way.tags && way.tags.building) {
        // Calculate centroid of the building
        let sumLat = 0;
        let sumLon = 0;
        let validCount = 0;

        for (const nodeId of way.nodes) {
          const node = nodes.get(nodeId);
          if (node) {
            sumLat += node.lat;
            sumLon += node.lon;
            validCount++;
          }
        }

        if (validCount > 0) {
          const lat = sumLat / validCount;
          const lon = sumLon / validCount;

          const levels = parseInt(way.tags['building:levels'] || '1', 10);
          const isMDU =
            levels >= 4 ||
            way.tags.building === 'apartments' ||
            way.tags.building === 'school' ||
            way.tags.building === 'hospital' ||
            way.tags.building === 'commercial' ||
            way.tags.amenity === 'school' ||
            way.tags.amenity === 'hospital';

          const name = way.tags.name || way.tags['addr:housename'] || '';

          buildings.push({
            id: way.id,
            lat,
            lon,
            isMDU,
            name,
          });
        }
      }
    }

    return buildings;
  }

  private static extractRoads(nodes: Map<number, OSMNode>, ways: OSMWay[]): RoadSegment[] {
    const roads: RoadSegment[] = [];

    for (const way of ways) {
      if (way.tags && way.tags.highway) {
        const coords: [number, number][] = [];
        for (const nodeId of way.nodes) {
          const node = nodes.get(nodeId);
          if (node) {
            coords.push([node.lon, node.lat]);
          }
        }

        if (coords.length >= 2) {
          roads.push({
            id: way.id,
            coordinates: coords,
          });
        }
      }
    }

    return roads;
  }

  private static clusterSDUs(sdus: Building[], maxDistanceMeters: number): Building[][] {
    const clusters: Building[][] = [];
    const visited = new Set<number>();

    for (const sdu of sdus) {
      if (visited.has(sdu.id)) continue;

      // Start a new cluster
      const cluster: Building[] = [sdu];
      visited.add(sdu.id);

      // Find nearest SDU neighbors
      while (cluster.length < 8) {
        let bestNeighbor: Building | null = null;
        let bestDist = Infinity;

        // Compute distances from centroid of the current cluster
        const centroid = this.calculateCentroid(cluster);

        for (const candidate of sdus) {
          if (visited.has(candidate.id)) continue;

          const dist = this.getDistanceMeters(centroid.lat, centroid.lon, candidate.lat, candidate.lon);
          if (dist < maxDistanceMeters && dist < bestDist) {
            bestDist = dist;
            bestNeighbor = candidate;
          }
        }

        if (bestNeighbor) {
          cluster.push(bestNeighbor);
          visited.add(bestNeighbor.id);
        } else {
          break; // No more neighbors within max distance range
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  private static calculateCentroid(points: { lat: number; lon: number }[]): { lat: number; lon: number } {
    let sumLat = 0;
    let sumLon = 0;
    for (const pt of points) {
      sumLat += pt.lat;
      sumLon += pt.lon;
    }
    return {
      lat: sumLat / points.length,
      lon: sumLon / points.length,
    };
  }

  private static snapToNearestRoad(lat: number, lon: number, roads: RoadSegment[]): { lat: number; lon: number } {
    let minDistance = Infinity;
    let snappedLat = lat;
    let snappedLon = lon;

    for (const road of roads) {
      for (let i = 0; i < road.coordinates.length - 1; i++) {
        const p1 = road.coordinates[i];
        const p2 = road.coordinates[i + 1];

        const snapped = this.snapPointToSegment(lon, lat, p1[0], p1[1], p2[0], p2[1]);
        const dist = this.getDistanceMeters(lat, lon, snapped.lat, snapped.lon);

        if (dist < minDistance) {
          minDistance = dist;
          snappedLat = snapped.lat;
          snappedLon = snapped.lon;
        }
      }
    }

    return { lat: snappedLat, lon: snappedLon };
  }

  private static snapPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
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

  private static findRoadPath(
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    roads: RoadSegment[]
  ): [number, number][] {
    return this.dijkstraRoute(startLat, startLon, endLat, endLon, roads);
  }

  private static calculatePathLength(coords: [number, number][]): number {
    let length = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      length += this.getDistanceMeters(
        coords[i][1],
        coords[i][0],
        coords[i + 1][1],
        coords[i + 1][0]
      );
    }
    return length;
  }

  private static interpolatePoles(coords: [number, number][], intervalMeters: number, startIdx: number): PlannedPole[] {
    const poles: PlannedPole[] = [];
    let idx = startIdx;
    let accumulatedDistance = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const segmentDist = this.getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);

      let t = 0;
      while (accumulatedDistance + intervalMeters <= segmentDist) {
        accumulatedDistance += intervalMeters;
        t = accumulatedDistance / segmentDist;

        const poleLon = p1[0] + t * (p2[0] - p1[0]);
        const poleLat = p1[1] + t * (p2[1] - p1[1]);

        poles.push({
          index: idx++,
          latitude: poleLat,
          longitude: poleLon,
          status: 'PLANNED',
          poleType: 'CONCRETE',
          height: 9,
        });
      }

      accumulatedDistance = 0; // reset for next segment
    }

    return poles;
  }

  private static getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private static buildRoadGraph(roads: RoadSegment[]): Map<string, Map<string, number>> {
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
        const weight = this.getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);
        addEdge(u, v, weight);
      }
    }

    return graph;
  }

  private static findClosestVertex(lon: number, lat: number, graph: Map<string, Map<string, number>>): string | null {
    let closestKey: string | null = null;
    let minDist = Infinity;

    for (const key of graph.keys()) {
      const [vLon, vLat] = key.split(',').map(Number);
      const dist = this.getDistanceMeters(lat, lon, vLat, vLon);
      if (dist < minDist) {
        minDist = dist;
        closestKey = key;
      }
    }

    return closestKey;
  }

  private static dijkstraRoute(
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    roads: RoadSegment[]
  ): [number, number][] {
    const graph = this.buildRoadGraph(roads);
    if (graph.size === 0) {
      return [[startLon, startLat], [endLon, endLat]];
    }

    const startSnap = this.snapToNearestRoad(startLat, startLon, roads);
    const endSnap = this.snapToNearestRoad(endLat, endLon, roads);

    const startNode = this.findClosestVertex(startSnap.lon, startSnap.lat, graph);
    const endNode = this.findClosestVertex(endSnap.lon, endSnap.lat, graph);

    if (!startNode || !endNode || startNode === endNode) {
      return [
        [startLon, startLat],
        [startSnap.lon, startSnap.lat],
        [endSnap.lon, endSnap.lat],
        [endLon, endLat],
      ];
    }

    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const queue = new Set<string>();

    for (const key of graph.keys()) {
      distances.set(key, Infinity);
      previous.set(key, null);
      queue.add(key);
    }

    distances.set(startNode, 0);

    while (queue.size > 0) {
      let minNode: string | null = null;
      let minDist = Infinity;

      for (const node of queue) {
        const dist = distances.get(node) ?? Infinity;
        if (dist < minDist) {
          minDist = dist;
          minNode = node;
        }
      }

      if (!minNode || minNode === endNode || distances.get(minNode) === Infinity) {
        break;
      }

      queue.delete(minNode);

      const neighbors = graph.get(minNode);
      if (neighbors) {
        for (const [neighbor, weight] of neighbors.entries()) {
          if (!queue.has(neighbor)) continue;
          const alt = (distances.get(minNode) ?? 0) + weight;
          if (alt < (distances.get(neighbor) ?? Infinity)) {
            distances.set(neighbor, alt);
            previous.set(neighbor, minNode);
          }
        }
      }
    }

    const pathCoords: [number, number][] = [];
    let current: string | null = endNode;

    while (current !== null) {
      const [lon, lat] = current.split(',').map(Number);
      pathCoords.unshift([lon, lat]);
      current = previous.get(current) ?? null;
    }

    if (pathCoords.length <= 1) {
      return [
        [startLon, startLat],
        [startSnap.lon, startSnap.lat],
        [endSnap.lon, endSnap.lat],
        [endLon, endLat],
      ];
    }

    pathCoords.unshift([startLon, startLat]);
    pathCoords.push([endLon, endLat]);

    return pathCoords;
  }
}
