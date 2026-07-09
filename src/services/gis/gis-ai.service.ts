import { primaryClient as prisma } from '@/lib/prisma';
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
    projectId: string,
    options: AIOptimizeRouteOptions = {}
  ): Promise<AIOptimizeRouteResult> {
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) throw new Error("Project not found");

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
  static detectGISAnomalies(geojsonData: any): GISAnomaly[] {
    return GISValidatorService.detectGISAnomalies(geojsonData);
  }

  // 3. As-Built vs Planned Mismatch Auditor
  static detectBuiltMismatch(plannedGeoJSON: any, builtGeoJSON: any) {
    return GISValidatorService.detectBuiltMismatch(plannedGeoJSON, builtGeoJSON);
  }

  // 4. Auto BOQ Generation from GIS Upload
  static async generateBOQFromGIS(projectId: string, geojsonData: any) {
    const features = geojsonData?.features || [];
    let poleCount = 0;
    let cableMeters = 0;
    let fdpCount = 0;

    for (const f of features) {
      const geomType = f.geometry?.type;
      const layerName = (f.properties?.layer || f.properties?.Layer || '').toUpperCase();

      if (geomType === 'Point') {
        if (layerName.includes('POLE')) {
          poleCount++;
        } else if (layerName.includes('FDP')) {
          fdpCount++;
        }
      } else if (geomType === 'LineString' && Array.isArray(f.geometry.coordinates)) {
        const coords = f.geometry.coordinates;
        for (let i = 0; i < coords.length - 1; i++) {
          cableMeters += GISLocationService.getDistance(
            coords[i][1],
            coords[i][0],
            coords[i + 1][1],
            coords[i + 1][0]
          );
        }
      }
    }

    // Try to find matching Inventory Items in database to associate IDs
    const poleItem = await prisma.inventoryItem.findFirst({
      where: { name: { contains: 'Pole' } }
    });
    const cableItem = await prisma.inventoryItem.findFirst({
      where: { name: { contains: 'Cable' } }
    });

    const boqUpdates = [];

    if (poleCount > 0) {
      boqUpdates.push(
        prisma.projectBOQItem.create({
          data: {
            projectId,
            itemCode: 'POLE-AI',
            description: `Poles (AI detected from GIS project)`,
            unit: 'NOS',
            quantity: poleCount,
            unitRate: 15000,
            amount: poleCount * 15000,
            source: 'EXISTING',
            materialId: poleItem?.id || null
          }
        })
      );
    }

    if (cableMeters > 0) {
      const roundedCable = Math.ceil(cableMeters);
      boqUpdates.push(
        prisma.projectBOQItem.create({
          data: {
            projectId,
            itemCode: 'CABLE-AI',
            description: `Fiber Cable (AI calculated path length from GIS)`,
            unit: 'M',
            quantity: roundedCable,
            unitRate: 250,
            amount: roundedCable * 250,
            source: 'EXISTING',
            materialId: cableItem?.id || null
          }
        })
      );
    }

    if (boqUpdates.length > 0) {
      await prisma.$transaction(boqUpdates);
    }

    return {
      polesDetected: poleCount,
      cableMetersCalculated: Math.ceil(cableMeters),
      fdpsDetected: fdpCount,
      boqItemsAdded: boqUpdates.length
    };
  }
}
