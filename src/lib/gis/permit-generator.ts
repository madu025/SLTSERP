// ============================================================================
// PERMIT GENERATOR - Auto-generate Permit Segments from Road Layer
// ============================================================================
// Creates permit records for road crossings, wayleaves, and authority permissions
// ============================================================================

import {
  ParsedRoadData,
  GISLayerType,
  PermitSegment,
} from '@/types/gis';

export interface PermitRecord {
  roadName: string;
  authority: string;
  authorityEntity?: string;
  length: number;
  permitType: string;
  permitTypeCode: string;
  status: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  cost: number;
  metadata: Record<string, any>;
}

export interface PermitGenerationResult {
  permits: PermitRecord[];
  count: number;
  authorities: string[];
}

/**
 * Permit Generator
 * Creates permit segments from road/EOP GIS data
 */
export class PermitGenerator {
  private readonly DEFAULT_PERMIT_COST = 25000; // LKR - standard road cutting permit fee

  /**
   * Generate permit records from road layer data
   */
  generatePermits(
    layers: Map<GISLayerType, any>,
    region?: string
  ): PermitGenerationResult {
    const permits: PermitRecord[] = [];
    const authorities = new Set<string>();

    const roadData = layers.get('ROAD_EOP') as ParsedRoadData | undefined;

    if (!roadData || roadData.roadSegments.length === 0) {
      return { permits, count: 0, authorities: [] };
    }

    // Check for existing cable layer to get road crossing points
    const cableData = layers.get('CABLE') as any;

    roadData.roadSegments.forEach((road) => {
      const authority =
        road.authority || this.inferAuthority(road.roadType, region);
      authorities.add(authority);

      const startPoint = road.coordinates[0];
      const endPoint = road.coordinates[road.coordinates.length - 1];

      permits.push({
        roadName: road.roadName,
        authority,
        authorityEntity: authority,
        length: road.length,
        permitType: 'Road Cutting Permit',
        permitTypeCode: 'ROAD_CUTTING',
        status: 'DRAFT',
        startLatitude: startPoint?.[1] || 0,
        startLongitude: startPoint?.[0] || 0,
        endLatitude: endPoint?.[1] || 0,
        endLongitude: endPoint?.[0] || 0,
        cost: this.calculatePermitCost(road.length, road.roadType),
        metadata: {
          roadType: road.roadType,
          originalProperties: road.properties,
          hasCableCrossing: this.hasCableCrossing(road, cableData),
        },
      });
    });

    // Generate additional wayleave permits if pole data exists
    const poleData = layers.get('POLE') as any;
    if (poleData && poleData.poles) {
      const wayleavePermit = this.generateWayleavePermit(
        poleData.poles.length,
        poleData.poles
      );
      if (wayleavePermit) {
        permits.push(wayleavePermit);
        if (wayleavePermit.authority) authorities.add(wayleavePermit.authority);
      }
    }

    return {
      permits,
      count: permits.length,
      authorities: Array.from(authorities),
    };
  }

  /**
   * Infer the permitting authority based on road type and region
   */
  private inferAuthority(
    roadType?: string,
    region?: string
  ): string {
    if (roadType) {
      const rt = roadType.toUpperCase();
      if (rt.includes('HIGHWAY') || rt.includes('A_CLASS') || rt.includes('NATIONAL')) {
        return 'Road Development Authority (RDA)';
      }
      if (rt.includes('PROVINCIAL') || rt.includes('B_CLASS')) {
        return 'Provincial Road Development Authority';
      }
      if (rt.includes('MUNICIPAL') || rt.includes('C_CLASS') || rt.includes('LOCAL')) {
        return 'Municipal Council';
      }
      if (rt.includes('URBAN')) {
        return 'Urban Council';
      }
      if (rt.includes('PRIVATE') || rt.includes('ACCESS')) {
        return 'Private Land Owner';
      }
    }

    if (region) {
      return `${region} Municipal Council`;
    }

    return 'Road Development Authority (RDA)';
  }

  /**
   * Calculate permit cost based on road length and type
   */
  private calculatePermitCost(
    length: number,
    roadType?: string
  ): number {
    let baseCost = this.DEFAULT_PERMIT_COST;

    if (roadType) {
      const rt = roadType.toUpperCase();
      if (rt.includes('HIGHWAY') || rt.includes('NATIONAL')) {
        baseCost *= 2.5; // Major roads cost more
      } else if (rt.includes('PROVINCIAL')) {
        baseCost *= 1.5;
      } else if (rt.includes('MUNICIPAL') || rt.includes('LOCAL')) {
        baseCost *= 1.0;
      }
    }

    // Add length-based cost (LKR per meter)
    return Math.round((baseCost + length * 100) * 100) / 100;
  }

  /**
   * Check if a cable route crosses this road
   */
  private hasCableCrossing(road: any, cableData?: any): boolean {
    if (!cableData || !cableData.segments) return false;
    if (!road.coordinates || road.coordinates.length < 2) return false;

    const roadBB = this.getBoundingBox(road.coordinates);

    for (const segment of cableData.segments) {
      if (!segment.coordinates || segment.coordinates.length < 2) continue;
      const cableBB = this.getBoundingBox(segment.coordinates);

      // Check bounding box overlap
      if (
        roadBB.maxLng >= cableBB.minLng &&
        cableBB.maxLng >= roadBB.minLng &&
        roadBB.maxLat >= cableBB.minLat &&
        cableBB.maxLat >= roadBB.minLat
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate a wayleave permit for pole installations
   */
  private generateWayleavePermit(
    poleCount: number,
    poles: any[]
  ): PermitRecord | null {
    if (poleCount === 0) return null;

    // Find center point of poles
    let sumLat = 0,
      sumLng = 0;
    poles.forEach((p) => {
      sumLat += p.latitude || 0;
      sumLng += p.longitude || 0;
    });

    return {
      roadName: 'Wayleave Agreement - Pole Instillations',
      authority: 'Survey Department / Land Owner',
      authorityEntity: 'Multiple Land Owners',
      length: 0,
      permitType: 'Wayleave Agreement',
      permitTypeCode: 'WAYLEAVE',
      status: 'DRAFT',
      startLatitude: sumLat / poleCount,
      startLongitude: sumLng / poleCount,
      endLatitude: sumLat / poleCount,
      endLongitude: sumLng / poleCount,
      cost: poleCount * 5000, // LKR per pole wayleave fee
      metadata: {
        poleCount,
        totalPoles: poleCount,
      },
    };
  }

  /**
   * Get bounding box for coordinates
   */
  private getBoundingBox(coords: [number, number][]): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } {
    let minLat = Infinity,
      maxLat = -Infinity;
    let minLng = Infinity,
      maxLng = -Infinity;

    for (const [lng, lat] of coords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    return { minLat, maxLat, minLng, maxLng };
  }
}

// Singleton instance
export const permitGenerator = new PermitGenerator();
