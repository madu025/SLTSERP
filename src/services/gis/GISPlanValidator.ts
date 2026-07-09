import { PlannedCable, PlannedClosure, PlannedPole, RoadSegment } from './types';
import { GISGeometry } from './GISGeometry';
import { GISRoadNetwork } from './GISRoadNetwork';

export class GISPlanValidator {
  /**
   * Evaluates the planned route elements against OSP engineering standards.
   * Returns a quality report and score from 0 to 100.
   */
  static validate(
    cables: PlannedCable[],
    closures: PlannedClosure[],
    poles: PlannedPole[],
    roads: RoadSegment[]
  ): {
    score: number;
    violations: string[];
  } {
    const violations: string[] = [];
    let score = 100;

    // Gather road details
    const majorRoads = roads.filter(
      r => r.highwayType === 'motorway' || r.highwayType === 'trunk' || r.highwayType === 'primary' || r.highwayType === 'secondary' || (r.lanes && r.lanes >= 4)
    );
    
    // Group roundabout points and find center
    const roundaboutPoints: { lat: number; lon: number }[] = [];
    let rLatSum = 0;
    let rLonSum = 0;
    for (const r of roads) {
      if (r.junction === 'roundabout' || r.highwayType === 'roundabout') {
        for (const coord of r.coordinates) {
          roundaboutPoints.push({ lat: coord[1], lon: coord[0] });
          rLatSum += coord[1];
          rLonSum += coord[0];
        }
      }
    }
    const hasRoundabout = roundaboutPoints.length > 0;
    const roundaboutCenter = hasRoundabout
      ? { lat: rLatSum / roundaboutPoints.length, lon: rLonSum / roundaboutPoints.length }
      : null;

    // Detect centerline intersections (vertices shared by >=2 segments)
    const coordCounts = new Map<string, number>();
    for (const road of roads) {
      for (const coord of road.coordinates) {
        const key = `${coord[0].toFixed(5)},${coord[1].toFixed(5)}`;
        coordCounts.set(key, (coordCounts.get(key) || 0) + 1);
      }
    }
    const intersections = new Set<string>();
    for (const [key, count] of coordCounts.entries()) {
      if (count >= 2) {
        intersections.add(key);
      }
    }

    // 1. Centerline & Roundabout Violation Check for Poles
    for (const p of poles) {
      let isCenterlineViolation = false;
      let hasValidShoulderOffset = false;

      for (const road of roads) {
        for (let i = 0; i < road.coordinates.length - 1; i++) {
          const p1 = road.coordinates[i];
          const p2 = road.coordinates[i + 1];
          const snapped = this.snapPointToSegment(p.longitude, p.latitude, p1[0], p1[1], p2[0], p2[1]);
          const dist = GISGeometry.getDistanceMeters(p.latitude, p.longitude, snapped.lat, snapped.lon);
          
          if (dist < 1.0) {
            // Exclude junction zones within 12m of an intersection (clears intersection areas)
            let nearIntersection = false;
            for (const key of intersections) {
              const [intLon, intLat] = key.split(',').map(Number);
              if (GISGeometry.getDistanceMeters(snapped.lat, snapped.lon, intLat, intLon) < 12.0) {
                nearIntersection = true;
                break;
              }
            }
            if (!nearIntersection) {
              isCenterlineViolation = true;
            }
          }

          if (dist >= 2.5 && dist <= 8.5) {
            hasValidShoulderOffset = true;
          }
        }
      }

      if (isCenterlineViolation && !hasValidShoulderOffset) {
        violations.push(`Pole P-${p.index} is placed on road centerline (violates utility corridor).`);
        score -= 20;
      }

      // Check if pole is inside roundabout center island
      if (roundaboutCenter) {
        let nearestRP: { lat: number; lon: number } | null = null;
        let minRDist = Infinity;
        for (const rp of roundaboutPoints) {
          const dist = GISGeometry.getDistanceMeters(p.latitude, p.longitude, rp.lat, rp.lon);
          if (dist < minRDist) {
            minRDist = dist;
            nearestRP = rp;
          }
        }

        if (nearestRP && minRDist < 15.0) {
          const poleToCenter = GISGeometry.getDistanceMeters(p.latitude, p.longitude, roundaboutCenter.lat, roundaboutCenter.lon);
          const rpToCenter = GISGeometry.getDistanceMeters(nearestRP.lat, nearestRP.lon, roundaboutCenter.lat, roundaboutCenter.lon);
          // If pole is closer to the roundabout center than the road centerline, it is inside the island
          if (poleToCenter < rpToCenter - 1.5) {
            violations.push(`Pole P-${p.index} is inside the roundabout center island.`);
            score -= 30;
          }
        }
      }
    }

    // 2. Unsafe Spans Check (only for main/distribution cables)
    for (const cb of cables) {
      if (cb.cableType === 'DROP') continue;

      const coords = cb.coordinates || [];
      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const dist = GISGeometry.getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);
        if (dist > 45.0) {
          let crossesMajorRoad = false;
          const midLon = (p1[0] + p2[0]) / 2;
          const midLat = (p1[1] + p2[1]) / 2;
          for (const mr of majorRoads) {
            for (let j = 0; j < mr.coordinates.length - 1; j++) {
              const rp1 = mr.coordinates[j];
              const rp2 = mr.coordinates[j + 1];
              const snapped = this.snapPointToSegment(midLon, midLat, rp1[0], rp1[1], rp2[0], rp2[1]);
              const snapDist = GISGeometry.getDistanceMeters(midLat, midLon, snapped.lat, snapped.lon);
              if (snapDist < 8.0) {
                crossesMajorRoad = true;
                break;
              }
            }
            if (crossesMajorRoad) break;
          }

          if (!crossesMajorRoad) {
            violations.push(`Cable segment ${cb.index} has an unsafe span of ${dist.toFixed(1)}m (exceeds 45m limit).`);
            score -= 15;
          } else if (dist > 55.0) {
            violations.push(`Cable segment ${cb.index} has an excessive major crossing span of ${dist.toFixed(1)}m (exceeds 55m limit).`);
            score -= 25;
          }
        }
      }
    }

    // 3. Road Crossing & Shoulder Swap Checks (only for main/distribution cables)
    const crossings: { lat: number; lon: number }[] = [];

    for (const cb of cables) {
      if (cb.cableType === 'DROP') continue;

      const coords = cb.coordinates || [];
      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];

        let segmentCrosses = false;
        let midLat = 0;
        let midLon = 0;

        for (const mr of majorRoads) {
          for (let j = 0; j < mr.coordinates.length - 1; j++) {
            const rp1 = mr.coordinates[j];
            const rp2 = mr.coordinates[j + 1];
            if (this.intersects(p1[0], p1[1], p2[0], p2[1], rp1[0], rp1[1], rp2[0], rp2[1])) {
              const dx1 = p2[0] - p1[0];
              const dy1 = p2[1] - p1[1];
              const dx2 = rp2[0] - rp1[0];
              const dy2 = rp2[1] - rp1[1];
              
              const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
              const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
              
              let isParallel = false;
              if (len1 > 0 && len2 > 0) {
                const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
                if (Math.abs(dot) > 0.95) { // Skip parallel shoulder runs
                  isParallel = true;
                }
              }
              if (!isParallel) {
                segmentCrosses = true;
                midLon = (p1[0] + p2[0]) / 2;
                midLat = (p1[1] + p2[1]) / 2;
                break;
              }
            }
          }
          if (segmentCrosses) break;
        }

        if (segmentCrosses) {
          // Check if it's near an intersection (valid crossing)
          let nearIntersection = false;
          // Better: in GISPlanValidator.ts, we can just use GISRoadNetwork.buildRoadTopology
          const { intersections } = GISRoadNetwork.buildRoadTopology(roads);
          for (const ix of intersections) {
            if (GISGeometry.getDistanceMeters(midLat, midLon, ix.lat, ix.lon) < 15.0) {
              nearIntersection = true;
              break;
            }
          }

          if (nearIntersection) {
            segmentCrosses = false; // Forgive it!
          }
        }

        if (segmentCrosses) {
          // Check if we already registered a physical crossing zone within 50m
          const alreadyExists = crossings.some(c => 
            GISGeometry.getDistanceMeters(midLat, midLon, c.lat, c.lon) < 50.0
          );
          if (!alreadyExists) {
            crossings.push({ lat: midLat, lon: midLon });
          }
        }
      }
    }

    const majorCrossingCount = crossings.length;

    if (majorCrossingCount > 6) {
      violations.push(`Excessive major road crossings detected (${majorCrossingCount} crossings).`);
      score -= 25;
    }

    // 4. Drop Cable Major Road Crossing Check
    // Drop cables are strictly prohibited from crossing major roads.
    // Any such crossing is a violation that must be resolved via manual QField survey.
    let dropMajorCrossingCount = 0;
    for (const cb of cables) {
      if (cb.cableType !== 'DROP') continue;
      const coords = cb.coordinates || [];
      if (coords.length < 2) continue;

      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];

        let crossesMajorRoad = false;
        for (const mr of majorRoads) {
          for (let j = 0; j < mr.coordinates.length - 1; j++) {
            const rp1 = mr.coordinates[j];
            const rp2 = mr.coordinates[j + 1];
            if (this.intersects(p1[0], p1[1], p2[0], p2[1], rp1[0], rp1[1], rp2[0], rp2[1])) {
              // Skip parallel overlaps (should not be possible for drop cables, but guard anyway)
              const dx1 = p2[0] - p1[0];
              const dy1 = p2[1] - p1[1];
              const dx2 = rp2[0] - rp1[0];
              const dy2 = rp2[1] - rp1[1];
              const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
              const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
              if (len1 > 0 && len2 > 0) {
                const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
                if (Math.abs(dot) < 0.95) {
                  crossesMajorRoad = true;
                  break;
                }
              }
            }
          }
          if (crossesMajorRoad) break;
        }

        if (crossesMajorRoad) {
          dropMajorCrossingCount++;
          violations.push(
            `Drop cable D-${cb.index} crosses Major Road — strictly forbidden. ` +
            `Manual QField survey required to re-route this connection to a DP on the same side of the road.`
          );
          score -= 25;
          break; // Report each drop cable only once
        }
      }
    }

    if (dropMajorCrossingCount > 0) {
      violations.unshift(
        `CRITICAL: ${dropMajorCrossingCount} drop cable(s) cross a major road. ` +
        `These must be resolved via manual field survey before construction.`
      );
    }

    // 5. Drop Cable Span Length Check
    // Standard drop spans must not exceed 35 meters.
    let excessiveDropSpanCount = 0;
    for (const cb of cables) {
      if (cb.cableType !== 'DROP') continue;
      const coords = cb.coordinates || [];
      if (coords.length < 2) continue;

      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const dist = GISGeometry.getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);
        if (dist > 35.0) {
          excessiveDropSpanCount++;
          violations.push(
            `Drop cable D-${cb.index} has an excessive span of ${dist.toFixed(1)}m (exceeds 35m limit).`
          );
          score -= 10;
          break; // Report each drop cable only once
        }
      }
    }

    // Lock score to [0, 100]
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      violations: Array.from(new Set(violations))
    };
  }

  private static snapPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) return { lat: y1, lon: x1 };
    const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    const clampedT = Math.max(0, Math.min(1, t));
    return {
      lon: x1 + clampedT * dx,
      lat: y1 + clampedT * dy,
    };
  }

  private static intersects(
    a1x: number, a1y: number, a2x: number, a2y: number,
    b1x: number, b1y: number, b2x: number, b2y: number
  ): boolean {
    const det = (a2x - a1x) * (b2y - b1y) - (b2x - b1x) * (a2y - a1y);
    if (det === 0) return false; // Parallel
    const lambda = ((b2y - b1y) * (b2x - a1x) + (b1x - b2x) * (b2y - a1y)) / det;
    const gamma = ((a1y - a2y) * (b2x - a1x) + (a2x - a1x) * (b2y - a1y)) / det;
    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
  }
}
