// ============================================================================
// AUTO ASSET ENGINE - Automatic Asset Register Generation
// ============================================================================
// Creates asset records from parsed GIS data for the Project Asset Register
// ============================================================================

import {
  ParsedCableData,
  ParsedPoleData,
  ParsedFDPData,
  ParsedFiberJointData,
  GISLayerType,
  AssetCategory,
} from '@/types/gis';

export interface GeneratedAsset {
  assetType: string;
  assetCode: string;
  assetName: string;
  latitude: number;
  longitude: number;
  status: string;
  installationStatus: string;
  sourceType: string;
  metadata: Record<string, any>;
}

export interface AssetGenerationResult {
  assets: GeneratedAsset[];
  count: number;
  categoryCounts: Record<string, number>;
}

/**
 * Auto Asset Engine
 * Creates ProjectAsset records from parsed GIS layer data
 */
export class AssetEngine {
  private assetCounter: Record<string, number> = {};

  /**
   * Generate all assets from parsed GIS layers
   */
  generateAssets(
    layers: Map<GISLayerType, any>,
    projectCode: string,
    createdById: string
  ): AssetGenerationResult {
    const allAssets: GeneratedAsset[] = [];
    this.assetCounter = {};

    const cableData = layers.get('CABLE') as ParsedCableData | undefined;
    const poleData = layers.get('POLE') as ParsedPoleData | undefined;
    const fdpData = layers.get('FDP') as ParsedFDPData | undefined;
    const jointData = layers.get('FIBER_JOINT') as ParsedFiberJointData | undefined;

    // Generate Cable Assets
    if (cableData) {
      const cableAssets = this.generateCableAssets(cableData, projectCode);
      allAssets.push(...cableAssets);
    }

    // Generate Pole Assets
    if (poleData) {
      const poleAssets = this.generatePoleAssets(poleData, projectCode);
      allAssets.push(...poleAssets);
    }

    // Generate FDP Assets
    if (fdpData) {
      const fdpAssets = this.generateFDPAssets(fdpData, projectCode);
      allAssets.push(...fdpAssets);
    }

    // Generate Fiber Joint Assets
    if (jointData) {
      const jointAssets = this.generateJointAssets(jointData, projectCode);
      allAssets.push(...jointAssets);
    }

    // Calculate category counts
    const categoryCounts: Record<string, number> = {};
    allAssets.forEach((a) => {
      categoryCounts[a.assetType] = (categoryCounts[a.assetType] || 0) + 1;
    });

    return {
      assets: allAssets,
      count: allAssets.length,
      categoryCounts,
    };
  }

  /**
   * Generate Cable Segment Assets
   */
  private generateCableAssets(
    data: ParsedCableData,
    projectCode: string
  ): GeneratedAsset[] {
    const assets: GeneratedAsset[] = [];

    data.segments.forEach((segment) => {
      const seq = this.nextSeq('CABLE');
      const assetCode = `${projectCode}-CBL-${String(seq).padStart(4, '0')}`;

      assets.push({
        assetType: 'CABLE',
        assetCode,
        assetName: `Cable Segment ${segment.index} - ${data.cableType || '24F SM'}`,
        latitude: segment.fromPoint?.[1] || 0,
        longitude: segment.fromPoint?.[0] || 0,
        status: 'PLANNED',
        installationStatus: 'NOT_INSTALLED',
        sourceType: 'GIS_ROUTE',
        metadata: {
          segmentIndex: segment.index,
          length: segment.length,
          cableType: segment.cableType || data.cableType,
          fiberCount: segment.fiberCount || data.fiberCount,
          coordinates: segment.coordinates,
          fromPoint: segment.fromPoint,
          toPoint: segment.toPoint,
        },
      });
    });

    // Also generate a route-level asset
    const seq = this.nextSeq('FIBER_ROUTE');
    assets.push({
      assetType: 'FIBER_ROUTE',
      assetCode: `${projectCode}-FR-${String(seq).padStart(4, '0')}`,
      assetName: `Fiber Route - ${data.layerName}`,
      latitude: data.segments[0]?.fromPoint?.[1] || 0,
      longitude: data.segments[0]?.fromPoint?.[0] || 0,
      status: 'PLANNED',
      installationStatus: 'NOT_INSTALLED',
      sourceType: 'GIS_ROUTE',
      metadata: {
        totalLength: data.totalLength,
        cableType: data.cableType,
        fiberCount: data.fiberCount,
        segmentCount: data.segments.length,
      },
    });

    return assets;
  }

  /**
   * Generate Pole Assets
   */
  private generatePoleAssets(
    data: ParsedPoleData,
    projectCode: string
  ): GeneratedAsset[] {
    const assets: GeneratedAsset[] = [];

    data.poles.forEach((pole) => {
      const seq = this.nextSeq('POLE');
      const assetCode = `${projectCode}-POL-${String(seq).padStart(4, '0')}`;

      assets.push({
        assetType: 'POLE',
        assetCode,
        assetName: `Pole ${pole.index}${pole.poleType ? ` (${pole.poleType})` : ''}`,
        latitude: pole.latitude,
        longitude: pole.longitude,
        status: 'PLANNED',
        installationStatus: 'NOT_INSTALLED',
        sourceType: 'GIS_ROUTE',
        metadata: {
          poleIndex: pole.index,
          poleType: pole.poleType || 'CONCRETE',
          height: pole.height || 9,
          elevation: pole.elevation,
          rawProperties: pole.properties,
        },
      });
    });

    return assets;
  }

  /**
   * Generate FDP Assets
   */
  private generateFDPAssets(
    data: ParsedFDPData,
    projectCode: string
  ): GeneratedAsset[] {
    const assets: GeneratedAsset[] = [];

    data.fdps.forEach((fdp) => {
      const seq = this.nextSeq('FDP');
      const assetCode = `${projectCode}-FDP-${String(seq).padStart(4, '0')}`;

      assets.push({
        assetType: 'FDP',
        assetCode,
        assetName: `FDP ${fdp.fdpCode || fdp.index}${fdp.portCount ? ` (${fdp.portCount}P)` : ''}`,
        latitude: fdp.latitude,
        longitude: fdp.longitude,
        status: 'PLANNED',
        installationStatus: 'NOT_INSTALLED',
        sourceType: 'GIS_ROUTE',
        metadata: {
          fdpIndex: fdp.index,
          fdpCode: fdp.fdpCode,
          portCount: fdp.portCount || 8,
          splitters: fdp.splitters || 1,
          rawProperties: fdp.properties,
        },
      });
    });

    return assets;
  }

  /**
   * Generate Fiber Joint Assets
   */
  private generateJointAssets(
    data: ParsedFiberJointData,
    projectCode: string
  ): GeneratedAsset[] {
    const assets: GeneratedAsset[] = [];

    data.joints.forEach((joint) => {
      const seq = this.nextSeq('FIBER_JOINT');
      const assetCode = `${projectCode}-FJ-${String(seq).padStart(4, '0')}`;

      assets.push({
        assetType: 'FIBER_JOINT',
        assetCode,
        assetName: `Fiber Joint Closure ${joint.index}${joint.jointType ? ` (${joint.jointType})` : ''}`,
        latitude: joint.latitude,
        longitude: joint.longitude,
        status: 'PLANNED',
        installationStatus: 'NOT_INSTALLED',
        sourceType: 'GIS_ROUTE',
        metadata: {
          jointIndex: joint.index,
          jointType: joint.jointType || 'DOME',
          capacity: joint.capacity || 48,
          rawProperties: joint.properties,
        },
      });
    });

    return assets;
  }

  /**
   * Get next sequence number for an asset type
   */
  private nextSeq(type: string): number {
    this.assetCounter[type] = (this.assetCounter[type] || 0) + 1;
    return this.assetCounter[type];
  }
}

// Singleton instance
export const assetEngine = new AssetEngine();
