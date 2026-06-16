// ============================================================================
// GIS ANALYTICS ENGINE - Route & Coverage Analytics
// ============================================================================
// Computes route analytics, coverage statistics, and cost estimations
// from parsed GIS layers
// ============================================================================

import {
  GISAnalytics,
  CoverageStats,
  ParsedCableData,
  ParsedPoleData,
  ParsedFDPData,
  ParsedFiberJointData,
  ParsedRoadData,
  GISLayerType,
  BOQSummary,
} from '@/types/gis';

export interface AnalyticsInput {
  cableData?: ParsedCableData;
  poleData?: ParsedPoleData;
  fdpData?: ParsedFDPData;
  jointData?: ParsedFiberJointData;
  roadData?: ParsedRoadData;
  boq?: BOQSummary;
  region?: string;
  district?: string;
}

/**
 * GIS Analytics Engine
 * Computes analytics from parsed GIS layers
 */
export class GISAnalyticsEngine {
  /**
   * Compute full analytics from all parsed GIS layers
   */
  compute(input: AnalyticsInput): GISAnalytics {
    const {
      cableData,
      poleData,
      fdpData,
      jointData,
      roadData,
      boq,
      region,
      district,
    } = input;

    // Route & cable lengths
    const totalRouteLength = cableData?.totalLength || 0;
    const totalCableLength = cableData?.totalLength || 0;

    // Asset counts
    const poleCount = poleData?.featureCount || 0;
    const fdpCount = fdpData?.featureCount || 0;
    const fiberJointCount = jointData?.featureCount || 0;

    // Road crossings estimation
    const roadCrossings = this.estimateRoadCrossings(roadData, cableData);

    // Estimated BOQ cost
    const estimatedBOQCost = boq?.totalEstimatedCost || 0;

    // Coverage statistics
    const coverageStatistics = this.computeCoverageStats(
      cableData,
      poleData,
      fdpData,
      region,
      district
    );

    return {
      totalRouteLength: Math.round(totalRouteLength * 100) / 100,
      totalCableLength: Math.round(totalCableLength * 100) / 100,
      poleCount,
      fdpCount,
      fiberJointCount,
      roadCrossings,
      estimatedBOQCost,
      coverageStatistics,
    };
  }

  /**
   * Estimate road crossings from road and cable bounding box overlaps
   */
  private estimateRoadCrossings(
    roadData?: ParsedRoadData,
    cableData?: ParsedCableData
  ): number {
    if (!roadData || !cableData) return 0;

    let crossings = 0;
    for (const road of roadData.roadSegments) {
      for (const segment of cableData.segments) {
        if (this.bboxOverlap(road.coordinates, segment.coordinates)) {
          crossings++;
        }
      }
    }
    return crossings;
  }

  /**
   * Check bounding box overlap between two polylines
   */
  private bboxOverlap(
    line1: [number, number][],
    line2: [number, number][]
  ): boolean {
    if (line1.length < 2 || line2.length < 2) return false;

    const bb1 = this.getBBox(line1);
    const bb2 = this.getBBox(line2);

    return (
      bb1.maxLng >= bb2.minLng &&
      bb2.maxLng >= bb1.minLng &&
      bb1.maxLat >= bb2.minLat &&
      bb2.maxLat >= bb1.minLat
    );
  }

  /**
   * Compute bounding box for coordinate array
   */
  private getBBox(coords: [number, number][]): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    for (const [lng, lat] of coords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    return { minLat, maxLat, minLng, maxLng };
  }

  /**
   * Compute coverage statistics from GIS data
   */
  private computeCoverageStats(
    cableData?: ParsedCableData,
    poleData?: ParsedPoleData,
    fdpData?: ParsedFDPData,
    region?: string,
    district?: string
  ): CoverageStats {
    // Estimate area covered using bounding box of poles/FDPs or cable route
    let areaCovered = 0;

    if (poleData && poleData.poles.length > 1) {
      areaCovered = this.estimateAreaFromPoints(
        poleData.poles.map(p => [p.longitude, p.latitude] as [number, number])
      );
    } else if (fdpData && fdpData.fdps.length > 1) {
      areaCovered = this.estimateAreaFromPoints(
        fdpData.fdps.map(f => [f.longitude, f.latitude] as [number, number])
      );
    } else if (cableData && cableData.segments.length > 0) {
      // Use cable route bounding box
      const allCoords: [number, number][] = [];
      for (const seg of cableData.segments) {
        allCoords.push(...seg.coordinates);
      }
      areaCovered = this.estimateAreaFromPoints(allCoords);
    }

    return {
      region: region || 'UNKNOWN',
      district: district || 'UNKNOWN',
      areaCovered: Math.round(areaCovered * 100) / 100,
    };
  }

  /**
   * Rough area estimation from point set bounding box (square meters)
   */
  private estimateAreaFromPoints(points: [number, number][]): number {
    if (points.length < 2) return 0;

    const bbox = this.getBBox(points);
    const dLat = (bbox.maxLat - bbox.minLat) * 111320; // meters
    const avgLat = (bbox.maxLat + bbox.minLat) / 2;
    const dLon =
      (bbox.maxLng - bbox.minLng) *
      111320 *
      Math.cos((avgLat * Math.PI) / 180);

    return Math.abs(dLat * dLon);
  }
}

// Singleton instance
export const gisAnalyticsEngine = new GISAnalyticsEngine();
