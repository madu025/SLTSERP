import { PlannedCable, PlannedClosure, PlannedPole, RoadSegment } from './types';
import { GISGeometry } from './GISGeometry';
import { GISRoadNetwork } from './GISRoadNetwork';

export class GISPolePlacement {
  /**
   * Generates poles globally across the cable network using tree-walk BFS.
   */
  static generatePolesGlobally(
    cables: PlannedCable[],
    closures: PlannedClosure[],
    intervalMeters: number,
    roads?: RoadSegment[]
  ): PlannedPole[] {
    const poles: PlannedPole[] = [];
    let poleIndex = 1;

    // Identify road intersections and roundabout coordinates
    const intersections: { lat: number; lon: number }[] = [];
    const roundaboutPoints: { lat: number; lon: number }[] = [];

    if (roads && roads.length > 0) {
      try {
        const topo = GISRoadNetwork.buildRoadTopology(roads);
        intersections.push(...topo.intersections);

        for (const road of roads) {
          if (road.junction === 'roundabout' || road.highwayType === 'roundabout') {
            for (const coord of road.coordinates) {
              roundaboutPoints.push({ lat: coord[1], lon: coord[0] });
            }
          }
        }
      } catch (e) {
        console.error('[GISPolePlacement] Failed to build road topology for crossing check', e);
      }
    }

    const checkIsRoadCrossing = (lat: number, lon: number): boolean => {
      // If a pole is within 30m of intersections or roundabouts, it supports the crossing span
      for (const ix of intersections) {
        if (GISGeometry.getDistanceMeters(lat, lon, ix.lat, ix.lon) < 30) {
          return true;
        }
      }
      for (const rp of roundaboutPoints) {
        if (GISGeometry.getDistanceMeters(lat, lon, rp.lat, rp.lon) < 30) {
          return true;
        }
      }
      return false;
    };

    const addPole = (lat: number, lon: number): PlannedPole => {
      // Check if a pole already exists within 1.5m to prevent duplicates
      const existing = poles.find(p => GISGeometry.getDistanceMeters(lat, lon, p.latitude, p.longitude) < 1.5);
      if (existing) {
        return existing;
      }

      // Check if a closure exists within 1.5m to align the pole location exactly at the closure
      const closureNear = closures.find(c => GISGeometry.getDistanceMeters(lat, lon, c.latitude, c.longitude) < 1.5);
      if (closureNear) {
        lat = closureNear.latitude;
        lon = closureNear.longitude;
      }

      const isRoadCrossing = checkIsRoadCrossing(lat, lon);
      const pole = {
        index: poleIndex++,
        latitude: lat,
        longitude: lon,
        status: 'PLANNED' as const,
        poleType: 'CONCRETE' as const,
        height: isRoadCrossing ? 10 : 8, // Road crossings/intersection spans require 10m poles
      };
      poles.push(pole);
      return pole;
    };

    // Helper to calculate segment lengths
    const getPathLength = (path: [number, number][]): number => {
      let len = 0;
      for (let i = 0; i < path.length - 1; i++) {
        len += GISGeometry.getDistanceMeters(path[i][1], path[i][0], path[i+1][1], path[i+1][0]);
      }
      return len;
    };

    // Helper to simplify path coordinates
    const simplifyPath = (coords: [number, number][]): [number, number][] => {
      if (coords.length <= 2) return coords;
      const result: [number, number][] = [coords[0]];
      let prev = coords[0];
      
      for (let i = 1; i < coords.length - 1; i++) {
        const curr = coords[i];
        const next = coords[i + 1];
        
        const d = GISGeometry.getDistanceMeters(curr[1], curr[0], prev[1], prev[0]);
        
        const v1x = curr[0] - prev[0];
        const v1y = curr[1] - prev[1];
        const v2x = next[0] - curr[0];
        const v2y = next[1] - curr[1];
        const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
        
        let angleDeg = 0;
        if (len1 > 0 && len2 > 0) {
          const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
          angleDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
        }
        
        // Keep if it is a real bend (> 5 degrees) or if segment distance is substantial (> 25m)
        if (angleDeg > 5.0 || d > 25.0) {
          result.push(curr);
          prev = curr;
        }
      }
      result.push(coords[coords.length - 1]);
      return result;
    };

    // Place poles at closures/joints first
    for (const c of closures) {
      addPole(c.latitude, c.longitude);
    }

    // Process all non-drop cables
    for (const cab of cables) {
      if (cab.cableType === 'DROP') continue;
      const coords = cab.coordinates || [];
      if (coords.length < 2) continue;

      const simplified = simplifyPath(coords);
      const pathElements: [number, number][] = [];

      for (let i = 0; i < simplified.length - 1; i++) {
        const p1 = simplified[i];
        const p2 = simplified[i + 1];
        const segmentDist = GISGeometry.getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);

        // Place pole at segment start
        const p1Pole = addPole(p1[1], p1[0]);
        if (pathElements.length === 0 || GISGeometry.getDistanceMeters(pathElements[pathElements.length-1][1], pathElements[pathElements.length-1][0], p1Pole.latitude, p1Pole.longitude) > 0.1) {
          pathElements.push([p1Pole.longitude, p1Pole.latitude]);
        }

        // Place intermediate poles if spacing interval is exceeded
        if (segmentDist > intervalMeters) {
          const numPoles = Math.floor(segmentDist / intervalMeters);
          for (let k = 1; k <= numPoles; k++) {
            const ratio = (k * intervalMeters) / segmentDist;
            if (ratio * segmentDist < segmentDist - 8.0) {
              const poleLon = p1[0] + ratio * (p2[0] - p1[0]);
              const poleLat = p1[1] + ratio * (p2[1] - p1[1]);
              const intPole = addPole(poleLat, poleLon);
              pathElements.push([intPole.longitude, intPole.latitude]);
            }
          }
        }
      }

      // Ensure segment end has a pole
      const finalPt = simplified[simplified.length - 1];
      const finalPole = addPole(finalPt[1], finalPt[0]);
      if (GISGeometry.getDistanceMeters(pathElements[pathElements.length-1][1], pathElements[pathElements.length-1][0], finalPole.latitude, finalPole.longitude) > 0.1) {
        pathElements.push([finalPole.longitude, finalPole.latitude]);
      }

      // Set cable coordinates exactly to the pole sequence
      cab.coordinates = pathElements;
      cab.length = getPathLength(pathElements);
    }

    return poles;
  }

  /**
   * Legacy segment-based interpolation helper.
   */
  static interpolatePoles(coords: [number, number][], intervalMeters: number, startIdx: number): PlannedPole[] {
    const poles: PlannedPole[] = [];
    let idx = startIdx;
    let accumulatedDistance = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const segmentDist = GISGeometry.getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);

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

      accumulatedDistance = 0;
    }

    return poles;
  }
}
