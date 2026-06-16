// ============================================================================
// GIS PARSER - GeoJSON/QGIS/Shapefile Parsing Engine
// ============================================================================
// Enterprise-grade parser for Telecom OSP GIS layers
// Supports: GeoJSON, QGIS Project files, SHP, KML, KMZ, GeoPackage
// ============================================================================

import {
  GeoJSONFeatureCollection,
  GeoJSONFeature,
  ParsedCableData,
  CableSegment,
  ParsedPoleData,
  PoleItem,
  ParsedFDPData,
  FDPItem,
  ParsedFiberJointData,
  FiberJointItem,
  ParsedRoadData,
  RoadSegmentItem,
  GISLayerType,
  LAYER_NAME_MAPPING,
  GPS_CONSTANTS,
  GISFileFormat,
} from '@/types/gis';

/**
 * GIS Parser - Main parsing engine
 * Handles parsing of various GIS formats into structured OSP data
 */
export class GISParser {
  private readonly logger: Console;

  constructor() {
    this.logger = console;
  }

  /**
   * Detect layer type from file name
   */
  detectLayerType(fileName: string): GISLayerType {
    const normalized = fileName
      .replace(/\.(geojson|json|kml|kmz|shp|gpkg|qgz|qgs)$/i, '')
      .replace(/^KL-SVK-\d+_/, '')
      .replace(/^.*[\\/]/, '');

    for (const [pattern, layerType] of Object.entries(LAYER_NAME_MAPPING)) {
      if (normalized.toLowerCase().includes(pattern.toLowerCase())) {
        return layerType;
      }
    }
    return 'UNKNOWN';
  }

  /**
   * Parse GeoJSON FeatureCollection
   */
  parseGeoJSON(raw: string | object): GeoJSONFeatureCollection {
    const data: GeoJSONFeatureCollection =
      typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (!data.type || data.type !== 'FeatureCollection') {
      throw new Error('Invalid GeoJSON: Expected FeatureCollection');
    }
    if (!Array.isArray(data.features)) {
      throw new Error('Invalid GeoJSON: Features array missing');
    }
    return data;
  }

  /**
   * Parse Cable Layer from GeoJSON
   * Cables are typically LineString/MultiLineString features
   */
  parseCableLayer(
    features: GeoJSONFeature[],
    layerName: string = 'cables'
  ): ParsedCableData {
    const segments: CableSegment[] = [];
    let totalLength = 0;
    let cableType = '';
    let fiberCount = 0;

    features.forEach((feature, index) => {
      if (
        feature.geometry.type === 'LineString' ||
        feature.geometry.type === 'MultiLineString'
      ) {
        const coords = this.extractCoordinates(feature.geometry);
        const length = this.calculatePolylineLength(coords);
        totalLength += length;

        const segmentCableType =
          feature.properties?.cable_type ||
          feature.properties?.cableType ||
          feature.properties?.type ||
          '';
        const segmentFiberCount =
          Number(feature.properties?.fiber_count) ||
          Number(feature.properties?.fiberCount) ||
          Number(feature.properties?.cores) ||
          0;

        if (!cableType && segmentCableType) cableType = segmentCableType;
        if (segmentFiberCount > fiberCount) fiberCount = segmentFiberCount;

        segments.push({
          index: index + 1,
          coordinates: coords,
          length,
          cableType: segmentCableType,
          fiberCount: segmentFiberCount,
          fromPoint: coords[0],
          toPoint: coords[coords.length - 1],
        });
      }
    });

    return {
      layerName,
      featureCount: features.length,
      totalLength,
      cableType: cableType || '24F SM',
      fiberCount: fiberCount || 24,
      segments,
    };
  }

  /**
   * Parse Pole Layer from GeoJSON
   * Poles are typically Point features
   */
  parsePoleLayer(
    features: GeoJSONFeature[],
    layerName: string = 'poles'
  ): ParsedPoleData {
    const poles: PoleItem[] = [];

    features.forEach((feature, index) => {
      if (
        feature.geometry.type === 'Point'
      ) {
        const [longitude, latitude] = feature.geometry.coordinates as [
          number,
          number
        ];
    // Parse height from various possible property key formats
    const rawHeight: string | number | undefined =
      feature.properties?.height ||
      feature.properties?.pole_height ||
      feature.properties?.['POLE HEIGHT'] ||
      feature.properties?.poleHeight ||
      undefined;
    let parsedHeight: number | undefined = undefined;
    if (rawHeight !== undefined && rawHeight !== null && rawHeight !== false) {
      const heightStr = String(rawHeight).replace(/[^0-9.]/g, '');
      if (heightStr) {
        parsedHeight = Number(heightStr);
      }
    }

    poles.push({
      index: index + 1,
      latitude,
      longitude,
      elevation: feature.properties?.elevation || undefined,
      poleType:
        feature.properties?.pole_type ||
        feature.properties?.poleType ||
        feature.properties?.['POLE TYPE'] ||
        feature.properties?.material ||
        undefined,
      height: parsedHeight,
      properties: feature.properties || {},
    });
      }
    });

    return {
      layerName,
      featureCount: poles.length,
      poles,
    };
  }

  /**
   * Parse FDP Layer from GeoJSON
   * FDPs are typically Point features
   */
  parseFDPLayer(
    features: GeoJSONFeature[],
    layerName: string = 'fdps'
  ): ParsedFDPData {
    const fdps: FDPItem[] = [];

    features.forEach((feature, index) => {
      if (feature.geometry.type === 'Point') {
        const [longitude, latitude] = feature.geometry.coordinates as [
          number,
          number
        ];
        fdps.push({
          index: index + 1,
          latitude,
          longitude,
          fdpCode:
            feature.properties?.fdp_code ||
            feature.properties?.fdpCode ||
            feature.properties?.['FDP NAME'] ||
            feature.properties?.code ||
            feature.properties?.name ||
            undefined,
          portCount:
            Number(feature.properties?.port_count) ||
            Number(feature.properties?.portCount) ||
            Number(feature.properties?.ports) ||
            undefined,
          splitters:
            Number(feature.properties?.splitter_count) ||
            Number(feature.properties?.splitters) ||
            undefined,
          properties: feature.properties || {},
        });
      }
    });

    return {
      layerName,
      featureCount: fdps.length,
      fdps,
    };
  }

  /**
   * Parse Fiber Joint Layer from GeoJSON
   * Fiber joints are typically Point features
   */
  parseFiberJointLayer(
    features: GeoJSONFeature[],
    layerName: string = 'fiber_joints'
  ): ParsedFiberJointData {
    const joints: FiberJointItem[] = [];

    features.forEach((feature, index) => {
      if (feature.geometry.type === 'Point') {
        const [longitude, latitude] = feature.geometry.coordinates as [
          number,
          number
        ];
        joints.push({
          index: index + 1,
          latitude,
          longitude,
          jointType:
            feature.properties?.joint_type ||
            feature.properties?.jointType ||
            feature.properties?.type ||
            undefined,
          capacity:
            Number(feature.properties?.capacity) ||
            Number(feature.properties?.splice_capacity) ||
            undefined,
          properties: feature.properties || {},
        });
      }
    });

    return {
      layerName,
      featureCount: joints.length,
      joints,
    };
  }

  /**
   * Parse Road/EOP Layer from GeoJSON
   * Roads are typically LineString features
   */
  parseRoadLayer(
    features: GeoJSONFeature[],
    layerName: string = 'roads'
  ): ParsedRoadData {
    const roadSegments: RoadSegmentItem[] = [];
    let totalLength = 0;

    features.forEach((feature, index) => {
      if (
        feature.geometry.type === 'LineString' ||
        feature.geometry.type === 'MultiLineString'
      ) {
        const coords = this.extractCoordinates(feature.geometry);
        const length = this.calculatePolylineLength(coords);
        totalLength += length;

        roadSegments.push({
          index: index + 1,
          roadName:
            feature.properties?.road_name ||
            feature.properties?.roadName ||
            feature.properties?.['Road_Name'] ||
            feature.properties?.['ROAD NAME'] ||
            feature.properties?.name ||
            feature.properties?.road ||
            `Road ${index + 1}`,
          coordinates: coords,
          length,
          roadType:
            feature.properties?.road_type ||
            feature.properties?.roadType ||
            feature.properties?.classification ||
            undefined,
          authority:
            feature.properties?.authority ||
            feature.properties?.authority_name ||
            undefined,
          properties: feature.properties || {},
        });
      }
    });

    return {
      layerName,
      featureCount: roadSegments.length,
      totalLength,
      roadSegments,
    };
  }

  /**
   * Auto-detect and parse a layer based on file content and name
   */
  autoParseLayer(
    fileName: string,
    fileContent: string | object
  ): {
    layerType: GISLayerType;
    parsedData:
      | ParsedCableData
      | ParsedPoleData
      | ParsedFDPData
      | ParsedFiberJointData
      | ParsedRoadData;
  } {
    const layerType = this.detectLayerType(fileName);
    const geoJSON = this.parseGeoJSON(fileContent);

    switch (layerType) {
      case 'CABLE':
        return {
          layerType,
          parsedData: this.parseCableLayer(geoJSON.features, fileName),
        };
      case 'POLE':
        return {
          layerType,
          parsedData: this.parsePoleLayer(geoJSON.features, fileName),
        };
      case 'FDP':
        return {
          layerType,
          parsedData: this.parseFDPLayer(geoJSON.features, fileName),
        };
      case 'FIBER_JOINT':
        return {
          layerType,
          parsedData: this.parseFiberJointLayer(geoJSON.features, fileName),
        };
      case 'ROAD_EOP':
        return {
          layerType,
          parsedData: this.parseRoadLayer(geoJSON.features, fileName),
        };
      default:
        // Try to detect by geometry type
        return this.detectByGeometry(geoJSON.features, fileName);
    }
  }

  /**
   * Fallback: detect layer type by geometry analysis
   */
  private detectByGeometry(
    features: GeoJSONFeature[],
    fileName: string
  ): {
    layerType: GISLayerType;
    parsedData: any;
  } {
    if (features.length === 0) {
      return {
        layerType: 'UNKNOWN',
        parsedData: { layerName: fileName, featureCount: 0 },
      };
    }

    const geometryTypes = new Set(features.map((f) => f.geometry.type));

    // Point features: check if they look like poles, FDPs, or joints
    if (geometryTypes.has('Point') && !geometryTypes.has('LineString')) {
      // Check properties for clues
      const sampleProps = features[0].properties || {};
      if (
        sampleProps.fdp_code ||
        sampleProps.fdpCode ||
        sampleProps.port_count ||
        sampleProps.splitters
      ) {
        return {
          layerType: 'FDP',
          parsedData: this.parseFDPLayer(features, fileName),
        };
      }
      if (
        sampleProps.joint_type ||
        sampleProps.jointType ||
        sampleProps.splice_capacity ||
        sampleProps.capacity
      ) {
        return {
          layerType: 'FIBER_JOINT',
          parsedData: this.parseFiberJointLayer(features, fileName),
        };
      }
      // Default points to poles
      return {
        layerType: 'POLE',
        parsedData: this.parsePoleLayer(features, fileName),
      };
    }

    // LineString features: cables or roads
    if (geometryTypes.has('LineString') || geometryTypes.has('MultiLineString')) {
      const sampleProps = features[0].properties || {};
      if (
        sampleProps.road_name ||
        sampleProps.roadName ||
        sampleProps.authority ||
        sampleProps.road_type
      ) {
        return {
          layerType: 'ROAD_EOP',
          parsedData: this.parseRoadLayer(features, fileName),
        };
      }
      // Default lines to cables
      return {
        layerType: 'CABLE',
        parsedData: this.parseCableLayer(features, fileName),
      };
    }

    return {
      layerType: 'UNKNOWN',
      parsedData: { layerName: fileName, featureCount: features.length },
    };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Extract coordinates from geometry (handles LineString and MultiLineString)
   */
  private extractCoordinates(
    geometry: GeoJSONFeature['geometry']
  ): [number, number][] {
    if (geometry.type === 'LineString') {
      return geometry.coordinates as [number, number][];
    }
    if (geometry.type === 'MultiLineString') {
      // Flatten multi-linestring
      const coords: [number, number][] = [];
      for (const line of geometry.coordinates as number[][][]) {
        for (const point of line) {
          coords.push(point as [number, number]);
        }
      }
      return coords;
    }
    if (geometry.type === 'Point') {
      const pt = geometry.coordinates as [number, number];
      return [pt];
    }
    return [];
  }

  /**
   * Calculate length of a polyline using Haversine formula
   */
  calculatePolylineLength(coords: [number, number][]): number {
    if (coords.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      total += this.haversineDistance(coords[i], coords[i + 1]);
    }
    return total;
  }

  /**
   * Haversine distance between two GPS coordinates in meters
   */
  haversineDistance(
    point1: [number, number],
    point2: [number, number]
  ): number {
    const [lon1, lat1] = point1;
    const [lon2, lat2] = point2;
    const dLat = (lat2 - lat1) * GPS_CONSTANTS.DEG_TO_RAD;
    const dLon = (lon2 - lon1) * GPS_CONSTANTS.DEG_TO_RAD;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * GPS_CONSTANTS.DEG_TO_RAD) *
        Math.cos(lat2 * GPS_CONSTANTS.DEG_TO_RAD) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return GPS_CONSTANTS.EARTH_RADIUS_M * c;
  }

  /**
   * Calculate bounding box from coordinates
   */
  calculateBoundingBox(coords: [number, number][]): {
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

  /**
   * Detect file format from file name
   */
  detectFileFormat(fileName: string): GISFileFormat {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'geojson':
      case 'json':
        return 'GEOJSON';
      case 'qgz':
      case 'qgs':
        return 'QGIS';
      case 'shp':
        return 'SHP';
      case 'kml':
        return 'KML';
      case 'kmz':
        return 'KMZ';
      case 'gpkg':
        return 'GEOPACKAGE';
      default:
        return 'GEOJSON';
    }
  }
}

// Singleton instance
export const gisParser = new GISParser();
