import RBush from 'rbush';
import { RoadSegment, Building, PlannedClosure, CandidateDP, BuildingIndexItem, ROAD_PRIORITY, SERVICE_RADIUS, MIN_DP_SPACING, MAX_BUILDINGS_PER_DP } from './types';
import { GISGeometry } from './GISGeometry';
import { GISRoadNetwork } from './GISRoadNetwork';

export class GISCandidateScoring {
  /**
   * Generates candidate DP locations along roads at density-adaptive sampling intervals.
   */
  static generateCandidates(
    roads: RoadSegment[],
    polygon: [number, number][],
    buildings: Building[],
    buildingToRoad: Map<number, number>,
    intersections: { lat: number; lon: number }[],
    existingClosures: PlannedClosure[]
  ): CandidateDP[] {
    const candidates: CandidateDP[] = [];

    const buildingsPerRoad = new Map<number, Building[]>();
    for (const b of buildings) {
      const roadId = buildingToRoad.get(b.id);
      if (roadId !== undefined && roadId >= 0) {
        if (!buildingsPerRoad.has(roadId)) buildingsPerRoad.set(roadId, []);
        buildingsPerRoad.get(roadId)!.push(b);
      }
    }

    for (const road of roads) {
      const highwayType = road.highwayType || 'unclassified';
      const priority = ROAD_PRIORITY[highwayType] ?? 2;

      const roadBuildings = buildingsPerRoad.get(road.id) || [];
      if (priority <= 0 && roadBuildings.length === 0) continue;

      const coordsInside = road.coordinates.filter(coord => 
        GISGeometry.isPointInPolygon(coord, polygon) ||
        polygon.some(pt => GISGeometry.getDistanceMeters(coord[1], coord[0], pt[1], pt[0]) < 50.0)
      );
      if (coordsInside.length < 2) continue;

      let roadLength = 0;
      for (let i = 0; i < coordsInside.length - 1; i++) {
        roadLength += GISGeometry.getDistanceMeters(
          coordsInside[i][1], coordsInside[i][0],
          coordsInside[i + 1][1], coordsInside[i + 1][0]
        );
      }

      const density = roadLength > 0 ? roadBuildings.length / (roadLength / 100) : 0;
      let sampleInterval = 60;

      if (density > 8) sampleInterval = 25;
      else if (density > 5) sampleInterval = 35;
      else if (density > 3) sampleInterval = 45;
      else if (density > 1) sampleInterval = 55;

      const forcedPoints = new Set<string>();

      forcedPoints.add(`${coordsInside[0][0]},${coordsInside[0][1]}`);
      forcedPoints.add(`${coordsInside[coordsInside.length - 1][0]},${coordsInside[coordsInside.length - 1][1]}`);

      for (const ix of intersections) {
        const snapped = GISRoadNetwork.snapPointToSegmentOnRoad(ix.lon, ix.lat, road);
        if (snapped) {
          forcedPoints.add(`${snapped.lon},${snapped.lat}`);
        }
      }

      for (let currentDist = sampleInterval; currentDist < roadLength; currentDist += sampleInterval) {
        let walked = 0;
        for (let i = 0; i < coordsInside.length - 1; i++) {
          const p1 = coordsInside[i];
          const p2 = coordsInside[i + 1];
          const segDist = GISGeometry.getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);
          if (segDist === 0) continue;

          if (walked + segDist >= currentDist) {
            const remaining = currentDist - walked;
            const t = segDist > 0 ? remaining / segDist : 0;
            const lon = p1[0] + t * (p2[0] - p1[0]);
            const lat = p1[1] + t * (p2[1] - p1[1]);

            const key = `${lon},${lat}`;
            if (!forcedPoints.has(key)) {
              const isMajor = highwayType === 'motorway' || highwayType === 'trunk' || highwayType === 'primary' || highwayType === 'secondary' || (road.lanes !== undefined && road.lanes >= 4);
              if (isMajor) {
                const leftCoord = GISRoadNetwork.getNodeOffsetCoordinate(lon, lat, 'LEFT', roads);
                const rightCoord = GISRoadNetwork.getNodeOffsetCoordinate(lon, lat, 'RIGHT', roads);
                
                candidates.push({
                  lat: leftCoord[1], lon: leftCoord[0], roadId: road.id, highwayType, score: 0,
                  density: 0, connectivity: 0, accessibility: 0,
                  overlapPenalty: 0, cablePenalty: 0,
                });
                
                candidates.push({
                  lat: rightCoord[1], lon: rightCoord[0], roadId: road.id, highwayType, score: 0,
                  density: 0, connectivity: 0, accessibility: 0,
                  overlapPenalty: 0, cablePenalty: 0,
                });
              } else {
                candidates.push({
                  lat, lon, roadId: road.id, highwayType, score: 0,
                  density: 0, connectivity: 0, accessibility: 0,
                  overlapPenalty: 0, cablePenalty: 0,
                });
              }
            }
            break;
          }
          walked += segDist;
        }
      }

      for (const fp of forcedPoints) {
        const [lon, lat] = fp.split(',').map(Number);
        let tooClose = false;
        for (const ec of existingClosures) {
          if (GISGeometry.getDistanceMeters(lat, lon, ec.latitude, ec.longitude) < MIN_DP_SPACING / 2) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          const isMajor = highwayType === 'motorway' || highwayType === 'trunk' || highwayType === 'primary' || highwayType === 'secondary' || (road.lanes !== undefined && road.lanes >= 4);
          if (isMajor) {
            const leftCoord = GISRoadNetwork.getNodeOffsetCoordinate(lon, lat, 'LEFT', roads);
            const rightCoord = GISRoadNetwork.getNodeOffsetCoordinate(lon, lat, 'RIGHT', roads);
            
            candidates.push({
              lat: leftCoord[1], lon: leftCoord[0], roadId: road.id, highwayType, score: 0,
              density: 0, connectivity: 0, accessibility: 0,
              overlapPenalty: 0, cablePenalty: 0,
            });
            
            candidates.push({
              lat: rightCoord[1], lon: rightCoord[0], roadId: road.id, highwayType, score: 0,
              density: 0, connectivity: 0, accessibility: 0,
              overlapPenalty: 0, cablePenalty: 0,
            });
          } else {
            candidates.push({
              lat, lon, roadId: road.id, highwayType, score: 0,
              density: 0, connectivity: 0, accessibility: 0,
              overlapPenalty: 0, cablePenalty: 0,
            });
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Scores all candidates according to multi-criteria parameters.
   */
  static scoreCandidates(
    candidates: CandidateDP[],
    _buildings: Building[],
    allBuildings: Building[],
    intersections: { lat: number; lon: number }[],
    existingClosures: PlannedClosure[],
    roads: RoadSegment[]
  ): CandidateDP[] {
    const roadById = new Map<number, RoadSegment>();
    for (const road of roads) {
      roadById.set(road.id, road);
    }
    
    const buildingIndex = new RBush<BuildingIndexItem>();
    const bItems: BuildingIndexItem[] = allBuildings.map(b => ({
       minX: b.lon, minY: b.lat, maxX: b.lon, maxY: b.lat, building: b
    }));
    buildingIndex.load(bItems);

    for (const candidate of candidates) {
      const latBuf = SERVICE_RADIUS / 111320;
      const lonBuf = SERVICE_RADIUS / (111320 * Math.cos(candidate.lat * Math.PI / 180));
      const box = { minX: candidate.lon - lonBuf, minY: candidate.lat - latBuf, maxX: candidate.lon + lonBuf, maxY: candidate.lat + latBuf };
      const nearby = buildingIndex.search(box);
      
      let buildingsInRange = 0;
      let totalCableDist = 0;
      for (const item of nearby) {
        const b = item.building;
        const d = GISGeometry.getDistanceMeters(b.lat, b.lon, candidate.lat, candidate.lon);
        if (d <= SERVICE_RADIUS) {
          buildingsInRange++;
          totalCableDist += d;
        }
      }
      
      candidate.density = Math.min(buildingsInRange / MAX_BUILDINGS_PER_DP, 1);

      let minIntersectionDist = Infinity;
      for (const ix of intersections) {
        const d = GISGeometry.getDistanceMeters(candidate.lat, candidate.lon, ix.lat, ix.lon);
        if (d < minIntersectionDist) minIntersectionDist = d;
      }
      candidate.connectivity = minIntersectionDist < 80 ? 1 : Math.max(0, 1 - (minIntersectionDist - 80) / 200);

      const road = roadById.get(candidate.roadId);
      let majorRoadPenalty = 0;
      if (road) {
        const priority = ROAD_PRIORITY[road.highwayType || 'unclassified'] ?? 2;
        candidate.accessibility = Math.max(0, priority / 5);
        
        const lower = road.highwayType ? road.highwayType.toLowerCase() : '';
        const isMajor = lower === 'motorway' || lower === 'trunk' || lower === 'primary' || (road.lanes !== undefined && road.lanes > 2);
        if (isMajor) {
          majorRoadPenalty = 0.8;
        }
      } else {
        candidate.accessibility = 0.5;
      }

      let minExistingDist = Infinity;
      for (const ec of existingClosures) {
        const d = GISGeometry.getDistanceMeters(candidate.lat, candidate.lon, ec.latitude, ec.longitude);
        if (d < minExistingDist) minExistingDist = d;
      }
      candidate.overlapPenalty = minExistingDist < MIN_DP_SPACING ? 1 : Math.max(0, 1 - (minExistingDist - MIN_DP_SPACING) / 50);

      const avgCableDist = buildingsInRange > 0 ? totalCableDist / buildingsInRange : SERVICE_RADIUS;
      candidate.cablePenalty = Math.min(avgCableDist / SERVICE_RADIUS, 1);

      // Heavily weigh Cable Penalty to force DPs right next to buildings (avoid empty parks)
      const wDensity = 0.35, wConnectivity = 0.10, wAccessibility = 0.15, wOverlap = 0.10, wCable = 0.30;
      candidate.score = Math.max(0, Math.min(1, 
        wDensity * candidate.density +
        wConnectivity * candidate.connectivity +
        wAccessibility * candidate.accessibility -
        wOverlap * candidate.overlapPenalty -
        wCable * candidate.cablePenalty -
        majorRoadPenalty
      ));
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  /**
   * Evaluates coverage gaps iteratively and places new DPs greedily.
   */
  static validateCoverageGaps(
    placedDPs: { lat: number; lon: number; notes: string }[],
    uncoveredSdus: Building[],
    candidates: CandidateDP[],
    maxCapacity: number,
    roads: any[], // passed from generateCoverageAwareDPs
    buildingToRoad: Map<number, number>
  ): { lat: number; lon: number; notes: string; upgradeCapacity?: boolean; density?: number; highwayType?: string; roadId?: number }[] {
    const result: { lat: number; lon: number; notes: string; upgradeCapacity?: boolean; density?: number; highwayType?: string; roadId?: number }[] = [];
    const MAX_ITERATIONS = 50;

    const isRoadMajor = (rId: number | undefined): boolean => {
      if (rId === undefined) return false;
      const road = roads.find(r => r.id === rId);
      if (!road) return false;
      const type = road.highwayType ? road.highwayType.toLowerCase() : '';
      return type === 'motorway' || type === 'trunk' || type === 'primary' || type === 'secondary' || (road.lanes !== undefined && road.lanes >= 4);
    };

    // Index all major road segments in an R-Tree for fast spatial queries
    interface MajorRoadSegmentItem {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      p1: [number, number];
      p2: [number, number];
    }
    const majorRoadIndex = new RBush<MajorRoadSegmentItem>();
    const majorRoadItems: MajorRoadSegmentItem[] = [];

    for (const road of roads) {
      const type = road.highwayType ? road.highwayType.toLowerCase() : '';
      const isMajor = type === 'motorway' || type === 'trunk' || type === 'primary' || type === 'secondary' || (road.lanes && road.lanes >= 4);
      if (isMajor && Array.isArray(road.coordinates)) {
        for (let i = 0; i < road.coordinates.length - 1; i++) {
          const p1 = road.coordinates[i];
          const p2 = road.coordinates[i + 1];
          majorRoadItems.push({
            minX: Math.min(p1[0], p2[0]),
            minY: Math.min(p1[1], p2[1]),
            maxX: Math.max(p1[0], p2[0]),
            maxY: Math.max(p1[1], p2[1]),
            p1: [p1[0], p1[1]],
            p2: [p2[0], p2[1]]
          });
        }
      }
    }

    if (majorRoadItems.length > 0) {
      majorRoadIndex.load(majorRoadItems);
    }

    // Track which building IDs are covered
    const coveredBuildingIds = new Set<number>();
    const dpCoveredBuildings = new Map<string, Building[]>();

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const uncovered = uncoveredSdus.filter(b => !coveredBuildingIds.has(b.id));
      if (uncovered.length === 0) break;

      let bestCandidate: CandidateDP | null = null;
      let bestCoverage = 0;
      let bestCoveredBuildings: Building[] = [];
      let bestStolenMap: Map<string, Building[]> | null = null;

      for (const candidate of candidates) {
        let tooClose = false;
        for (const dp of placedDPs) {
          const dist = GISGeometry.getDistanceMeters(candidate.lat, candidate.lon, dp.lat, dp.lon);
          if (dist < MIN_DP_SPACING) {
            let separatedByMajor = false;
            
            // Search major road R-Tree for potential intersections
            const searchBox = {
              minX: Math.min(candidate.lon, dp.lon),
              minY: Math.min(candidate.lat, dp.lat),
              maxX: Math.max(candidate.lon, dp.lon),
              maxY: Math.max(candidate.lat, dp.lat)
            };
            const nearbyRoads = majorRoadIndex.search(searchBox);
            
            for (const rSeg of nearbyRoads) {
              if (GISGeometry.doLineSegmentsIntersect(
                [candidate.lon, candidate.lat], [dp.lon, dp.lat],
                rSeg.p1, rSeg.p2
              )) {
                separatedByMajor = true;
                break;
              }
            }

            if (!separatedByMajor) {
              tooClose = true;
              break;
            }
          }
        }
        if (tooClose) continue;

        // Find which uncovered buildings are in range of this candidate
        const inRange: Building[] = [];
        for (const b of uncovered) {
          const dist = GISGeometry.getDistanceMeters(b.lat, b.lon, candidate.lat, candidate.lon);

          const bRoadId = buildingToRoad.get(b.id);
          const bIsOnMajor = isRoadMajor(bRoadId);
          const cIsOnMajor = isRoadMajor(candidate.roadId);

          let effectiveDist = dist;
          if (bIsOnMajor && !cIsOnMajor) {
            // Penalize minor-road DP trying to cover major-road building to force major-road DP placement
            effectiveDist = dist * 2.5;
          }

          if (effectiveDist <= SERVICE_RADIUS) {
            // AI Support: Do not count this building if connecting to it crosses a major road
            let crossesMajorRoad = false;
            
            // Search major road R-Tree for potential intersections
            const searchBox = {
              minX: Math.min(b.lon, candidate.lon),
              minY: Math.min(b.lat, candidate.lat),
              maxX: Math.max(b.lon, candidate.lon),
              maxY: Math.max(b.lat, candidate.lat)
            };
            const nearbyRoads = majorRoadIndex.search(searchBox);

            for (const rSeg of nearbyRoads) {
              if (GISGeometry.doLineSegmentsIntersect(
                [b.lon, b.lat], [candidate.lon, candidate.lat],
                rSeg.p1, rSeg.p2
              )) {
                crossesMajorRoad = true;
                break;
              }
            }

            if (!crossesMajorRoad) {
              inRange.push(b);
            }
          }
        }

        // Enforce max 6 issued ports for 8-port SDU splitters (2 spares)
        const activeCapacity = Math.max(1, maxCapacity - 2);
        const coveredCount = Math.min(inRange.length, activeCapacity);
        const selectedBuildings = inRange.slice(0, activeCapacity);

        // LOOK-AHEAD LOAD BALANCING:
        // If we cover some uncovered buildings, but less than 3, try to steal from already placed DPs
        let balancedCount = 0;
        const stolenFromDps = new Map<string, Building[]>();

        if (coveredCount > 0 && coveredCount < 3) {
          const needed = 3 - coveredCount;
          let found = 0;

          // Look at placed DPs to see if they can spare buildings
          for (const dp of placedDPs) {
            if (dp.notes === 'Existing') continue;
            const dpKey = `${dp.lat},${dp.lon}`;
            const dpBuildings = dpCoveredBuildings.get(dpKey) || [];
            
            // How many can this DP spare? (It must keep at least 3)
            const spareableCount = dpBuildings.length - 3;
            if (spareableCount > 0) {
              const stealable: Building[] = [];
              for (const b of dpBuildings) {
                const dist = GISGeometry.getDistanceMeters(b.lat, b.lon, candidate.lat, candidate.lon);
                
                const isRoadMajor = (rId: number | undefined): boolean => {
                  if (rId === undefined) return false;
                  const road = roads.find(r => r.id === rId);
                  if (!road) return false;
                  const type = road.highwayType ? road.highwayType.toLowerCase() : '';
                  return type === 'motorway' || type === 'trunk' || type === 'primary' || type === 'secondary' || (road.lanes !== undefined && road.lanes >= 4);
                };

                const bRoadId = buildingToRoad.get(b.id);
                const bIsOnMajor = isRoadMajor(bRoadId);
                const cIsOnMajor = isRoadMajor(candidate.roadId);

                let effectiveDist = dist;
                if (bIsOnMajor && !cIsOnMajor) {
                  effectiveDist = dist * 2.5;
                }

                const distToParent = GISGeometry.getDistanceMeters(b.lat, b.lon, dp.lat, dp.lon);
                if (effectiveDist <= SERVICE_RADIUS && dist <= distToParent + 15) {
                  let crossesMajorRoad = false;
                  for (const road of roads) {
                    const type = road.highwayType ? road.highwayType.toLowerCase() : '';
                    const isMajor = type === 'motorway' || type === 'trunk' || type === 'primary' || type === 'secondary' || (road.lanes !== undefined && road.lanes >= 4);
                    if (isMajor) {
                      for (let i = 0; i < road.coordinates.length - 1; i++) {
                        if (GISGeometry.doLineSegmentsIntersect(
                          [b.lon, b.lat], [candidate.lon, candidate.lat],
                          road.coordinates[i], road.coordinates[i+1]
                        )) {
                          crossesMajorRoad = true;
                          break;
                        }
                      }
                    }
                    if (crossesMajorRoad) break;
                  }

                  if (!crossesMajorRoad) {
                    stealable.push(b);
                  }
                }
              }

              const toSteal = Math.min(spareableCount, stealable.length, needed - found);
              if (toSteal > 0) {
                stolenFromDps.set(dpKey, stealable.slice(0, toSteal));
                found += toSteal;
                if (found >= needed) break;
              }
            }
          }

          if (found >= needed) {
            balancedCount = found;
          }
        }

        const totalCovered = coveredCount + balancedCount;
        const weightedScore = totalCovered + (candidate.score * 0.1);

        if (totalCovered >= 3 && weightedScore > bestCoverage) {
          bestCoverage = weightedScore;
          bestCandidate = candidate;
          bestCoveredBuildings = [...selectedBuildings];
          bestStolenMap = stolenFromDps.size > 0 ? stolenFromDps : null;
        }
      }

      // PASS 2: If no candidate satisfies min 3 rule, relax to min 1 for remaining uncovered homes
      if (!bestCandidate) {
        for (const candidate of candidates) {
          let tooClose = false;
          for (const dp of placedDPs) {
            const dist = GISGeometry.getDistanceMeters(candidate.lat, candidate.lon, dp.lat, dp.lon);
            if (dist < MIN_DP_SPACING) {
              let separatedByMajor = false;
              for (const road of roads) {
                const type = road.highwayType ? road.highwayType.toLowerCase() : '';
                const isMajor = type === 'motorway' || type === 'trunk' || type === 'primary' || type === 'secondary' || (road.lanes && road.lanes >= 4);
                if (isMajor) {
                  for (let i = 0; i < road.coordinates.length - 1; i++) {
                    if (GISGeometry.doLineSegmentsIntersect(
                      [candidate.lon, candidate.lat], [dp.lon, dp.lat],
                      road.coordinates[i], road.coordinates[i+1]
                    )) {
                      separatedByMajor = true;
                      break;
                    }
                  }
                }
                if (separatedByMajor) break;
              }

              if (!separatedByMajor) {
                tooClose = true;
                break;
              }
            }
          }
          if (tooClose) continue;

          const inRange: Building[] = [];
          for (const b of uncovered) {
            const dist = GISGeometry.getDistanceMeters(b.lat, b.lon, candidate.lat, candidate.lon);
            const bRoadId = buildingToRoad.get(b.id);
            const bIsOnMajor = isRoadMajor(bRoadId);
            const cIsOnMajor = isRoadMajor(candidate.roadId);

            let effectiveDist = dist;
            if (bIsOnMajor && !cIsOnMajor) {
              effectiveDist = dist * 2.5;
            }

            if (effectiveDist <= SERVICE_RADIUS) {
              let crossesMajorRoad = false;
              for (const road of roads) {
                const type = road.highwayType ? road.highwayType.toLowerCase() : '';
                const isMajor = type === 'motorway' || type === 'trunk' || type === 'primary' || type === 'secondary' || (road.lanes && road.lanes >= 4);
                if (isMajor) {
                  for (let i = 0; i < road.coordinates.length - 1; i++) {
                    if (GISGeometry.doLineSegmentsIntersect(
                      [b.lon, b.lat], [candidate.lon, candidate.lat],
                      road.coordinates[i], road.coordinates[i+1]
                    )) {
                      crossesMajorRoad = true;
                      break;
                    }
                  }
                }
                if (crossesMajorRoad) break;
              }

              if (!crossesMajorRoad) {
                inRange.push(b);
              }
            }
          }

          const activeCapacity = Math.max(1, maxCapacity - 2);
          const coveredCount = Math.min(inRange.length, activeCapacity);
          const selectedBuildings = inRange.slice(0, activeCapacity);

          const totalCovered = coveredCount;
          const weightedScore = totalCovered + (candidate.score * 0.1);

          if (totalCovered >= 1 && weightedScore > bestCoverage) {
            bestCoverage = weightedScore;
            bestCandidate = candidate;
            bestCoveredBuildings = [...selectedBuildings];
            bestStolenMap = null; // No theft in relaxed pass
          }
        }
      }

      if (!bestCandidate) {
        break;
      } else {
        // Apply the load balancing theft
        if (bestStolenMap) {
          for (const [dpKey, buildings] of bestStolenMap.entries()) {
            const parentBuildings = dpCoveredBuildings.get(dpKey) || [];
            const updatedParent = parentBuildings.filter(pb => !buildings.some(b => b.id === pb.id));
            dpCoveredBuildings.set(dpKey, updatedParent);

            const parentRes = result.find(r => `${r.lat},${r.lon}` === dpKey);
            if (parentRes) {
              parentRes.density = updatedParent.length;
              parentRes.notes = `Coverage-aware DP. Covers ${updatedParent.length} homes.`;
            }
          }
        }

        const coveredCount = bestCoveredBuildings.length;
        
        // Register the covered building IDs
        for (const b of bestCoveredBuildings) {
          coveredBuildingIds.add(b.id);
        }

        const dpKey = `${bestCandidate.lat},${bestCandidate.lon}`;
        dpCoveredBuildings.set(dpKey, [...bestCoveredBuildings]);
        if (bestStolenMap) {
          for (const buildings of bestStolenMap.values()) {
            dpCoveredBuildings.get(dpKey)!.push(...buildings);
          }
        }

        const finalCount = dpCoveredBuildings.get(dpKey)!.length;
        const notes = `Coverage-aware DP. Covers ${finalCount} homes. Road: ${bestCandidate.highwayType}.`;
        placedDPs.push({ lat: bestCandidate.lat, lon: bestCandidate.lon, notes });
        result.push({ 
          lat: bestCandidate.lat, 
          lon: bestCandidate.lon, 
          notes, 
          upgradeCapacity: false, // Standard DPs never upgrade, we strictly enforce splitter port limit!
          density: finalCount,
          highwayType: bestCandidate.highwayType,
          roadId: bestCandidate.roadId
        });
      }
    }
    return result;
  }

  /**
   * Main DP placement logic combining topology, R-Tree snapping, scoring, and greedy set cover.
   */
  static generateCoverageAwareDPs(
    roads: RoadSegment[],
    polygon: [number, number][],
    buildings: Building[],
    existingClosures: PlannedClosure[],
    maxCapacity: number
  ): { lat: number; lon: number; notes: string; upgradeCapacity?: boolean; density?: number; highwayType?: string; roadId?: number }[] {
    const result: { lat: number; lon: number; notes: string; upgradeCapacity?: boolean; density?: number; highwayType?: string; roadId?: number }[] = [];

    const sdus = buildings.filter(b => !b.isMDU);
    if (sdus.length === 0) return result;

    const { intersections } = GISRoadNetwork.buildRoadTopology(roads);
    const buildingToRoad = GISRoadNetwork.mapBuildingsToRoadSegments(sdus, roads);
    const candidates = this.generateCandidates(roads, polygon, sdus, buildingToRoad, intersections, existingClosures);
    const scored = this.scoreCandidates(candidates, sdus, buildings, intersections, existingClosures, roads);

    const placedDPs: { lat: number; lon: number; notes: string }[] = [];
    for (const ec of existingClosures) {
      placedDPs.push({ lat: ec.latitude, lon: ec.longitude, notes: 'Existing' });
    }

    const newDPs = this.validateCoverageGaps(placedDPs, sdus, scored, maxCapacity, roads, buildingToRoad);
    result.push(...newDPs);

    return result;
  }
}
