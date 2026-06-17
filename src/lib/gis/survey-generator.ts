// ============================================================================
// SURVEY TASK GENERATOR - Auto-generate Survey Tasks from GIS Data
// ============================================================================
// Creates survey tasks for poles, FDPs, fiber joints, road crossings,
// and new point-asset layer types (duct, handhole, manhole, ODF, etc.)
// ============================================================================

import {
  ParsedPoleData,
  ParsedFDPData,
  ParsedFiberJointData,
  ParsedRoadData,
  ParsedPointAssetData,
  GISLayerType,
} from '@/types/gis';

export interface SurveyTask {
  title: string;
  description: string;
  taskType: string;
  latitude: number;
  longitude: number;
  priority: string;
  metadata: Record<string, any>;
}

export interface SurveyGenerationResult {
  tasks: SurveyTask[];
  count: number;
  typeCounts: Record<string, number>;
}

/**
 * Survey Task Generator
 * Creates survey tasks for field verification teams
 */
export class SurveyGenerator {
  /**
   * Generate all survey tasks from GIS data
   */
  generateSurveyTasks(
    layers: Map<GISLayerType, any>
  ): SurveyGenerationResult {
    const allTasks: SurveyTask[] = [];

    const poleData = layers.get('POLE') as ParsedPoleData | undefined;
    const fdpData = layers.get('FDP') as ParsedFDPData | undefined;
    const jointData = layers.get('FIBER_JOINT') as ParsedFiberJointData | undefined;
    const roadData = layers.get('ROAD_EOP') as ParsedRoadData | undefined;

    // 1. Pole Verification Tasks
    if (poleData) {
      poleData.poles.forEach((pole) => {
        allTasks.push({
          title: `Pole Verification - Pole ${pole.index}`,
          description: `Verify pole location, condition, and surroundings at GPS coordinates. Pole type: ${pole.poleType || 'Unknown'}, Height: ${pole.height || 'Unknown'}m`,
          taskType: 'POLE_VERIFICATION',
          latitude: pole.latitude,
          longitude: pole.longitude,
          priority: 'MEDIUM',
          metadata: {
            poleIndex: pole.index,
            poleType: pole.poleType,
            height: pole.height,
          },
        });

        // GPS Capture subtask
        allTasks.push({
          title: `GPS Capture - Pole ${pole.index}`,
          description: `Capture precise GPS coordinates of Pole ${pole.index} using survey-grade GPS equipment`,
          taskType: 'GPS_CAPTURE',
          latitude: pole.latitude,
          longitude: pole.longitude,
          priority: 'HIGH',
          metadata: { poleIndex: pole.index, expectedLat: pole.latitude, expectedLng: pole.longitude },
        });

        // Photo Collection subtask
        allTasks.push({
          title: `Photo Collection - Pole ${pole.index}`,
          description: `Take photos of Pole ${pole.index} from 4 directions (N, S, E, W) showing surroundings, pole condition, and existing infrastructure`,
          taskType: 'PHOTO_COLLECTION',
          latitude: pole.latitude,
          longitude: pole.longitude,
          priority: 'MEDIUM',
          metadata: { poleIndex: pole.index, photoCount: 4 },
        });
      });
    }

    // 2. FDP Verification Tasks
    if (fdpData) {
      fdpData.fdps.forEach((fdp) => {
        allTasks.push({
          title: `FDP Verification - ${fdp.fdpCode || `FDP ${fdp.index}`}`,
          description: `Verify FDP location, port count (${fdp.portCount || 'Unknown'}), and accessibility. Check splitter configuration.`,
          taskType: 'POLE_VERIFICATION',
          latitude: fdp.latitude,
          longitude: fdp.longitude,
          priority: 'HIGH',
          metadata: {
            fdpIndex: fdp.index,
            fdpCode: fdp.fdpCode,
            portCount: fdp.portCount,
            splitters: fdp.splitters,
          },
        });

        // GPS Capture
        allTasks.push({
          title: `GPS Capture - ${fdp.fdpCode || `FDP ${fdp.index}`}`,
          description: `Capture precise GPS coordinates of FDP at location`,
          taskType: 'GPS_CAPTURE',
          latitude: fdp.latitude,
          longitude: fdp.longitude,
          priority: 'HIGH',
          metadata: { fdpIndex: fdp.index, fdpCode: fdp.fdpCode },
        });
      });
    }

    // 3. Fiber Joint Verification Tasks
    if (jointData) {
      jointData.joints.forEach((joint) => {
        allTasks.push({
          title: `Fiber Joint Verification - Joint ${joint.index}`,
          description: `Verify joint closure location, type (${joint.jointType || 'Unknown'}), and capacity (${joint.capacity || 'Unknown'} fibers)`,
          taskType: 'POLE_VERIFICATION',
          latitude: joint.latitude,
          longitude: joint.longitude,
          priority: 'MEDIUM',
          metadata: {
            jointIndex: joint.index,
            jointType: joint.jointType,
            capacity: joint.capacity,
          },
        });
      });
    }

    // 4. Route Verification Task (one per cable segment)
    const cableData = layers.get('CABLE') as any;
    if (cableData && cableData.segments) {
      for (const seg of cableData.segments.slice(0, 5)) {
        // Limit to 5 route tasks
        allTasks.push({
          title: `Route Verification - Segment ${seg.index}`,
          description: `Verify cable route segment ${seg.index} (${seg.length.toFixed(1)}m). Check for obstructions, existing utilities, and access points.`,
          taskType: 'ROUTE_VERIFICATION',
          latitude: seg.fromPoint?.[1] || 0,
          longitude: seg.fromPoint?.[0] || 0,
          priority: 'MEDIUM',
          metadata: {
            segmentIndex: seg.index,
            length: seg.length,
            coordinates: seg.coordinates,
          },
        });
      }
    }

    // 5. Road Crossing Tasks
    if (roadData) {
      roadData.roadSegments.forEach((road) => {
        allTasks.push({
          title: `Road Crossing Survey - ${road.roadName}`,
          description: `Survey road crossing at ${road.roadName} (${road.length.toFixed(1)}m). Check traffic conditions, existing underground utilities, and HDD feasibility.`,
          taskType: 'ROUTE_VERIFICATION',
          latitude: road.coordinates[0]?.[1] || 0,
          longitude: road.coordinates[0]?.[0] || 0,
          priority: 'HIGH',
          metadata: {
            roadName: road.roadName,
            length: road.length,
            roadType: road.roadType,
            authority: road.authority,
          },
        });
      });
    }

    // 6. Verification Tasks for New Point-Asset Layer Types
    //    (DUCT, HANDHOLE, MANHOLE, ODF, RISER, FTC, TEST_POINT, BUILDING)
    const pointAssetConfigs: Array<{ key: GISLayerType; label: string; taskType: string }> = [
      { key: 'DUCT', label: 'Duct', taskType: 'DUCT_VERIFICATION' },
      { key: 'HANDHOLE', label: 'Handhole', taskType: 'HANDHOLE_VERIFICATION' },
      { key: 'MANHOLE', label: 'Manhole', taskType: 'MANHOLE_VERIFICATION' },
      { key: 'ODF', label: 'ODF', taskType: 'ODF_VERIFICATION' },
      { key: 'RISER', label: 'Riser', taskType: 'RISER_VERIFICATION' },
      { key: 'FTC', label: 'FTC', taskType: 'FTC_VERIFICATION' },
      { key: 'TEST_POINT', label: 'Test Point', taskType: 'TEST_POINT_VERIFICATION' },
      { key: 'BUILDING', label: 'Building', taskType: 'BUILDING_VERIFICATION' },
    ];

    for (const cfg of pointAssetConfigs) {
      const data = layers.get(cfg.key) as ParsedPointAssetData | undefined;
      if (!data) continue;
      const assets = (data as any).assets || [];
      assets.forEach((asset: any, idx: number) => {
        const longitude = asset.longitude ?? 0;
        const latitude = asset.latitude ?? 0;
        const name = asset.code || asset.type || `${cfg.label} ${idx + 1}`;

        allTasks.push({
          title: `${cfg.label} Verification - ${name}`,
          description: `Verify ${cfg.label.toLowerCase()} location, condition, and surroundings at GPS coordinates.`,
          taskType: cfg.taskType,
          latitude,
          longitude,
          priority: 'MEDIUM',
          metadata: {
            assetIndex: asset.index ?? idx + 1,
            rawProperties: asset.properties || {},
          },
        });
      });
    }

    // Calculate type counts
    const typeCounts: Record<string, number> = {};
    allTasks.forEach((t) => {
      typeCounts[t.taskType] = (typeCounts[t.taskType] || 0) + 1;
    });

    return {
      tasks: allTasks,
      count: allTasks.length,
      typeCounts,
    };
  }
}

// Singleton instance
export const surveyGenerator = new SurveyGenerator();