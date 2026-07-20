import { 
  OSMNode, 
  OSMWay, 
  PlannedPole, 
  PlannedClosure, 
  PlannedCable, 
  AutoPlanResult,
  SERVICE_RADIUS,
  Building
} from './types';
import { GISGeometry } from './GISGeometry';
import { GISRoadNetwork } from './GISRoadNetwork';
import { GISCandidateScoring } from './GISCandidateScoring';
import { GISPolePlacement } from './GISPolePlacement';
import { GISGeoPackageService } from './GISGeoPackageService';
import { GISDataExtractor } from './GISDataExtractor';
import { GISPlanValidator } from './GISPlanValidator';

// Re-export type definitions for other modules that consume them from here
export type { PlannedPole, PlannedClosure, PlannedCable, AutoPlanResult };

/**
 * OSP planning rules configuration. These values encode field engineering
 * standards and are expected to be tuned as planning rules evolve.
 */
const PLAN_CONFIG = {
  /** Snap a closure to a road intersection if within this many meters. */
  INTERSECTION_SNAP_METERS: 25,
  /** Don't place a junction joint box within this distance of the Feed Point (meters). */
  FEED_POINT_EXCLUSION_METERS: 20,
  /** Skip placing a joint box if another closure already exists within this radius (meters). */
  CLOSURE_DEDUP_RADIUS_METERS: 40,
  /** Standard pole spacing along cable routes (meters). */
  POLE_SPACING_METERS: 38,
  /** Maximum distance from the selected polygon area for a custom feed point. */
  FEED_POINT_MAX_DISTANCE_METERS: 200,
  /** Fiber closure capacities by role. */
  CAPACITY: {
    FEED_POINT: 96,
    MAIN_TRUNK_JOINT: 96,
    JUNCTION_JOINT: 48,
    MDU_TERMINAL: 16,
  },
  /** Default splitter capacity when no ratio is provided. */
  DEFAULT_SPLITTER_CAPACITY: 8,
  /** Fiber count for planned distribution cables. */
  CABLE_FIBER_COUNT: 12,
} as const;

/** Cached result of a point-to-point road route. */
type RouteResult = { pathCoords: [number, number][]; isFallback: boolean };

export class GISAutoPlanService {
  /**
   * Helper to offset a LineString coordinate path perpendicular to its segments
   * (e.g. by 3.5 meters to align utility assets along the road shoulder).
   */
  static offsetPath(coords: [number, number][], offsetDistanceMeters: number = 3.5): [number, number][] {
    if (coords.length < 2) return coords;
    const offsetDeg = offsetDistanceMeters * 0.000009; // 1m ~ 0.000009 degrees
    const result: [number, number][] = [];

    for (let i = 0; i < coords.length; i++) {
      let dx = 0;
      let dy = 0;

      if (i === 0) {
        dx = coords[i + 1][0] - coords[i][0];
        dy = coords[i + 1][1] - coords[i][1];
      } else if (i === coords.length - 1) {
        dx = coords[i][0] - coords[i - 1][0];
        dy = coords[i][1] - coords[i - 1][1];
      } else {
        const dx1 = coords[i][0] - coords[i - 1][0];
        const dy1 = coords[i][1] - coords[i - 1][1];
        const dx2 = coords[i + 1][0] - coords[i][0];
        const dy2 = coords[i + 1][1] - coords[i][1];
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (len1 > 0 && len2 > 0) {
          dx = (dx1 / len1 + dx2 / len2) / 2;
          dy = (dy1 / len1 + dy2 / len2) / 2;
        } else {
          dx = dx1 + dx2;
          dy = dy1 + dy2;
        }
      }

      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        // Normal vector pointing to the right side of the segment direction
        const nx = dy / len;
        const ny = -dx / len;
        result.push([
          coords[i][0] + nx * offsetDeg,
          coords[i][1] + ny * offsetDeg
        ]);
      } else {
        result.push([coords[i][0], coords[i][1]]);
      }
    }
    return result;
  }
  /**
   * Main planning coordinator for OSP FTTH automation.
   *
   * NOTE: This method is currently synchronous internally, but is kept `async`
   * deliberately for API stability — callers already `await` it, and future
   * versions may fetch supplementary data (e.g. elevation, existing plant).
   */
  static async generatePlan(
    polygon: [number, number][],
    overpassData: unknown,
    customClosures?: PlannedClosure[],
    splitterRatio?: string,
    feedPoint?: { lat: number; lon: number },
    startDeviceType?: string
  ): Promise<AutoPlanResult> {
    let nodes = new Map<number, OSMNode>();
    let ways: OSMWay[] = [];

    try {
      if (overpassData) {
        const parsed = GISDataExtractor.parseOverpassElements(overpassData);
        nodes = parsed.nodes;
        ways = parsed.ways;
      }
      
      // Inject local Meta AI (MapWithAI) roads, filtering out duplicates
      const aiRoads = await GISGeoPackageService.getRoadsInBoundingBox(polygon);
      const osmRoads = GISDataExtractor.extractRoads(nodes, ways, polygon);
      
      const uniqueAiWays: OSMWay[] = [];
      const uniqueAiNodes = new Map<number, OSMNode>();

      for (const aiWay of aiRoads.ways) {
        // Get coordinates of this AI way
        const wayCoords = aiWay.nodes.map(nId => aiRoads.nodes.get(nId)).filter(Boolean) as OSMNode[];
        if (wayCoords.length < 2) continue;

        // Check if this AI way is a duplicate of any existing OSM road
        let isDuplicate = false;
        
        // Sample 3 points (start, mid, end) of the AI way to check proximity
        const sampleNodes = [
          wayCoords[0],
          wayCoords[Math.floor(wayCoords.length / 2)],
          wayCoords[wayCoords.length - 1]
        ];

        for (const sampleNode of sampleNodes) {
          for (const osmRoad of osmRoads) {
            for (const osmCoord of osmRoad.coordinates) {
              const d = GISGeometry.getDistanceMeters(sampleNode.lat, sampleNode.lon, osmCoord[1], osmCoord[0]);
              if (d < 25) { // If within 25 meters, consider it a duplicate/parallel road
                isDuplicate = true;
                break;
              }
            }
            if (isDuplicate) break;
          }
          if (isDuplicate) break;
        }

        if (!isDuplicate) {
          uniqueAiWays.push(aiWay);
          for (const node of wayCoords) {
            uniqueAiNodes.set(node.id, node);
          }
        }
      }

      // Merge only the unique AI roads
      for (const [id, node] of uniqueAiNodes.entries()) {
        nodes.set(id, node);
      }
      ways.push(...uniqueAiWays);
      
    } catch (error) {
      // Don't swallow parsing failures silently: an empty road network below
      // would surface as a misleading "No mapped roads found" error.
      console.error('[GISAutoPlanService] Failed to parse Overpass data:', error);
      throw new Error(
        `Failed to parse map data from Overpass: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    let roads = GISDataExtractor.extractRoads(nodes, ways, polygon);
    roads = GISRoadNetwork.filterLargestConnectedComponent(roads);

    let maxCapacity: number = PLAN_CONFIG.DEFAULT_SPLITTER_CAPACITY;
    if (splitterRatio) {
      const parts = splitterRatio.split(':');
      if (parts.length === 2) {
        const capacity = parseInt(parts[1], 10);
        if (!isNaN(capacity)) {
          maxCapacity = capacity;
        }
      }
    }

    if (roads.length === 0) {
      throw new Error('No mapped roads were found inside the selected area. The automated planner requires road infrastructure to generate a viable layout.');
    }

    let plannedClosures: PlannedClosure[] = [];
    const plannedPoles: PlannedPole[] = [];
    const plannedCables: PlannedCable[] = [];

    let cableIndex = 1;
    let closureIndex = 1;

    // NOTE: When customClosures is provided, building statistics remain 0 in the
    // summary because buildings are not extracted for custom deployments.
    let buildingsCount = 0;
    let mduCount = 0;
    let sduCount = 0;

    const allBuildings = GISDataExtractor.extractBuildings(nodes, ways);
    if (customClosures && customClosures.length > 0) {
      plannedClosures.push(...customClosures);
    } else {
      const buildings = allBuildings.filter(b => GISGeometry.isPointInPolygon([b.lon, b.lat], polygon));
      buildingsCount = buildings.length;
      const mdus = buildings.filter(b => b.isMDU);
      mduCount = mdus.length;
      const sdus = buildings.filter(b => !b.isMDU);
      sduCount = sdus.length;

      // Add Feed Point at index 0 if provided by the user
      if (feedPoint) {
        const withinPolygon = GISGeometry.isPointInPolygon([feedPoint.lon, feedPoint.lat], polygon);
        const distanceToPolygon = GISGeometry.getDistanceToPolygon([feedPoint.lon, feedPoint.lat], polygon);
        if (!withinPolygon && distanceToPolygon > PLAN_CONFIG.FEED_POINT_MAX_DISTANCE_METERS) {
          throw new Error(
            `Selected base point must be inside or within ${PLAN_CONFIG.FEED_POINT_MAX_DISTANCE_METERS} meters of the marked area.`
          );
        }

        let deviceNotes = 'Feed Point (cabinet/manhole connection point)';
        const devType = String(startDeviceType || 'OLT').toUpperCase();
        if (devType === 'OLT') {
          deviceNotes = 'Feed Point (OLT Central Office)';
        } else if (devType === 'FTC' || devType === 'CABINET') {
          deviceNotes = 'Feed Point (Cabinet/FTC)';
        } else if (devType === 'CLOSURE') {
          deviceNotes = 'Feed Point (Dome Closure / FDP)';
        } else if (devType === 'JOINT') {
          deviceNotes = 'Feed Point (Splice Joint)';
        } else if (devType === 'STUMP_CABLE') {
          deviceNotes = 'Feed Point (Stump/Stub Cable End)';
        }

        let snappedFP = GISRoadNetwork.snapToNearestRoad(feedPoint.lat, feedPoint.lon, roads);
        snappedFP = GISRoadNetwork.snapToIntersectionIfClose(
          snappedFP.lat, snappedFP.lon, roads, PLAN_CONFIG.INTERSECTION_SNAP_METERS
        );

        plannedClosures.push({
          index: 0,
          closureType: 'DOME',
          latitude: snappedFP.lat,
          longitude: snappedFP.lon,
          capacity: PLAN_CONFIG.CAPACITY.FEED_POINT,
          status: 'PLANNED',
          notes: deviceNotes,
        });
      }

      for (const mdu of mdus) {
        let snapped = GISRoadNetwork.snapToNearestRoad(mdu.lat, mdu.lon, roads, false);
        snapped = GISRoadNetwork.snapToIntersectionIfClose(
          snapped.lat, snapped.lon, roads, PLAN_CONFIG.INTERSECTION_SNAP_METERS
        );
        
        // Calculate capacity based on building demand (e.g. 16, 32, 48)
        const capacity = mdu.demand && mdu.demand > 16 
          ? (mdu.demand > 32 ? 48 : 32) 
          : PLAN_CONFIG.CAPACITY.MDU_TERMINAL; // default 16
          
        const mduClosure: PlannedClosure = {
          index: closureIndex++,
          closureType: 'TERMINAL' as const,
          latitude: mdu.lat,
          longitude: mdu.lon,
          capacity,
          status: 'PLANNED' as const,
          notes: `Dedicated FDP for MDU: ${mdu.name || 'Apartment/School'}. Serves ${mdu.demand || 1} units. +20m slack.`,
        };
        mduClosure.mduBuildingId = mdu.id;
        plannedClosures.push(mduClosure);
      }

      const coverageDPs = GISCandidateScoring.generateCoverageAwareDPs(
        roads,
        polygon,
        buildings,
        plannedClosures,
        maxCapacity
      );

      for (const cdp of coverageDPs) {
        plannedClosures.push({
          index: closureIndex++,
          closureType: 'TERMINAL',
          latitude: cdp.lat,
          longitude: cdp.lon,
          capacity: maxCapacity,
          status: 'PLANNED',
          notes: `Coverage-aware DP. Covers ${cdp.density || 1} homes. Road: ${cdp.highwayType || 'unknown'}.`,
          roadId: cdp.roadId
        });
      }
    }

    const debugLogs: string[] = [];

    // Ensure all planned closures are snapped to the closest road shoulder side and pre-inserted
    for (const closure of plannedClosures) {
      if (closure.mduBuildingId) {
        // Skip snapping to road shoulder for dedicated MDU/building FDPs — keep them on the building!
        continue;
      }
      const snap = GISRoadNetwork.snapToNearestRoad(closure.latitude, closure.longitude, roads);
      
      // Pre-insert the centerline snap point into the road network so all Dijkstra routes share it
      GISRoadNetwork.insertNodeIntoRoads(snap, roads);

      const leftCoord = GISRoadNetwork.getNodeOffsetCoordinate(snap.lon, snap.lat, 'LEFT', roads);
      const rightCoord = GISRoadNetwork.getNodeOffsetCoordinate(snap.lon, snap.lat, 'RIGHT', roads);
      
      const dLeft = GISGeometry.getDistanceMeters(closure.latitude, closure.longitude, leftCoord[1], leftCoord[0]);
      const dRight = GISGeometry.getDistanceMeters(closure.latitude, closure.longitude, rightCoord[1], rightCoord[0]);
      
      let shoulder = dLeft < dRight ? leftCoord : rightCoord;
      const centerlineDist = GISGeometry.getDistanceMeters(shoulder[1], shoulder[0], snap.lat, snap.lon);
      if (centerlineDist < 1.0) {
        // Nudge perpendicular to road direction by 3.5m to ensure offset from centerline
        const road = roads.find(r => {
          for (let i = 0; i < r.coordinates.length - 1; i++) {
            const p1 = r.coordinates[i];
            const p2 = r.coordinates[i + 1];
            const snapped = GISRoadNetwork.snapPointToSegment(snap.lon, snap.lat, p1[0], p1[1], p2[0], p2[1]);
            if (GISGeometry.getDistanceMeters(snap.lat, snap.lon, snapped.lat, snapped.lon) < 0.5) {
              return true;
            }
          }
          return false;
        });
        if (road && road.coordinates.length >= 2) {
          // Find the closest segment and use its perpendicular direction
          let bestDx = 1, bestDy = 0, bestLen = 1;
          for (let i = 0; i < road.coordinates.length - 1; i++) {
            const p1 = road.coordinates[i];
            const p2 = road.coordinates[i + 1];
            const snapped = GISRoadNetwork.snapPointToSegment(snap.lon, snap.lat, p1[0], p1[1], p2[0], p2[1]);
            if (GISGeometry.getDistanceMeters(snap.lat, snap.lon, snapped.lat, snapped.lon) < 0.5) {
              const dx = p2[0] - p1[0];
              const dy = p2[1] - p1[1];
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len > 0) {
                bestDx = dx;
                bestDy = dy;
                bestLen = len;
              }
              break;
            }
          }
          const nx = -bestDy / bestLen;
          const ny = bestDx / bestLen;
          const nudgeDeg = 3.5 * 0.000009;
          shoulder = [shoulder[0] + nx * nudgeDeg, shoulder[1] + ny * nudgeDeg];
        } else {
          // Fallback: nudge East by 3.5m
          shoulder = [shoulder[0] + 0.00003, shoulder[1]];
        }
      }
      closure.latitude = shoulder[1];
      closure.longitude = shoulder[0];
    }

    // ─── BUILDING TO DP ASSIGNMENT (GREEDY DISTANCE MINIMIZATION) ─────────────────
    const allBuildingsContext = GISDataExtractor.extractBuildings(nodes, ways);
    const buildingsInside = allBuildingsContext.filter((b) => GISGeometry.isPointInPolygon([b.lon, b.lat], polygon));
    const buildingToRoad = GISRoadNetwork.mapBuildingsToRoadSegments(buildingsInside, roads);

    const isRoadMajor = (rId: number | undefined): boolean => {
      if (rId === undefined) return false;
      const road = roads.find(r => r.id === rId);
      if (!road) return false;
      const type = road.highwayType ? road.highwayType.toLowerCase() : '';
      return type === 'motorway' || type === 'trunk' || type === 'primary' || type === 'secondary' || (road.lanes !== undefined && road.lanes >= 4);
    };
    
    // 1. Gather all possible valid candidate assignments within 150m limit
    const candidates: { building: Building; closure: PlannedClosure; dist: number }[] = [];
    for (const b of buildingsInside) {
      for (const c of plannedClosures) {
        if (c.closureType === 'TERMINAL') {
          // AI Support: Dedicated MDU FDP mapping rules
          const isDedicatedMDU = c.notes && c.notes.includes('Dedicated FDP');
          if (isDedicatedMDU) {
            // Only allow the corresponding MDU building to connect to its dedicated FDP
            if (b.id !== c.mduBuildingId) {
              continue;
            }
          } else {
            // Standard SDU terminals should not serve MDU buildings (since MDUs have dedicated DPs)
            if (b.isMDU) {
              continue;
            }
          }

          let dist = GISGeometry.getDistanceMeters(b.lat, b.lon, c.latitude, c.longitude);
          
          if (dist <= SERVICE_RADIUS) {
            // AI Support: Penalize connecting to a closure across a major road (safety/cost violation)
            let crossesMajorRoad = false;
            for (const road of roads) {
              const type = road.highwayType ? road.highwayType.toLowerCase() : '';
              const isMajor = type === 'motorway' || type === 'trunk' || type === 'primary' || type === 'secondary' || (road.lanes && road.lanes >= 4);
              if (isMajor) {
                for (let i = 0; i < road.coordinates.length - 1; i++) {
                  if (GISGeometry.doLineSegmentsIntersect(
                    [b.lon, b.lat], [c.longitude, c.latitude],
                    road.coordinates[i], road.coordinates[i+1]
                  )) {
                    crossesMajorRoad = true;
                    break;
                  }
                }
              }
              if (crossesMajorRoad) break;
            }

            if (crossesMajorRoad) {
              dist += 10000;
            }

            const bRoadId = buildingToRoad.get(b.id);
            const bIsOnMajor = isRoadMajor(bRoadId);
            const cIsOnMajor = isRoadMajor(c.roadId);

            if (bIsOnMajor && !cIsOnMajor) {
              // Heavily penalize serving a major-road building from a minor-road DP.
              // This pushes the assignment to the end of the queue so it prefers a major-road DP first.
              dist += 1000;
            }

            candidates.push({ building: b, closure: c, dist });
          }
        }
      }
    }

    // 2. Sort candidates by distance (closest pairs first)
    candidates.sort((a, b) => a.dist - b.dist);

    // 3. Assign greedily respecting FDP capacity limits (max 6 issued ports for SDUs, min 3 customers per DP)
    const dpAssignedCount = new Map<number, number>();
    const assignedBuildings = new Set<number>();
    let allowedClosures = [...plannedClosures];

    for (let loop = 0; loop < 5; loop++) {
      dpAssignedCount.clear();
      assignedBuildings.clear();
      // Keep only non-drop cables from previous steps (currently plannedCables is empty of drops, but we clear just in case)
      const nonDrops = plannedCables.filter(cb => cb.cableType !== 'DROP');
      plannedCables.length = 0;
      plannedCables.push(...nonDrops);

      // Helper to route drop cables along existing poles if straight line distance exceeds 35m
      const getDropCablePath = (
        bLon: number,
        bLat: number,
        cLon: number,
        cLat: number,
        straightDist: number
      ): { coordinates: [number, number][]; length: number } => {
        if (straightDist <= 35) {
          return {
            coordinates: [[bLon, bLat], [cLon, cLat]],
            length: straightDist * 1.2
          };
        }

        let closestPt: [number, number] | null = null;
        let closestDist = Infinity;
        let bestCable: PlannedCable | null = null;
        let bestPtIdx = -1;

        const LAT_DEG_PER_M = 1.0 / 111320;
        const LNG_DEG_PER_M = 1.0 / (111320 * 0.99); // Sri Lanka approximate longitude factor

        for (const cb of nonDrops) {
          for (let idx = 0; idx < cb.coordinates.length; idx++) {
            const pt = cb.coordinates[idx];

            // Branch-and-bound bounding box pre-filter
            if (closestDist !== Infinity) {
              const maxDLat = closestDist * LAT_DEG_PER_M;
              if (Math.abs(bLat - pt[1]) > maxDLat) continue;

              const maxDLng = closestDist * LNG_DEG_PER_M;
              if (Math.abs(bLon - pt[0]) > maxDLng) continue;
            }

            const d = GISGeometry.getDistanceMeters(bLat, bLon, pt[1], pt[0]);
            if (d < closestDist) {
              closestDist = d;
              closestPt = pt;
              bestCable = cb;
              bestPtIdx = idx;
            }
          }
        }

        if (bestCable && closestPt && closestDist < 45) {
          let bestCIdx = -1;
          let minCDist = Infinity;
          for (let idx = 0; idx < bestCable.coordinates.length; idx++) {
            const pt = bestCable.coordinates[idx];

            // Branch-and-bound bounding box pre-filter
            if (minCDist !== Infinity) {
              const maxDLat = minCDist * LAT_DEG_PER_M;
              if (Math.abs(cLat - pt[1]) > maxDLat) continue;

              const maxDLng = minCDist * LNG_DEG_PER_M;
              if (Math.abs(cLon - pt[0]) > maxDLng) continue;
            }

            const d = GISGeometry.getDistanceMeters(cLat, cLon, pt[1], pt[0]);
            if (d < minCDist) {
              minCDist = d;
              bestCIdx = idx;
            }
          }

          if (bestCIdx >= 0 && bestPtIdx >= 0) {
            const subpath: [number, number][] = [];
            if (bestPtIdx <= bestCIdx) {
              subpath.push(...bestCable.coordinates.slice(bestPtIdx, bestCIdx + 1));
            } else {
              subpath.push(...bestCable.coordinates.slice(bestCIdx, bestPtIdx + 1).reverse());
            }
            return {
              coordinates: [[bLon, bLat], ...subpath],
              length: closestDist + GISAutoPlanService.calculatePathLength(subpath)
            };
          }
        }

        return {
          coordinates: [[bLon, bLat], [cLon, cLat]],
          length: straightDist * 1.2
        };
      };

      const filteredCandidates = candidates.filter(cand => 
        allowedClosures.some(ac => ac.index === cand.closure.index)
      );

      for (const cand of filteredCandidates) {
        const bId = cand.building.id;
        const cId = cand.closure.index;
        const capacity = cand.closure.capacity || maxCapacity;
        // Limit active SDU terminals to capacity - 2 (max 6 active connections for 8-port splitters)
        const activeCapacity = (cand.closure.closureType === 'TERMINAL' && !cand.building.isMDU)
          ? Math.max(1, capacity - 2)
          : capacity;

        if (assignedBuildings.has(bId)) {
          continue;
        }

        const currentAssigned = dpAssignedCount.get(cId) || 0;
        const demand = cand.building.demand || 1;
        
        if (currentAssigned + demand <= activeCapacity) {
          const rawGeomDist = GISGeometry.getDistanceMeters(cand.building.lat, cand.building.lon, cand.closure.latitude, cand.closure.longitude);
          const dropPath = getDropCablePath(cand.building.lon, cand.building.lat, cand.closure.longitude, cand.closure.latitude, rawGeomDist);
          const fiberCount = cand.building.isMDU ? (demand > 4 ? 12 : 4) : 2;

          plannedCables.push({
            index: cableIndex++,
            length: dropPath.length,
            coordinates: dropPath.coordinates,
            status: 'PLANNED',
            cableType: 'DROP',
            fiberCount,
          });

          dpAssignedCount.set(cId, currentAssigned + demand);
          assignedBuildings.add(bId);
        }
      }

      // Overflow pass: Connect remaining unassigned buildings to closest allowed closures up to absolute capacity (8)
      for (const b of buildingsInside) {
        if (assignedBuildings.has(b.id)) continue;
        
        // Find closest candidate for this building that is in allowedClosures
        const bCands = filteredCandidates.filter(cand => cand.building.id === b.id);
        for (const cand of bCands) {
          const cId = cand.closure.index;
          const capacity = cand.closure.capacity || maxCapacity;
          const currentAssigned = dpAssignedCount.get(cId) || 0;
          const demand = b.demand || 1;
          
          if (currentAssigned + demand <= capacity) {
            const rawGeomDist = GISGeometry.getDistanceMeters(b.lat, b.lon, cand.closure.latitude, cand.closure.longitude);
            const dropPath = getDropCablePath(b.lon, b.lat, cand.closure.longitude, cand.closure.latitude, rawGeomDist);
            const fiberCount = b.isMDU ? (demand > 4 ? 12 : 4) : 2;

            plannedCables.push({
              index: cableIndex++,
              length: dropPath.length,
              coordinates: dropPath.coordinates,
              status: 'PLANNED',
              cableType: 'DROP',
              fiberCount,
            });

            dpAssignedCount.set(cId, currentAssigned + demand);
            assignedBuildings.add(b.id);
            break; // Stop looking at other candidates for this building
          }
        }
      }

      // --- Load Balancing Step ---
      // If any DP has < 3 customers, try to steal customers from neighboring DPs that have > 3 customers
      for (const target of allowedClosures) {
        if (target.index === 0) continue;
        const isDedicatedMDU = target.notes && target.notes.includes('Dedicated FDP');
        if (isDedicatedMDU) continue;

        let count = dpAssignedCount.get(target.index) || 0;
        if (count > 0 && count < 3) {
          const sourceDps = allowedClosures.filter(ac => ac.index !== target.index && ac.index !== 0);
          for (const source of sourceDps) {
            let sourceCount = dpAssignedCount.get(source.index) || 0;
            if (sourceCount > 3) {
              // Find drop cables connected to source
              for (const cable of plannedCables) {
                if (cable.cableType === 'DROP') {
                  const dest = cable.coordinates[1];
                  if (dest[0] === source.longitude && dest[1] === source.latitude) {
                    const bLonLat = cable.coordinates[0];
                    const distToTarget = GISGeometry.getDistanceMeters(target.latitude, target.longitude, bLonLat[1], bLonLat[0]);
                    const distToSource = GISGeometry.getDistanceMeters(source.latitude, source.longitude, bLonLat[1], bLonLat[0]);
                    if (distToTarget <= SERVICE_RADIUS && distToTarget <= distToSource + 15) {
                      let crossesMajor = false;
                      for (const road of roads) {
                        const type = road.highwayType ? road.highwayType.toLowerCase() : '';
                        const isMajor = type === 'motorway' || type === 'trunk' || type === 'primary' || type === 'secondary' || (road.lanes !== undefined && road.lanes >= 4);
                        if (isMajor) {
                          for (let k = 0; k < road.coordinates.length - 1; k++) {
                            if (GISGeometry.doLineSegmentsIntersect(
                              bLonLat, [target.longitude, target.latitude],
                              road.coordinates[k], road.coordinates[k+1]
                            )) {
                              crossesMajor = true;
                              break;
                            }
                          }
                        }
                        if (crossesMajor) break;
                      }

                      if (!crossesMajor) {
                        // Transfer the customer
                        cable.coordinates[1] = [target.longitude, target.latitude];
                        cable.length = distToTarget * 1.2;
                        
                        sourceCount--;
                        dpAssignedCount.set(source.index, sourceCount);
                        count++;
                        dpAssignedCount.set(target.index, count);

                        if (count >= 3) break; // target is satisfied
                        if (sourceCount <= 3) break; // source cannot spare any more
                      }
                    }
                  }
                }
              }
            }
            if (count >= 3) break;
          }
        }
      }

      // Prune DPs with < 3 customers (except index 0 which is the Feed Point)
      const nextAllowedClosures = allowedClosures.filter(c => {
        if (c.index === 0) return true;
        const isDedicatedMDU = c.notes && c.notes.includes('Dedicated FDP');
        if (isDedicatedMDU) return true;
        const assigned = dpAssignedCount.get(c.index) || 0;
        if (assigned >= 3) return true;

        // Exempt check: Is this DP the only option within 50m for any SDU building?
        const buildingsAssigned = buildingsInside.filter(b => {
          if (b.isMDU) return false;
          const hasCable = plannedCables.some(cb => 
            cb.cableType === 'DROP' && 
            cb.coordinates[0][0] === b.lon && cb.coordinates[0][1] === b.lat &&
            cb.coordinates[1][0] === c.longitude && cb.coordinates[1][1] === c.latitude
          );
          return hasCable;
        });

        const hasUnreachable = buildingsAssigned.some(b => {
          // Check if there is any other allowed closure within 50m (excluding c itself)
          const otherClosuresInRange = allowedClosures.filter(ac => ac.index !== c.index && ac.index !== 0);
          const hasOther = otherClosuresInRange.some(ac => {
            const dist = GISGeometry.getDistanceMeters(b.lat, b.lon, ac.latitude, ac.longitude);
            if (dist > 50) return false;
            
            // Check if other closure has spare capacity
            const acAssigned = dpAssignedCount.get(ac.index) || 0;
            const acCapacity = ac.capacity || maxCapacity;
            if (acAssigned >= acCapacity) return false;

            // Also check major road crossing rule
            let crossesMajor = false;
            for (const road of roads) {
              const type = road.highwayType ? road.highwayType.toLowerCase() : '';
              const isMajor = type === 'motorway' || type === 'trunk' || type === 'primary' || type === 'secondary' || (road.lanes !== undefined && road.lanes >= 4);
              if (isMajor) {
                for (let k = 0; k < road.coordinates.length - 1; k++) {
                  if (GISGeometry.doLineSegmentsIntersect(
                    [b.lon, b.lat], [ac.longitude, ac.latitude],
                    road.coordinates[k], road.coordinates[k+1]
                  )) {
                    crossesMajor = true;
                    break;
                  }
                }
              }
              if (crossesMajor) break;
            }
            return !crossesMajor;
          });
          return !hasOther; // True if this building has NO other valid closure option!
        });

        return hasUnreachable;
      });

      if (nextAllowedClosures.length === allowedClosures.length) {
        break;
      }
      allowedClosures = nextAllowedClosures;
    }

    plannedClosures = allowedClosures;

    const usedRoadShoulders = new Map<number, 'LEFT' | 'RIGHT'>();
    const routeBetween = (a: PlannedClosure, b: PlannedClosure, commitSide: boolean = true): RouteResult => {
      const tempShoulders = commitSide ? usedRoadShoulders : new Map<number, 'LEFT' | 'RIGHT'>(usedRoadShoulders);
      const res = GISRoadNetwork.dijkstraRoute(
        a.latitude,
        a.longitude,
        b.latitude,
        b.longitude,
        roads,
        tempShoulders
      );
      
      if (commitSide) {
        // Update usedRoadShoulders based on this path
        for (const pt of res.pathCoords) {
          const key = `${pt[0]},${pt[1]}`;
          const roadSide = res.nodeToRoadSide.get(key);
          if (roadSide) {
            usedRoadShoulders.set(roadSide.roadId, roadSide.side);
          }
        }
      }

      return res;
    };

    // Start routing from Feed Point (index 0) if present, or default to main road snap point.
    let startClosure = plannedClosures.find(c => c.index === 0);
    if (!startClosure && plannedClosures.length > 0) {
      startClosure = plannedClosures[0];
      let minMainRoadDist = Infinity;
      for (const c of plannedClosures) {
        for (const road of roads) {
          const type = road.highwayType || '';
          if (['primary', 'secondary', 'tertiary'].includes(type)) {
            for (const coord of road.coordinates) {
              const d = GISGeometry.getDistanceMeters(c.latitude, c.longitude, coord[1], coord[0]);
              if (d < minMainRoadDist) {
                minMainRoadDist = d;
                startClosure = c;
              }
            }
          }
        }
      }
    }

    // ─── MINIMUM SPANNING TREE (MST) ROUTING ─────────────────────────────────────
    // Instead of independent Dijkstra paths from Feed Point to each DP (which creates
    // a single snake-like cable), we use Prim's MST to determine the optimal branching
    // structure. Euclidean distances provide the tree topology, then Dijkstra paths
    // are computed only for the MST edges (N-1 instead of N²). The resulting paths
    // form a proper tree that naturally branches at divergence points.
    // Branch points → Junction Joints, edges → continuous Cables.
    // Tolerance-based spatial grid hashing (~5m cells) for near-miss path merging.
    const GRID_CELL_METERS = 2.5;
    const coordToHash = (pt: [number, number]): string => {
      const CELL_DEG = GRID_CELL_METERS / 111320.0;
      const cellLon = Math.round(pt[0] / CELL_DEG) * CELL_DEG;
      const cellLat = Math.round(pt[1] / CELL_DEG) * CELL_DEG;
      return `${cellLon.toFixed(7)},${cellLat.toFixed(7)}`;
    };

    type TreeNode = { pt: [number, number]; children: Map<string, TreeNode> };

    const dpPaths: [number, number][][] = [];
    if (startClosure && plannedClosures.length > 1) {
      const allDps = plannedClosures.filter(c => c.index !== startClosure!.index);
      const closureNodes: PlannedClosure[] = [startClosure, ...allDps];
      const N = closureNodes.length;

      const root: TreeNode = { pt: [startClosure.longitude, startClosure.latitude], children: new Map() };

      const edgePathCache = new Map<string, [number, number][]>();
      const getDijkstraDist = (i: number, j: number): number => {
        const key = `${Math.min(i, j)},${Math.max(i, j)}`;
        if (edgePathCache.has(key)) {
          return GISAutoPlanService.calculatePathLength(edgePathCache.get(key)!);
        }
        // Candidate probes do NOT commit shoulder side choices!
        const { pathCoords } = routeBetween(closureNodes[i], closureNodes[j], false);
        edgePathCache.set(key, pathCoords);
        return GISAutoPlanService.calculatePathLength(pathCoords);
      };

      // Step 1: Prim's MST from Feed Point (index 0) using Dijkstra road distance
      // We implement a Root-Distance Weighted Prim's heuristic to prevent long cascading fiber runs.
      const inTree = new Array(N).fill(false);
      inTree[0] = true;
      const mstEdges: [number, number][] = [];
      const distFromRoot = new Array(N).fill(Infinity);
      distFromRoot[0] = 0;

      for (let iter = 0; iter < N - 1; iter++) {
        let bestDist = Infinity;
        let bestU = -1, bestV = -1;
        for (let u = 0; u < N; u++) {
          if (!inTree[u]) continue;
          for (let v = 0; v < N; v++) {
            if (inTree[v]) continue;
            const d = getDijkstraDist(u, v);
            // Every 100m of cumulative path distance from the Feed Point adds 25m of effective weight.
            // This favors shorter root-paths and forces early branching.
            const effectiveWeight = d + 0.25 * distFromRoot[u];
            if (effectiveWeight < bestDist) { 
              bestDist = effectiveWeight; 
              bestU = u; 
              bestV = v; 
            }
          }
        }
        if (bestV >= 0) { 
          inTree[bestV] = true; 
          mstEdges.push([bestU, bestV]); 
          distFromRoot[bestV] = distFromRoot[bestU] + getDijkstraDist(bestU, bestV);
        }
      }

      // Step 2: Orient MST edges into a rooted tree (BFS from Feed Point)
      const parentOf = new Map<number, number>();
      const visited2 = new Array(N).fill(false);
      visited2[0] = true;
      const queue = [0];
      while (queue.length > 0) {
        const u = queue.shift()!;
        for (const [a, b] of mstEdges) {
          if (a === u && !visited2[b]) { visited2[b] = true; parentOf.set(b, u); queue.push(b); }
          else if (b === u && !visited2[a]) { visited2[a] = true; parentOf.set(a, u); queue.push(a); }
        }
      }

      // Step 3: Compute Dijkstra paths for each parent→child edge (committed/locked to road shoulders)
      edgePathCache.clear(); // Clear the candidate cache so we re-route using actual committed sides!
      for (const [u, v] of mstEdges) {
        const { pathCoords } = routeBetween(closureNodes[u], closureNodes[v], true);
        const key = `${Math.min(u, v)},${Math.max(u, v)}`;
        edgePathCache.set(key, pathCoords);
      }

      // Step 4: Build full paths from Feed Point through ancestors to each DP
      const collectFullPath = (childIdx: number): [number, number][] => {
        const segments: [number, number][][] = [];
        let curr = childIdx;
        while (parentOf.has(curr)) {
          const parent = parentOf.get(curr)!;
          const key = `${Math.min(parent, curr)},${Math.max(parent, curr)}`;
          let edgePath = edgePathCache.get(key)!;
          // Orient so the segment runs parent → child (BFS already determined this)
          const parentPt = closureNodes[parent];
          const firstIsParent = GISGeometry.getDistanceMeters(
            edgePath[0][1], edgePath[0][0], parentPt.latitude, parentPt.longitude
          ) < 10;
          if (!firstIsParent) edgePath = [...edgePath].reverse();
          segments.push(edgePath);
          curr = parent;
        }
        // segments are in child→root order; reverse to get root→child order
        segments.reverse();
        // Concatenate segments, skipping the duplicate junction point between consecutive edges
        const fullPath: [number, number][] = [];
        for (const seg of segments) {
          if (fullPath.length === 0) {
            fullPath.push(...seg);
          } else {
            // Skip first point of seg — it's the same as the last point already in fullPath
            for (let k = 1; k < seg.length; k++) fullPath.push(seg[k]);
          }
        }
        return fullPath;
      };

      const cleanPath = (path: [number, number][]): [number, number][] => {
        if (path.length < 3) return path;
        const result: [number, number][] = [];
        for (let i = 0; i < path.length; i++) {
          result.push(path[i]);
          if (result.length >= 3) {
            const last = result[result.length - 1];
            const prev2 = result[result.length - 3];
            const d = GISGeometry.getDistanceMeters(last[1], last[0], prev2[1], prev2[0]);
            if (d < 8.0) {
              result.pop(); // Remove return coordinate (A)
              result.pop(); // Remove U-turn coordinate (B)
            }
          }
        }
        return result;
      };

      for (const dp of allDps) {
        const dpIdx = closureNodes.indexOf(dp);
        if (dpIdx > 0) {
          dpPaths.push(cleanPath(collectFullPath(dpIdx)));
        }
      }

      for (const path of dpPaths) {
        let curr = root;
        for (const pt of path) {
          const hash = coordToHash(pt);
          if (!curr.children.has(hash)) {
            curr.children.set(hash, { pt, children: new Map() });
          }
          curr = curr.children.get(hash)!;
        }
      }

      const traverseTrie = (node: TreeNode, currentCableCoords: [number, number][], isTrunk: boolean) => {
        currentCableCoords.push(node.pt);
        
        // Leaf node (DP) -> End of cable
        if (node.children.size === 0) {
           if (currentCableCoords.length > 1) {
             plannedCables.push({
                index: cableIndex++,
                length: GISAutoPlanService.calculatePathLength(currentCableCoords),
                coordinates: [...currentCableCoords],
                status: 'PLANNED',
                cableType: 'ADSS',
                fiberCount: isTrunk ? 48 : PLAN_CONFIG.CABLE_FIBER_COUNT,
             });
           }
           return;
        }
        
        // Continuous path -> keep building the cable
        if (node.children.size === 1) {
           for (const child of node.children.values()) {
             traverseTrie(child, currentCableCoords, isTrunk);
           }
           return;
        }
        
        // Branch point (size >= 2) -> Place Junction Joint and split cables
        const distToFeed = GISGeometry.getDistanceMeters(node.pt[1], node.pt[0], startClosure!.latitude, startClosure!.longitude);
        
        if (distToFeed > PLAN_CONFIG.FEED_POINT_EXCLUSION_METERS) {
           let tooClose = false;
           for (const pc of plannedClosures) {
             if (GISGeometry.getDistanceMeters(node.pt[1], node.pt[0], pc.latitude, pc.longitude) < PLAN_CONFIG.CLOSURE_DEDUP_RADIUS_METERS) {
               tooClose = true;
               break;
             }
           }
           if (!tooClose) {
              plannedClosures.push({
                index: closureIndex++,
                closureType: 'DOME',
                latitude: node.pt[1],
                longitude: node.pt[0],
                capacity: isTrunk ? PLAN_CONFIG.CAPACITY.MAIN_TRUNK_JOINT : PLAN_CONFIG.CAPACITY.JUNCTION_JOINT,
                status: 'PLANNED',
                notes: isTrunk 
                  ? 'Main Trunk Joint (High Capacity) + 15m Slack Loop'
                  : 'Junction Joint Box (branching point) + 15m Slack Loop',
              });
           }
        }
        
        // Terminate the incoming cable at this branch point
        if (currentCableCoords.length > 1) {
             plannedCables.push({
                index: cableIndex++,
                length: GISAutoPlanService.calculatePathLength(currentCableCoords),
                coordinates: [...currentCableCoords],
                status: 'PLANNED',
                cableType: 'ADSS',
                fiberCount: isTrunk ? 48 : PLAN_CONFIG.CABLE_FIBER_COUNT,
             });
        }
        
        // Start new distribution cables for each diverging branch
        for (const child of node.children.values()) {
            traverseTrie(child, [node.pt], false); 
        }
      };

      const isOLTStart = startDeviceType === undefined || String(startDeviceType).toUpperCase() === 'OLT';
      for (const child of root.children.values()) {
         traverseTrie(child, [root.pt], isOLTStart);
      }

    }

    // --- Post-Trie Cable Merge Optimization ---
    // After Trie traversal, parallel cables may exist that share significant portions
    // of the same road but were not merged by the Trie (e.g. different shoulder sides,
    // or paths that diverge mid-cable). This pass identifies such cable pairs and
    // re-routes the shorter cable through the longer one's shared segment, inserting
    // a junction joint at the divergence point.
    if (plannedCables.filter(cb => cb.cableType === 'ADSS').length >= 2) {
      const adssCables = plannedCables.filter(cb => cb.cableType === 'ADSS');

      for (let i = 0; i < adssCables.length; i++) {
        for (let j = i + 1; j < adssCables.length; j++) {
          const cableA = adssCables[i];
          const cableB = adssCables[j];

          // Find the longest shared subpath between the two cables
          let bestSharedLen = 0;
          let bestBFrom = 0;
          let bestSharedCount = 0;

          const LAT_TOL = 10.0 / 111320;
          const LNG_TOL = 10.0 / (111320 * 0.99);

          for (let aIdx = 0; aIdx < cableA.coordinates.length; aIdx++) {
            const ptA = cableA.coordinates[aIdx];
            for (let bIdx = 0; bIdx < cableB.coordinates.length; bIdx++) {
              const ptB = cableB.coordinates[bIdx];

              // Fast delta bounding box pre-filter to bypass slow Haversine formula
              if (Math.abs(ptA[1] - ptB[1]) > LAT_TOL || Math.abs(ptA[0] - ptB[0]) > LNG_TOL) {
                continue;
              }

              let sharedCount = 0;
              while (
                aIdx + sharedCount < cableA.coordinates.length &&
                bIdx + sharedCount < cableB.coordinates.length
              ) {
                const pA = cableA.coordinates[aIdx + sharedCount];
                const pB = cableB.coordinates[bIdx + sharedCount];

                if (Math.abs(pA[1] - pB[1]) > LAT_TOL || Math.abs(pA[0] - pB[0]) > LNG_TOL) {
                  break;
                }

                const d = GISGeometry.getDistanceMeters(pA[1], pA[0], pB[1], pB[0]);
                if (d > 10.0) break; // Not close enough to be the same path
                sharedCount++;
              }

              if (sharedCount >= 2) {
                // Calculate shared length
                let segLen = 0;
                for (let k = 0; k < sharedCount - 1; k++) {
                  const p1 = cableA.coordinates[aIdx + k];
                  const p2 = cableA.coordinates[aIdx + k + 1];
                  segLen += GISGeometry.getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);
                }
                if (segLen > bestSharedLen && segLen > 50) { // Only merge if >50m shared
                  bestSharedLen = segLen;
                  bestBFrom = bIdx;
                  bestSharedCount = sharedCount;
                }
              }
            }
          }

          if (bestSharedLen > 50 && bestSharedCount >= 3) {
            // We found a significant shared segment. Merge cableB into cableA's trunk.
            // Strategy: If A is longer than B (or A is the trunk), insert a junction
            // at the shared start point and make B branch off from there.

            // The segment before the shared part on cableB
            const bPrefix = cableB.coordinates.slice(0, bestBFrom);
            // The segment after the shared part on cableB  
            const bSuffix = cableB.coordinates.slice(bestBFrom + bestSharedCount);

            if (bPrefix.length > 0) {
              // CableB starts from somewhere else and joins the trunk. Add a junction at join point.
              const joinPoint = cableB.coordinates[bestBFrom];
              const distToFeed = GISGeometry.getDistanceMeters(
                joinPoint[1], joinPoint[0],
                startClosure!.latitude, startClosure!.longitude
              );
              if (distToFeed > PLAN_CONFIG.FEED_POINT_EXCLUSION_METERS) {
                let tooClose = false;
                for (const pc of plannedClosures) {
                  if (GISGeometry.getDistanceMeters(joinPoint[1], joinPoint[0], pc.latitude, pc.longitude) < PLAN_CONFIG.CLOSURE_DEDUP_RADIUS_METERS) {
                    tooClose = true;
                    break;
                  }
                }
                if (!tooClose) {
                  plannedClosures.push({
                    index: closureIndex++,
                    closureType: 'DOME',
                    latitude: joinPoint[1],
                    longitude: joinPoint[0],
                    capacity: PLAN_CONFIG.CAPACITY.JUNCTION_JOINT,
                    status: 'PLANNED',
                    notes: 'Post-Trie Merge Junction (parallel cable optimization) + 15m Slack Loop',
                  });
                }
              }

              // Replace cableB's shared portion with the branch cable from bPrefix last point to join point
              const newBPath = [...bPrefix];
              if (bSuffix.length > 0) {
                newBPath.push(joinPoint);
                newBPath.push(...bSuffix);
              } else {
                // B terminates at the join point
                newBPath.push(joinPoint);
              }
              // Only apply if the new path is reasonable (not just a single point)
              if (newBPath.length >= 2) {
                cableB.coordinates = newBPath;
                cableB.length = GISAutoPlanService.calculatePathLength(newBPath);
              }
            }
          }
        }
      }
    }

    // --- Post-Processing: Prune redundant short dead-end cable segments ---
    const pruneRedundantTails = () => {
      for (let iter = 0; iter < 5; iter++) { // Run up to 5 passes to recursively prune nested tails
        const toRemove = new Set<number>();
        
        for (let i = 0; i < plannedCables.length; i++) {
          const cab = plannedCables[i];
          if (cab.cableType === 'DROP') continue;
          
          const coords = cab.coordinates;
          if (coords.length < 2) continue;
          
          const startPt = coords[0];
          const endPt = coords[coords.length - 1];
          
          let startSharedCount = 0;
          let endSharedCount = 0;
          
          for (let j = 0; j < plannedCables.length; j++) {
            if (i === j) continue;
            const other = plannedCables[j];
            if (other.cableType === 'DROP') continue;
            
            const oCoords = other.coordinates;
            if (oCoords.length < 2) continue;
            
            const oStart = oCoords[0];
            const oEnd = oCoords[oCoords.length - 1];
            
            if (GISGeometry.getDistanceMeters(startPt[1], startPt[0], oStart[1], oStart[0]) < 1.5 ||
                GISGeometry.getDistanceMeters(startPt[1], startPt[0], oEnd[1], oEnd[0]) < 1.5) {
              startSharedCount++;
            }
            if (GISGeometry.getDistanceMeters(endPt[1], endPt[0], oStart[1], oStart[0]) < 1.5 ||
                GISGeometry.getDistanceMeters(endPt[1], endPt[0], oEnd[1], oEnd[0]) < 1.5) {
              endSharedCount++;
            }
          }
          
          const isStartDeadEnd = startSharedCount === 0;
          const isEndDeadEnd = endSharedCount === 0;
          
          // Check if there is a closure near the dead-ends
          const isClosureNear = (pt: [number, number]): boolean => {
            for (const cl of plannedClosures) {
              if (GISGeometry.getDistanceMeters(pt[1], pt[0], cl.latitude, cl.longitude) < 5.0) {
                return true;
              }
            }
            return false;
          };
          
          const startIsRedundant = isStartDeadEnd && !isClosureNear(startPt);
          const endIsRedundant = isEndDeadEnd && !isClosureNear(endPt);
          
          if ((startIsRedundant || endIsRedundant) && cab.length < 15.0) {
            toRemove.add(i);
          }
        }
        
        if (toRemove.size === 0) break;
        
        // Remove pruned cables from plannedCables array
        const remaining = plannedCables.filter((_, idx) => !toRemove.has(idx));
        plannedCables.length = 0;
        plannedCables.push(...remaining);
      }

      // Re-index remaining cables to maintain contiguity
      let newCableIdx = 1;
      for (const cb of plannedCables) {
        cb.index = newCableIdx++;
      }
    };
    
    pruneRedundantTails();

    // --- Post-Processing: Shift all generated elements (closures, poles, cables) to the road shoulder ---
    if (roads && roads.length > 0) {
      // Since Dijkstra already routed along the road shoulders, the cables and closures
      // are already offset. We can directly generate poles on these coordinates!
      const globalPoles = GISPolePlacement.generatePolesGlobally(
        plannedCables, plannedClosures, PLAN_CONFIG.POLE_SPACING_METERS, roads
      );
      plannedPoles.push(...globalPoles);

      // --- Intelligent Pole Deduplication: Merge poles within 12 meters ---
      const poleMergeMap = new Map<string, [number, number]>();
      const finalPoles: typeof plannedPoles = [];

      for (const p of plannedPoles) {
        // If this pole is located at a closure (FDP/Joint), we prioritize keeping it at the closure position
        const isClosurePole = plannedClosures.some(c => 
          GISGeometry.getDistanceMeters(p.latitude, p.longitude, c.latitude, c.longitude) < 1.0
        );

        let merged = false;
        for (const fp of finalPoles) {
          const dist = GISGeometry.getDistanceMeters(p.latitude, p.longitude, fp.latitude, fp.longitude);
          if (dist < 12) {
            // Keep the closure pole if there's a conflict
            const fpIsClosure = plannedClosures.some(c => 
              GISGeometry.getDistanceMeters(fp.latitude, fp.longitude, c.latitude, c.longitude) < 1.0
            );

            if (isClosurePole && !fpIsClosure) {
              // Swap them: replace fp with p in finalPoles, and map fp to p
              const fpIndex = finalPoles.indexOf(fp);
              if (fpIndex !== -1) {
                finalPoles[fpIndex] = p;
                const fpKey = `${fp.longitude.toFixed(6)},${fp.latitude.toFixed(6)}`;
                poleMergeMap.set(fpKey, [p.longitude, p.latitude]);
              }
            } else {
              // Map p to fp
              const pKey = `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`;
              poleMergeMap.set(pKey, [fp.longitude, fp.latitude]);
            }
            merged = true;
            break;
          }
        }
        if (!merged) {
          finalPoles.push(p);
        }
      }

      // Update plannedPoles list
      plannedPoles.length = 0;
      plannedPoles.push(...finalPoles);

      // Re-index remaining poles sequentially starting at 1
      let nextPoleIdx = 1;
      for (const p of plannedPoles) {
        p.index = nextPoleIdx++;
      }

      // Update all cable coordinates to use the merged pole coordinates and deduplicate
      for (const cb of plannedCables) {
        const newCoords: [number, number][] = [];
        for (const coord of cb.coordinates) {
          const key = `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`;
          if (poleMergeMap.has(key)) {
            newCoords.push(poleMergeMap.get(key)!);
          } else {
            newCoords.push(coord);
          }
        }

        // Clean up consecutive duplicates in the coordinate path
        const deduplicatedCoords: [number, number][] = [];
        for (const coord of newCoords) {
          if (deduplicatedCoords.length === 0) {
            deduplicatedCoords.push(coord);
          } else {
            const last = deduplicatedCoords[deduplicatedCoords.length - 1];
            const dist = GISGeometry.getDistanceMeters(coord[1], coord[0], last[1], last[0]);
            if (dist > 0.1) {
              deduplicatedCoords.push(coord);
            }
          }
        }
        cb.coordinates = deduplicatedCoords;
      }

      // --- Greedy Span Aggregation: Merge intermediate poles if the resulting span <= 38m ---
      const intersections: { lat: number; lon: number }[] = [];
      if (roads && roads.length > 0) {
        try {
          const topo = GISRoadNetwork.buildRoadTopology(roads);
          intersections.push(...topo.intersections);
        } catch (e) {
          console.error(e);
        }
      }

      // --- Greedy Span Aggregation (Priority-Queue Order Optimization) ---
      // Instead of sequential processing (which is order-dependent), collect all
      // eligible (prev,curr,next) triples, sort by combined span length (shortest
      // first = least cable wastage), and merge in that priority order.
      let simplified = true;
      while (simplified) {
        simplified = false;

        // Phase 1: Collect all merge candidates with their combined span distances
        type MergeCandidate = {
          cableIdx: number;
          coordIdx: number;
          combinedSpan: number;
          coordKey: string;
        };
        const mergeCandidates: MergeCandidate[] = [];

        for (let cbIdx = 0; cbIdx < plannedCables.length; cbIdx++) {
          const coords = plannedCables[cbIdx].coordinates;
          if (coords.length < 3) continue;

          for (let i = 1; i < coords.length - 1; i++) {
            const prev = coords[i - 1];
            const curr = coords[i];
            const next = coords[i + 1];

            // Check if curr is a closure (closures must have a pole)
            const isClosure = plannedClosures.some(c =>
              GISGeometry.getDistanceMeters(curr[1], curr[0], c.latitude, c.longitude) < 1.0
            );
            if (isClosure) continue;

            // Check if curr is at a road junction (protected)
            let isJunction = false;
            for (const ix of intersections) {
              if (GISGeometry.getDistanceMeters(curr[1], curr[0], ix.lat, ix.lon) < 15.0) {
                isJunction = true;
                break;
              }
            }
            // Also check proximity to any road centerline junction node
            if (!isJunction && roads && roads.length > 0) {
              for (const road of roads) {
                for (const coord of road.coordinates) {
                  const d = GISGeometry.getDistanceMeters(curr[1], curr[0], coord[1], coord[0]);
                  if (d < 15.0) {
                    for (const ix of intersections) {
                      if (GISGeometry.getDistanceMeters(coord[1], coord[0], ix.lat, ix.lon) < 1.0) {
                        isJunction = true;
                        break;
                      }
                    }
                  }
                  if (isJunction) break;
                }
                if (isJunction) break;
              }
            }
            if (isJunction) continue;

            const dist1 = GISGeometry.getDistanceMeters(prev[1], prev[0], curr[1], curr[0]);
            const dist2 = GISGeometry.getDistanceMeters(curr[1], curr[0], next[1], next[0]);
            const combined = dist1 + dist2;

            if (combined <= 38.0) {
              mergeCandidates.push({
                cableIdx: cbIdx,
                coordIdx: i,
                combinedSpan: combined,
                coordKey: `${curr[0].toFixed(6)},${curr[1].toFixed(6)}`,
              });
            }
          }
        }

        if (mergeCandidates.length === 0) break;

        // Phase 2: Sort by combined span ascending (shortest spans = least waste from merging)
        mergeCandidates.sort((a, b) => a.combinedSpan - b.combinedSpan);

        // Phase 3: Process in sorted order — merge the best candidate, then restart
        for (const candidate of mergeCandidates) {
          const coords = plannedCables[candidate.cableIdx].coordinates;
          // Validate the candidate is still valid (coordinate may have been shifted by earlier merges)
          if (candidate.coordIdx >= coords.length - 1 || candidate.coordIdx < 1) continue;
          const curr = coords[candidate.coordIdx];
          const currKey = `${curr[0].toFixed(6)},${curr[1].toFixed(6)}`;
          if (currKey !== candidate.coordKey) continue; // Coordinate changed, skip

          // Re-check that this point is still not a closure or junction
          const isStillClosure = plannedClosures.some(c =>
            GISGeometry.getDistanceMeters(curr[1], curr[0], c.latitude, c.longitude) < 1.0
          );
          if (isStillClosure) continue;

          // Perform the merge
          coords.splice(candidate.coordIdx, 1);

          // Remove the corresponding pole
          const indexToRemove = plannedPoles.findIndex(p =>
            `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}` === candidate.coordKey
          );
          if (indexToRemove !== -1) {
            plannedPoles.splice(indexToRemove, 1);
          }

          simplified = true;
          break; // Restart the outer loop to recalculate candidates after geometry changed
        }
      }
      // --- Span Safety Check: Inject intermediate poles for any span exceeding 40m ---
      let poleIndexCounter = plannedPoles.length + 1;
      const finalCables = [...plannedCables];

      for (const cb of finalCables) {
        if (cb.cableType === 'DROP') continue;
        const coords = cb.coordinates;
        const newCoords: [number, number][] = [coords[0]];

        for (let i = 0; i < coords.length - 1; i++) {
          const p1 = coords[i];
          const p2 = coords[i + 1];
          const dist = GISGeometry.getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);

          if (dist > 40) {
              // Inject intermediate poles!
              const numSplits = Math.ceil(dist / 38);
              for (let s = 1; s < numSplits; s++) {
                const t = s / numSplits;
                const ipLon = p1[0] + t * (p2[0] - p1[0]);
                const ipLat = p1[1] + t * (p2[1] - p1[1]);

                let shouldSkip = false;

                // 1. Skip if on road centerline (<1.2m from any road centerline)
                if (roads) {
                  for (const road of roads) {
                    for (let k = 0; k < road.coordinates.length - 1; k++) {
                      const rp1 = road.coordinates[k];
                      const rp2 = road.coordinates[k + 1];
                      const snapped = GISRoadNetwork.snapPointToSegment(ipLon, ipLat, rp1[0], rp1[1], rp2[0], rp2[1]);
                      const d = GISGeometry.getDistanceMeters(ipLat, ipLon, snapped.lat, snapped.lon);
                      if (d < 1.2) {
                        shouldSkip = true;
                        break;
                      }
                    }
                    if (shouldSkip) break;
                  }
                }

                // 2. Skip if within 6m of any intersection/T-junction center
                if (!shouldSkip) {
                  for (const ix of intersections) {
                    if (GISGeometry.getDistanceMeters(ipLat, ipLon, ix.lat, ix.lon) < 6.0) {
                      shouldSkip = true;
                      break;
                    }
                  }
                }

                // Determine if this pole is at a road crossing (needs 8.0m height)
                let isRoadCrossing = false;
                if (intersections.length > 0) {
                  for (const ix of intersections) {
                    if (GISGeometry.getDistanceMeters(ipLat, ipLon, ix.lat, ix.lon) < 30.0) {
                      isRoadCrossing = true;
                      break;
                    }
                  }
                }
                // Also check roundabout proximity
                if (!isRoadCrossing && roads && roads.length > 0) {
                  for (const road of roads) {
                    if (road.highwayType === 'roundabout') {
                      for (const rc of road.coordinates) {
                        if (GISGeometry.getDistanceMeters(ipLat, ipLon, rc[1], rc[0]) < 30.0) {
                          isRoadCrossing = true;
                          break;
                        }
                      }
                    }
                    if (isRoadCrossing) break;
                  }
                }

                // Determine if nearest road is a major road
                let isMajorRoad = false;
                if (roads && roads.length > 0) {
                  let minDistance = Infinity;
                  let nearestRoad = null;
                  for (const road of roads) {
                    for (let k = 0; k < road.coordinates.length - 1; k++) {
                      const rp1 = road.coordinates[k];
                      const rp2 = road.coordinates[k + 1];
                      const snapped = GISRoadNetwork.snapPointToSegment(ipLon, ipLat, rp1[0], rp1[1], rp2[0], rp2[1]);
                      const d = GISGeometry.getDistanceMeters(ipLat, ipLon, snapped.lat, snapped.lon);
                      if (d < minDistance) {
                        minDistance = d;
                        nearestRoad = road;
                      }
                    }
                  }
                  if (nearestRoad && minDistance < 50) {
                    const hw = nearestRoad.highwayType || '';
                    const isMajor = ['motorway', 'trunk', 'primary', 'secondary'].includes(hw) || 
                                    (nearestRoad.lanes && Number(nearestRoad.lanes) >= 4);
                    if (isMajor) {
                      isMajorRoad = true;
                    }
                  }
                }

                // Standard Pole Heights: 8.0m for road crossings, 6.7m for major road shoulders, 5.6m for minor roads
                const poleHeight = isRoadCrossing ? 8.0 : (isMajorRoad ? 6.7 : 5.6);

                if (!shouldSkip) {
                  const newPole = {
                    index: poleIndexCounter++,
                    latitude: ipLat,
                    longitude: ipLon,
                    status: 'PLANNED' as const,
                    poleType: 'CONCRETE' as const,
                    height: poleHeight
                  };
                  plannedPoles.push(newPole);
                  newCoords.push([ipLon, ipLat]);
                } else {
                  // Pole skipped (centerline/intersection) — try nudging to road shoulder
                  let nudgeLon = ipLon;
                  let nudgeLat = ipLat;
                  let nudged = false;
                  if (roads && roads.length > 0) {
                    // Find the nearest road centerline point and offset perpendicular
                    let bestDist = Infinity;
                    let bestRoadDir: [number, number] | null = null;
                    for (const road of roads) {
                      for (let k = 0; k < road.coordinates.length - 1; k++) {
                        const rp1 = road.coordinates[k];
                        const rp2 = road.coordinates[k + 1];
                        const snapped = GISRoadNetwork.snapPointToSegment(ipLon, ipLat, rp1[0], rp1[1], rp2[0], rp2[1]);
                        const d = GISGeometry.getDistanceMeters(ipLat, ipLon, snapped.lat, snapped.lon);
                        if (d < bestDist) {
                          bestDist = d;
                          bestRoadDir = [rp2[0] - rp1[0], rp2[1] - rp1[1]];
                        }
                      }
                    }
                    if (bestRoadDir && (bestRoadDir[0] !== 0 || bestRoadDir[1] !== 0)) {
                      // Perpendicular to road direction (right side): (dy, -dx) normalized * 7m
                      const len = Math.sqrt(bestRoadDir[0] ** 2 + bestRoadDir[1] ** 2);
                      const nx = bestRoadDir[1] / len;
                      const ny = -bestRoadDir[0] / len;
                      const offsetDeg = 7.0 * 0.000009;
                      nudgeLon = ipLon + nx * offsetDeg;
                      nudgeLat = ipLat + ny * offsetDeg;
                      nudged = true;
                    }
                  }
                  if (nudged) {
                    const newPole = {
                      index: poleIndexCounter++,
                      latitude: nudgeLat,
                      longitude: nudgeLon,
                      status: 'PLANNED' as const,
                      poleType: 'CONCRETE' as const,
                      height: poleHeight
                    };
                    plannedPoles.push(newPole);
                    // Cable path follows the nudged pole position, not the original centerline
                    newCoords.push([nudgeLon, nudgeLat]);
                  } else {
                    // No pole here, but keep the waypoint for cable routing continuity
                    newCoords.push([ipLon, ipLat]);
                  }
                }
              }
              newCoords.push(p2);
          } else {
            newCoords.push(p2);
          }
        }
        cb.coordinates = newCoords;
      }

      // --- Safety-Injected Pole Deduplication: Merge safety poles within 12m of existing poles ---
      // Safety injection runs after the initial 12m merge, so injected poles may be near existing ones.
      const safetyMergeMap = new Map<string, [number, number]>();
      const deduplicatedSafetyPoles: typeof plannedPoles = [];

      for (const p of plannedPoles) {
        let mergedInSafety = false;
        for (const dp of deduplicatedSafetyPoles) {
          const dist = GISGeometry.getDistanceMeters(p.latitude, p.longitude, dp.latitude, dp.longitude);
          if (dist < 12) {
            // Keep the pole closer to a closure
            const pIsClosurePole = plannedClosures.some(c =>
              GISGeometry.getDistanceMeters(p.latitude, p.longitude, c.latitude, c.longitude) < 1.0
            );
            const dpIsClosurePole = plannedClosures.some(c =>
              GISGeometry.getDistanceMeters(dp.latitude, dp.longitude, c.latitude, c.longitude) < 1.0
            );

            if (pIsClosurePole && !dpIsClosurePole) {
              const dpIndex = deduplicatedSafetyPoles.indexOf(dp);
              if (dpIndex !== -1) {
                deduplicatedSafetyPoles[dpIndex] = p;
                const dpKey = `${dp.longitude.toFixed(6)},${dp.latitude.toFixed(6)}`;
                safetyMergeMap.set(dpKey, [p.longitude, p.latitude]);
              }
            } else {
              const pKey = `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`;
              safetyMergeMap.set(pKey, [dp.longitude, dp.latitude]);
            }
            mergedInSafety = true;
            break;
          }
        }
        if (!mergedInSafety) {
          deduplicatedSafetyPoles.push(p);
        }
      }

      plannedPoles.length = 0;
      plannedPoles.push(...deduplicatedSafetyPoles);

      // Update cable coordinates to use safety dedup positions
      if (safetyMergeMap.size > 0) {
        for (const cb of plannedCables) {
          const updatedSafetyCoords: [number, number][] = [];
          for (const coord of cb.coordinates) {
            const key = `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`;
            if (safetyMergeMap.has(key)) {
              updatedSafetyCoords.push(safetyMergeMap.get(key)!);
            } else {
              updatedSafetyCoords.push(coord);
            }
          }
          // Deduplicate consecutive points
          const deduped: [number, number][] = [];
          for (const coord of updatedSafetyCoords) {
            if (deduped.length === 0) {
              deduped.push(coord);
            } else {
              const last = deduped[deduped.length - 1];
              if (GISGeometry.getDistanceMeters(coord[1], coord[0], last[1], last[0]) > 0.1) {
                deduped.push(coord);
              }
            }
          }
          cb.coordinates = deduped;
        }
      }

      // Re-index all poles so they are sequential
      let safetyPoleIdx = 1;
      for (const p of plannedPoles) {
        p.index = safetyPoleIdx++;
      }
    } else {
      const globalPoles = GISPolePlacement.generatePolesGlobally(
        plannedCables, plannedClosures, PLAN_CONFIG.POLE_SPACING_METERS, roads
      );
      plannedPoles.push(...globalPoles);
    }

    // Snap standard coverage-aware closures (DPs) to the nearest planned pole coordinates exactly!
    // Keep dedicated MDU closures on the building itself.
    for (const closure of plannedClosures) {
      if (closure.mduBuildingId) continue; // MDU closures stay on the building
      if (closure.index === 0) continue;   // Feed Point stays snapped to OLT

      let nearestPole = null;
      let minDist = Infinity;
      for (const pole of plannedPoles) {
        const d = GISGeometry.getDistanceMeters(closure.latitude, closure.longitude, pole.latitude, pole.longitude);
        if (d < minDist) {
          minDist = d;
          nearestPole = pole;
        }
      }

      if (nearestPole && minDist < 35.0) {
        const oldLon = closure.longitude;
        const oldLat = closure.latitude;

        closure.latitude = nearestPole.latitude;
        closure.longitude = nearestPole.longitude;

        // Also update any cable connections or drop cable endpoints to match the new snapped coordinates
        for (const cb of plannedCables) {
          for (let i = 0; i < cb.coordinates.length; i++) {
            const coord = cb.coordinates[i];
            if (GISGeometry.getDistanceMeters(coord[1], coord[0], oldLat, oldLon) < 1.0) {
              cb.coordinates[i] = [nearestPole.longitude, nearestPole.latitude];
            }
          }
        }
      }
    }

    const totalCableLength = plannedCables.reduce((acc, c) => acc + c.length, 0);

    const validationResult = GISPlanValidator.validate(
      plannedCables,
      plannedClosures,
      plannedPoles,
      roads
    );

    return {
      poles: plannedPoles,
      closures: plannedClosures,
      cables: plannedCables,
      debugLogs,
      summary: {
        totalBuildings: buildingsCount,
        mduCount,
        sduCount,
        fdpCount: plannedClosures.length,
        poleCount: plannedPoles.length,
        totalCableLength,
        engineeringQualityScore: validationResult.score,
        violations: validationResult.violations,
      },
      osmData: overpassData
    };
  }



  private static calculatePathLength(coords: [number, number][]): number {
    let length = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      length += GISGeometry.getDistanceMeters(
        coords[i][1],
        coords[i][0],
        coords[i + 1][1],
        coords[i + 1][0]
      );
    }
    return length;
  }
}