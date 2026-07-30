import { GISLayerType } from './core.types';

export const LAYER_NAME_MAPPING: Record<string, GISLayerType> = {
  // Cable layer
  'cables': 'CABLE',
  'Cables': 'CABLE',
  'CABLE': 'CABLE',
  'slt_cables': 'CABLE',
  'cbl': 'CABLE',
  'CBL': 'CABLE',
  // Pole layer
  'poles': 'POLE',
  'Poles': 'POLE',
  'POLE': 'POLE',
  'slt_poles': 'POLE',
  'pole': 'POLE',
  'pl': 'POLE',
  'PL': 'POLE',
  // FDP layer
  'fdp': 'FDP',
  'FDP': 'FDP',
  'FDPs': 'FDP',
  'fdps': 'FDP',
  'slt_fdp': 'FDP',
  // Fiber Joint layer
  'fj': 'FIBER_JOINT',
  'FJ': 'FIBER_JOINT',
  'fiber_joint': 'FIBER_JOINT',
  'FiberJoint': 'FIBER_JOINT',
  'fiber_joints': 'FIBER_JOINT',
  'slt_fj': 'FIBER_JOINT',
  'jt': 'FIBER_JOINT',
  'JT': 'FIBER_JOINT',
  'joint': 'FIBER_JOINT',
  'JOINT': 'FIBER_JOINT',
  // Road / EOP layer
  'road_eops': 'ROAD_EOP',
  'Road_EOPs': 'ROAD_EOP',
  'ROAD_EOP': 'ROAD_EOP',
  'roads': 'ROAD_EOP',
  'slt_road_eops': 'ROAD_EOP',
  'road': 'ROAD_EOP',
  'eop': 'ROAD_EOP',
  'EOP': 'ROAD_EOP',
  // Duct layer
  'duct': 'DUCT',
  'ducts': 'DUCT',
  'DUCT': 'DUCT',
  'slt_ducts': 'DUCT',
  // Handhole layer
  'handhole': 'HANDHOLE',
  'handholes': 'HANDHOLE',
  'hh': 'HANDHOLE',
  'HH': 'HANDHOLE',
  'slt_hh': 'HANDHOLE',
  // Manhole layer
  'manhole': 'MANHOLE',
  'manholes': 'MANHOLE',
  'mh': 'MANHOLE',
  'MH': 'MANHOLE',
  'slt_mh': 'MANHOLE',
  'chamber': 'MANHOLE',
  'Chamber': 'MANHOLE',
  // ODF layer
  'odf': 'ODF',
  'ODF': 'ODF',
  'slt_odf': 'ODF',
  // Riser layer
  'riser': 'RISER',
  'risers': 'RISER',
  'RISER': 'RISER',
  'slt_risers': 'RISER',
  // FTC layer
  'ftc': 'FTC',
  'FTC': 'FTC',
  'slt_ftc': 'FTC',
  // Test Point layer
  'test_point': 'TEST_POINT',
  'testpoint': 'TEST_POINT',
  'tp': 'TEST_POINT',
  'TP': 'TEST_POINT',
  'slt_tp': 'TEST_POINT',
  // Building layer
  'building': 'BUILDING',
  'buildings': 'BUILDING',
};

/** Human-readable labels for each GIS layer type (for UI dropdowns) */
export const LAYER_TYPE_LABELS: Record<GISLayerType, string> = {
  'CABLE': 'Fiber Cable',
  'POLE': 'Pole',
  'FDP': 'Fiber Distribution Point (FDP)',
  'FIBER_JOINT': 'Fiber Joint (Closure)',
  'ROAD_EOP': 'Road / EOP',
  'DUCT': 'Duct',
  'HANDHOLE': 'Handhole',
  'MANHOLE': 'Manhole',
  'ODF': 'Optical Distribution Frame (ODF)',
  'RISER': 'Riser',
  'FTC': 'Fiber Termination Cabinet (FTC)',
  'TEST_POINT': 'Test Point',
  'BUILDING': 'Building',
  'UNKNOWN': 'Unknown / Other',
};

/** All supported layer types for UI dropdowns (excluding UNKNOWN) */
export const SELECTABLE_LAYER_TYPES: GISLayerType[] = [
  'CABLE', 'POLE', 'FDP', 'FIBER_JOINT', 'ROAD_EOP',
  'DUCT', 'HANDHOLE', 'MANHOLE', 'ODF', 'RISER', 'FTC', 'TEST_POINT',
  'BUILDING',
];

// ============================================================================
// Unit Rates for BOQ Calculation
// ============================================================================

export const BOQ_UNIT_RATES: Record<string, number> = {
  'FIBER_CABLE_PER_METER': 850,    // LKR per meter (installed)
  'POLE': 45000,                    // LKR per pole (installed)
  'FDP': 35000,                     // LKR per FDP (installed)
  'FIBER_JOINT': 25000,             // LKR per joint closure
  'WARNING_TAPE_PER_METER': 150,    // LKR per meter
  'ACCESSORIES_PERCENTAGE': 0.08,   // 8% of total material cost
  'ROAD_CROSSING': 85000,           // LKR per road crossing
  // Additional layer unit rates
  'DUCT_PER_METER': 1200,           // LKR per meter
  'HANDHOLE': 18000,                // LKR per handhole
  'MANHOLE': 85000,                 // LKR per manhole
  'ODF': 120000,                    // LKR per ODF
  'RISER': 8500,                    // LKR per riser
  'FTC': 95000,                     // LKR per FTC
  'TEST_POINT': 5000,               // LKR per test point
};

// ============================================================================
// Region Multipliers for BOQ Rate Adjustments
// ============================================================================

/** Multiplier applied to base unit rates based on deployment region */
export const REGION_MULTIPLIERS: Record<string, number> = {
  'Western': 1.0,
  'Southern': 1.05,
  'Central': 1.1,
  'Sabaragamuwa': 1.1,
  'Eastern': 1.15,
  'North Western': 1.1,
  'North Central': 1.12,
  'Northern': 1.2,
  'Uva': 1.12,
};

/**
 * Resolve the region multiplier from a region name string.
 * Matches case-insensitively against known regions; falls back to 1.0.
 */
export function resolveRegionMultiplier(region?: string): number {
  if (!region) return 1.0;
  const key = Object.keys(REGION_MULTIPLIERS).find(
    (k) => k.toLowerCase() === region.toLowerCase()
  );
  return key ? REGION_MULTIPLIERS[key] : 1.0;
}

// ============================================================================
// GPS Constants
// ============================================================================

export const GPS_CONSTANTS = {
  EARTH_RADIUS_M: 6371000,
  DEG_TO_RAD: Math.PI / 180,
};
