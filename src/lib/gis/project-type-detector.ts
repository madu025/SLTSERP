// ============================================================================
// PROJECT TYPE DETECTOR - Auto-detect OSP Project Type from GIS Layers
// ============================================================================
// Uses heuristic rules and confidence scoring to determine project type
// ============================================================================

import {
  DetectedProjectType,
  ProjectTypeDetectionResult,
  ParsedCableData,
  ParsedPoleData,
  ParsedFDPData,
  ParsedFiberJointData,
  ParsedRoadData,
  GISLayerType,
} from '@/types/gis';

/**
 * Project Type Detection Engine
 * Automatically determines the OSP project type based on GIS layer analysis
 */
export class ProjectTypeDetector {
  /**
   * Detect project type from parsed GIS layers
   */
  detect(
    layers: Map<GISLayerType, any>
  ): ProjectTypeDetectionResult {
    const hasCables = layers.has('CABLE');
    const hasPoles = layers.has('POLE');
    const hasFDPs = layers.has('FDP');
    const hasJoints = layers.has('FIBER_JOINT');
    const hasRoads = layers.has('ROAD_EOP');

    const cableData = layers.get('CABLE') as ParsedCableData | undefined;
    const poleData = layers.get('POLE') as ParsedPoleData | undefined;
    const fdpData = layers.get('FDP') as ParsedFDPData | undefined;
    const jointData = layers.get('FIBER_JOINT') as ParsedFiberJointData | undefined;
    const roadData = layers.get('ROAD_EOP') as ParsedRoadData | undefined;

    const routeLength = cableData?.totalLength || 0;
    const poleCount = poleData?.featureCount || 0;
    const fdpCount = fdpData?.featureCount || 0;
    const jointCount = jointData?.featureCount || 0;
    const totalAssets = poleCount + fdpCount + jointCount;

    // ======================================================================
    // Detection Rule 1: SSD (Subscriber Service Delivery)
    // FDPs + Fiber Cables + Building Coverage indicators
    // ======================================================================
    if (hasFDPs && hasCables && fdpCount >= 1) {
      const reasons: string[] = [];
      let confidence = 0;

      // FDPs present - strong indicator
      if (fdpCount > 0) {
        confidence += 35;
        reasons.push(`${fdpCount} FDP(s) detected`);
      }

      // Cables present
      if (hasCables) {
        confidence += 20;
        reasons.push(
          `Fiber cable(s) detected: ${(routeLength / 1000).toFixed(2)} km`
        );
      }

      // Poles present with FDPs - more likely SSD
      if (hasPoles && poleCount > 0) {
        confidence += 15;
        reasons.push(`${poleCount} pole(s) supporting distribution`);
      }

      // Joints present
      if (hasJoints) {
        confidence += 10;
        reasons.push(`${jointCount} joint closure(s)`);
      }

      // Moderate route length (SSD typically < 15km)
      if (routeLength > 100 && routeLength < 15000) {
        confidence += 10;
        reasons.push(`Route length ${(routeLength / 1000).toFixed(2)} km (SSD range)`);
      }

      // If there are roads as well
      if (hasRoads) {
        confidence += 5;
        reasons.push('Road crossing data available');
      }

      // Check for building coverage in properties
      const hasBuildingData = this.checkBuildingCoverage(layers);
      if (hasBuildingData) {
        confidence += 5;
        reasons.push('Building coverage data detected');
      }

      return {
        projectType: 'SSD',
        confidence: Math.min(confidence, 100),
        reasons,
        detectedFrom: {
          hasFDPs,
          hasCables,
          hasPoles,
          hasRoads,
          hasJoints,
          routeLength,
          totalAssets,
        },
      };
    }

    // ======================================================================
    // Detection Rule 2: Cluster Development
    // Large route length, many poles, many FDPs
    // ======================================================================
    if (
      hasCables &&
      routeLength > 5000 &&
      poleCount > 50
    ) {
      const reasons: string[] = [];
      let confidence = 0;

      if (routeLength > 5000) {
        confidence += 30;
        reasons.push(
          `Large route length: ${(routeLength / 1000).toFixed(2)} km`
        );
      }

      if (poleCount > 50) {
        confidence += 25;
        reasons.push(`High pole count: ${poleCount}`);
      }

      if (hasFDPs && fdpCount > 5) {
        confidence += 15;
        reasons.push(`Multiple FDPs: ${fdpCount}`);
      }

      if (hasJoints && jointCount > 3) {
        confidence += 10;
        reasons.push(`Multiple joint closures: ${jointCount}`);
      }

      if (totalAssets > 100) {
        confidence += 10;
        reasons.push(`Large asset count: ${totalAssets}`);
      }

      if (hasRoads) {
        confidence += 5;
        reasons.push('Road network data included');
      }

      // Check for building clusters in data
      const clusterHint = this.checkClusterHints(layers);
      if (clusterHint) {
        confidence += 5;
        reasons.push('Cluster patterns detected in GIS data');
      }

      return {
        projectType: 'CLUSTER_DEVELOPMENT',
        confidence: Math.min(confidence, 100),
        reasons,
        detectedFrom: {
          hasFDPs,
          hasCables,
          hasPoles,
          hasRoads,
          hasJoints,
          routeLength,
          totalAssets,
        },
      };
    }

    // ======================================================================
    // Detection Rule 3: Building Fiber
    // Building layer dominant or high density FDPs with short cables
    // ======================================================================
    if (
      (hasFDPs && fdpCount > 3 && routeLength < 5000) ||
      this.checkBuildingDominant(layers)
    ) {
      const reasons: string[] = [];
      let confidence = 0;

      if (this.checkBuildingDominant(layers)) {
        confidence += 40;
        reasons.push('Building coverage data dominant');
      }

      if (hasFDPs && fdpCount > 3) {
        confidence += 25;
        reasons.push(`Multiple FDPs: ${fdpCount} (high density)`);
      }

      if (hasCables && routeLength < 5000) {
        confidence += 15;
        reasons.push(
          `Short cable runs: ${(routeLength / 1000).toFixed(2)} km (building fiber pattern)`
        );
      }

      if (totalAssets > 20) {
        confidence += 10;
        reasons.push(`Asset density: ${totalAssets} in short range`);
      }

      return {
        projectType: 'BUILDING_FIBER',
        confidence: Math.min(confidence, 100),
        reasons,
        detectedFrom: {
          hasFDPs,
          hasCables,
          hasPoles,
          hasRoads,
          hasJoints,
          routeLength,
          totalAssets,
        },
      };
    }

    // ======================================================================
    // Fallback: Unknown - try best guess
    // ======================================================================
    const reasons: string[] = ['Unable to determine project type with high confidence'];
    let confidence = 0;

    if (hasCables) {
      confidence += 25;
      reasons.push(`Cable data: ${(routeLength / 1000).toFixed(2)} km`);
    }
    if (hasPoles) {
      confidence += 15;
      reasons.push(`${poleCount} poles`);
    }
    if (hasFDPs) {
      confidence += 15;
      reasons.push(`${fdpCount} FDPs`);
    }
    if (hasRoads) {
      confidence += 10;
      reasons.push(`${roadData?.featureCount || 0} road segments`);
    }

    // Default to SSD for small/medium projects with FDPs
    if (hasFDPs && hasCables) {
      return {
        projectType: 'SSD',
        confidence: Math.min(confidence + 10, 70),
        reasons: [...reasons, 'Defaulting to SSD based on available data'],
        detectedFrom: {
          hasFDPs,
          hasCables,
          hasPoles,
          hasRoads,
          hasJoints,
          routeLength,
          totalAssets,
        },
      };
    }

    // Default to Cluster for large route projects
    if (hasCables && routeLength > 3000) {
      return {
        projectType: 'CLUSTER_DEVELOPMENT',
        confidence: Math.min(confidence + 5, 60),
        reasons: [...reasons, 'Defaulting to Cluster Development based on route length'],
        detectedFrom: {
          hasFDPs,
          hasCables,
          hasPoles,
          hasRoads,
          hasJoints,
          routeLength,
          totalAssets,
        },
      };
    }

    return {
      projectType: 'UNKNOWN',
      confidence,
      reasons,
      detectedFrom: {
        hasFDPs,
        hasCables,
        hasPoles,
        hasRoads,
        hasJoints,
        routeLength,
        totalAssets,
      },
    };
  }

  /**
   * Check if GIS properties contain building coverage hints
   */
  private checkBuildingCoverage(
    layers: Map<GISLayerType, any>
  ): boolean {
    // Check if there's a building layer
    if (layers.has('BUILDING')) return true;

    // Check FDP properties for building info
    const fdpData = layers.get('FDP') as ParsedFDPData | undefined;
    if (fdpData) {
      for (const fdp of fdpData.fdps) {
        if (
          fdp.properties?.building_count ||
          fdp.properties?.subscribers ||
          fdp.properties?.coverage_area
        ) {
          return true;
        }
      }
    }

    // Check cable properties for building info
    const cableData = layers.get('CABLE') as ParsedCableData | undefined;
    if (cableData) {
      for (const segment of cableData.segments) {
        if (
          segment.coordinates.length > 10 &&
          cableData.totalLength > 0
        ) {
          // Check if properties have building-related fields
          if (segment.cableType?.includes('DROP') || segment.cableType?.includes('dwelling')) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check for cluster patterns in GIS data
   */
  private checkClusterHints(
    layers: Map<GISLayerType, any>
  ): boolean {
    const poleData = layers.get('POLE') as ParsedPoleData | undefined;

    if (poleData && poleData.poles.length > 20) {
      // Check if poles are densely clustered
      const clusters = this.findClusters(
        poleData.poles.map((p) => [p.longitude, p.latitude] as [number, number])
      );
      return clusters.length > 2;
    }

    return false;
  }

  /**
   * Check if building layer is dominant
   */
  private checkBuildingDominant(
    layers: Map<GISLayerType, any>
  ): boolean {
    if (layers.has('BUILDING')) return true;

    const fdpData = layers.get('FDP') as ParsedFDPData | undefined;
    if (fdpData && fdpData.fdps.length > 5) {
      // Check if FDPs have building-specific metadata
      const buildingRelated = fdpData.fdps.filter(
        (f) =>
          f.properties?.building_type ||
          f.properties?.floor_count ||
          f.properties?.apartments
      );
      return buildingRelated.length > 2;
    }

    return false;
  }

  /**
   * Simple cluster detection using distance-based grouping
   */
  private findClusters(
    points: [number, number][],
    maxDistance: number = 500
  ): Array<[number, number][]> {
    const clusters: Array<[number, number][]> = [];
    const visited = new Set<number>();

    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;

      const cluster: [number, number][] = [points[i]];
      visited.add(i);

      for (let j = i + 1; j < points.length; j++) {
        if (visited.has(j)) continue;

        const dist = this.euclideanDistance(points[i], points[j]);
        if (dist < maxDistance) {
          cluster.push(points[j]);
          visited.add(j);
        }
      }

      if (cluster.length > 2) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Simple Euclidean distance (good enough for small areas)
   */
  private euclideanDistance(
    p1: [number, number],
    p2: [number, number]
  ): number {
    const dLat = (p2[1] - p1[1]) * 111320; // meters per degree
    const dLon = (p2[0] - p1[0]) * 111320 * Math.cos((p1[1] + p2[1]) / 2 * (Math.PI / 180));
    return Math.sqrt(dLat * dLat + dLon * dLon);
  }
}

// Singleton instance
export const projectTypeDetector = new ProjectTypeDetector();
