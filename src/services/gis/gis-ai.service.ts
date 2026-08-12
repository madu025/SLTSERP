import { primaryClient as prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { UUID } from '@/types/common';
import { GISLocationService, GISValidatorService, GISAnomaly } from '@/lib/gis/gis-ai-validator';
import { OverpassAPIService, OverpassBounds } from '@/lib/gis/overpass-api.service';
import { OSPPathfindingService, PathfindingResult } from '@/lib/gis/osp-pathfinding.service';

export interface AIOptimizeRouteOptions {
  /** Whether to allow routing through restricted areas (forests, national parks, military) */
  allowRestrictedZones?: boolean;
  /** Maximum span between poles in meters (default 50) */
  maxSpanMeters?: number;
  /** Buffer distance in meters to expand around start/end for Overpass query */
  boundsBufferMeters?: number;
}

export interface AIOptimizeRouteResult {
  /** Optimized path coordinates [lat, lng][] */
  optimizedPath: [number, number][];
  /** Total estimated cable length in meters */
  estimatedCableLengthMeters: number;
  /** Percentage saved vs direct straight-line routing */
  savingPercent: number;
  /** Auto-generated pole positions where spans exceed maxSpan */
  autoPoles: { lat: number; lon: number; type: string }[];
  /** Number of additional poles needed beyond existing project poles */
  autoPoleCount: number;
  /** Warnings for the planner */
  warnings: string[];
  /** Whether Overpass data was used (true) or fell back to direct routing */
  usedOverpassData: boolean;
  /** GeoFeatures summary from Overpass API */
  featuresSummary?: {
    highways: number;
    buildings: number;
    waterways: number;
    bridges: number;
    utilityPolesBlacklisted: number;
    restrictedAreas: number;
  };
}

export class GISAIService {
  
  // 1. AI Cable Route Optimization (Real Dijkstra pathfinding on road network)
  static async optimizeRoute(
    startCoord: [number, number],
    endCoord: [number, number],
    projectId: UUID,
    options: AIOptimizeRouteOptions = {}
  ): Promise<AIOptimizeRouteResult> {
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) throw AppError.notFound("Project not found");

    const startLat = startCoord[0];
    const startLon = startCoord[1];
    const endLat = endCoord[0];
    const endLon = endCoord[1];

    // Compute bounding box for Overpass query
    const bufferMeters = options.boundsBufferMeters || 500; // 500m buffer default
    const latBuffer = bufferMeters / 111320; // ~1 degree = 111.32 km
    const lonBuffer = bufferMeters / (111320 * Math.cos(((startLat + endLat) / 2) * Math.PI / 180));

    const bounds: OverpassBounds = {
      south: Math.min(startLat, endLat) - latBuffer,
      north: Math.max(startLat, endLat) + latBuffer,
      west: Math.min(startLon, endLon) - lonBuffer,
      east: Math.max(startLon, endLon) + lonBuffer,
    };

    // Fetch real geospatial data from Overpass API
    let features;
    let usedOverpassData = false;
    try {
      features = await OverpassAPIService.fetchFeatures(bounds);
      usedOverpassData = features.highways.length > 0 || features.bridges.length > 0;
    } catch (e) {
      console.warn('[GISAIService] Overpass fetch failed, falling back to direct routing:', e);
      // Fall back to empty features → direct routing
      features = {
        highways: [],
        buildings: [],
        waterways: [],
        bridges: [],
        utilityPoles: [],
        restrictedAreas: [],
      };
    }

    // Run Dijkstra pathfinding with OSP constraints
    const result: PathfindingResult = OSPPathfindingService.findOptimalPath(
      startLat,
      startLon,
      endLat,
      endLon,
      features,
      {
        maxSpanMeters: options.maxSpanMeters || 50,
        allowRestrictedZones: options.allowRestrictedZones || false,
        utilityPoleBufferMeters: 5,
      }
    );

    // Convert path nodes to [lat, lng] coordinate pairs
    const routeCoordinates: [number, number][] = result.path.map(node => [node.lat, node.lon]);

    // Calculate straight-line distance for saving percent
    const straightLineDist = GISLocationService.getDistance(startLat, startLon, endLat, endLon);

    // Extract auto-poles (nodes of type 'auto' that aren't start/end)
    const autoPoles = result.path
      .filter(node => node.type === 'auto')
      .map(node => ({
        lat: node.lat,
        lon: node.lon,
        type: 'auto-pole',
      }));

    return {
      optimizedPath: routeCoordinates,
      estimatedCableLengthMeters: result.totalLengthMeters,
      savingPercent: straightLineDist > 0
        ? Math.round(((result.totalLengthMeters - straightLineDist) / straightLineDist) * 100)
        : 0,
      autoPoles,
      autoPoleCount: result.autoPoleCount,
      warnings: result.warnings,
      usedOverpassData,
      featuresSummary: {
        highways: features.highways.length,
        buildings: features.buildings.length,
        waterways: features.waterways.length,
        bridges: features.bridges.length,
        utilityPolesBlacklisted: features.utilityPoles.length,
        restrictedAreas: features.restrictedAreas.length,
      },
    };
  }

  // 2. Geospatial Anomaly Checking
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static detectGISAnomalies(geojsonData: any): GISAnomaly[] {
    return GISValidatorService.detectGISAnomalies(geojsonData);
  }

  // 3. As-Built vs Planned Mismatch Auditor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static detectBuiltMismatch(plannedGeoJSON: any, builtGeoJSON: any) {
    return GISValidatorService.detectBuiltMismatch(plannedGeoJSON, builtGeoJSON);
  }
}
