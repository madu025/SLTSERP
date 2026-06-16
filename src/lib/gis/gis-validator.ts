// ============================================================================
// GIS VALIDATOR - GIS Data Validation Engine
// ============================================================================
// Validates parsed GIS data for completeness, correctness, and business rules
// ============================================================================

import {
  ParsedCableData,
  ParsedPoleData,
  ParsedFDPData,
  ParsedFiberJointData,
  ParsedRoadData,
  GISLayerResult,
  GISLayerType,
} from '@/types/gis';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  layerResults: GISLayerResult[];
}

export interface LayerValidation {
  status: 'PARSED' | 'VALIDATED' | 'FAILED';
  errors: string[];
  warnings: string[];
}

/**
 * GIS Validator - validates all parsed layers
 */
export class GISValidator {
  /**
   * Validate all parsed layers and return aggregated results
   */
  validateAll(
    layers: Map<GISLayerType, any>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const layerResults: GISLayerResult[] = [];

    // Validate each layer type if present
    if (layers.has('CABLE')) {
      const result = this.validateCableLayer(layers.get('CABLE'));
      layerResults.push({
        layerName: layers.get('CABLE').layerName || 'cables',
        layerType: 'CABLE',
        featureCount: layers.get('CABLE').featureCount || 0,
        ...result,
      });
      errors.push(...result.errors.map(e => `Cable: ${e}`));
      warnings.push(...result.warnings.map(w => `Cable: ${w}`));
    }

    if (layers.has('POLE')) {
      const result = this.validatePoleLayer(layers.get('POLE'));
      layerResults.push({
        layerName: layers.get('POLE').layerName || 'poles',
        layerType: 'POLE',
        featureCount: layers.get('POLE').featureCount || 0,
        ...result,
      });
      errors.push(...result.errors.map(e => `Pole: ${e}`));
      warnings.push(...result.warnings.map(w => `Pole: ${w}`));
    }

    if (layers.has('FDP')) {
      const result = this.validateFDPLayer(layers.get('FDP'));
      layerResults.push({
        layerName: layers.get('FDP').layerName || 'fdps',
        layerType: 'FDP',
        featureCount: layers.get('FDP').featureCount || 0,
        ...result,
      });
      errors.push(...result.errors.map(e => `FDP: ${e}`));
      warnings.push(...result.warnings.map(w => `FDP: ${w}`));
    }

    if (layers.has('FIBER_JOINT')) {
      const result = this.validateFiberJointLayer(layers.get('FIBER_JOINT'));
      layerResults.push({
        layerName: layers.get('FIBER_JOINT').layerName || 'fiber_joints',
        layerType: 'FIBER_JOINT',
        featureCount: layers.get('FIBER_JOINT').featureCount || 0,
        ...result,
      });
      errors.push(...result.errors.map(e => `FiberJoint: ${e}`));
      warnings.push(...result.warnings.map(w => `FiberJoint: ${w}`));
    }

    if (layers.has('ROAD_EOP')) {
      const result = this.validateRoadLayer(layers.get('ROAD_EOP'));
      layerResults.push({
        layerName: layers.get('ROAD_EOP').layerName || 'roads',
        layerType: 'ROAD_EOP',
        featureCount: layers.get('ROAD_EOP').featureCount || 0,
        ...result,
      });
      errors.push(...result.errors.map(e => `Road: ${e}`));
      warnings.push(...result.warnings.map(w => `Road: ${w}`));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      layerResults,
    };
  }

  /**
   * Validate Cable Layer
   */
  validateCableLayer(data: ParsedCableData): LayerValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (data.featureCount === 0) {
      warnings.push('No cable features found in layer');
    }

    if (data.totalLength <= 0) {
      errors.push('Total cable length must be greater than 0');
    }

    if (data.totalLength > 1000000) {
      warnings.push(`Unusually long cable route: ${(data.totalLength / 1000).toFixed(2)} km`);
    }

    if (data.totalLength < 10) {
      warnings.push(`Unusually short cable route: ${data.totalLength.toFixed(2)} m`);
    }

    if (!data.cableType) {
      warnings.push('No cable type specified, defaulting to 24F SM');
    }

    // Validate individual segments
    data.segments.forEach((seg, i) => {
      if (seg.coordinates.length < 2) {
        warnings.push(`Segment ${seg.index}: Less than 2 coordinates (length: ${seg.length}m)`);
      }
      if (seg.length <= 0) {
        warnings.push(`Segment ${seg.index}: Zero length segment`);
      }
    });

    return {
      status: errors.length > 0 ? 'FAILED' : 'VALIDATED',
      errors,
      warnings,
    };
  }

  /**
   * Validate Pole Layer
   */
  validatePoleLayer(data: ParsedPoleData): LayerValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (data.featureCount === 0) {
      warnings.push('No poles found in layer');
    }

    if (data.featureCount > 1000) {
      warnings.push(`Large number of poles (${data.featureCount}). Verify data accuracy.`);
    }

    // Validate individual poles
    data.poles.forEach((pole, i) => {
      if (!pole.latitude || !pole.longitude) {
        errors.push(`Pole ${pole.index}: Missing GPS coordinates`);
      }
      if (
        pole.latitude < -90 ||
        pole.latitude > 90 ||
        pole.longitude < -180 ||
        pole.longitude > 180
      ) {
        errors.push(
          `Pole ${pole.index}: Invalid GPS coordinates (${pole.latitude}, ${pole.longitude})`
        );
      }
    });

    // Check for duplicate coordinates
    const coordSet = new Set<string>();
    data.poles.forEach((pole) => {
      const key = `${pole.latitude.toFixed(6)},${pole.longitude.toFixed(6)}`;
      if (coordSet.has(key)) {
        warnings.push(
          `Pole at (${pole.latitude}, ${pole.longitude}) has duplicate coordinates`
        );
      }
      coordSet.add(key);
    });

    return {
      status: errors.length > 0 ? 'FAILED' : 'VALIDATED',
      errors,
      warnings,
    };
  }

  /**
   * Validate FDP Layer
   */
  validateFDPLayer(data: ParsedFDPData): LayerValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (data.featureCount === 0) {
      warnings.push('No FDPs found in layer');
    }

    data.fdps.forEach((fdp) => {
      if (!fdp.latitude || !fdp.longitude) {
        errors.push(`FDP ${fdp.index}: Missing GPS coordinates`);
      }
      if (fdp.portCount && (fdp.portCount <= 0 || fdp.portCount > 64)) {
        warnings.push(`FDP ${fdp.index}: Unusual port count (${fdp.portCount})`);
      }
    });

    return {
      status: errors.length > 0 ? 'FAILED' : 'VALIDATED',
      errors,
      warnings,
    };
  }

  /**
   * Validate Fiber Joint Layer
   */
  validateFiberJointLayer(data: ParsedFiberJointData): LayerValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (data.featureCount === 0) {
      warnings.push('No fiber joints found in layer');
    }

    data.joints.forEach((joint) => {
      if (!joint.latitude || !joint.longitude) {
        errors.push(`Joint ${joint.index}: Missing GPS coordinates`);
      }
    });

    return {
      status: errors.length > 0 ? 'FAILED' : 'VALIDATED',
      errors,
      warnings,
    };
  }

  /**
   * Validate Road Layer
   */
  validateRoadLayer(data: ParsedRoadData): LayerValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (data.featureCount === 0) {
      warnings.push('No road segments found in layer');
    }

    data.roadSegments.forEach((road) => {
      if (!road.roadName) {
        warnings.push(`Road segment ${road.index}: Missing road name`);
      }
      if (road.length <= 0) {
        warnings.push(`Road segment ${road.index}: Zero length`);
      }
    });

    return {
      status: errors.length > 0 ? 'FAILED' : 'VALIDATED',
      errors,
      warnings,
    };
  }
}

// Singleton instance
export const gisValidator = new GISValidator();
