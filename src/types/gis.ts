// ============================================================================
// GIS IMPORT ENGINE - Type Definitions
// ============================================================================
// Enterprise OSP Telecom GIS Type Definitions for SLTSERP
// ============================================================================

/** Supported GIS file formats */
export type GISFileFormat = 'GEOJSON' | 'QGIS' | 'SHP' | 'KML' | 'KMZ' | 'GEOPACKAGE';

/** GIS Layer names as per Telecom OSP standards - supports all 12 SLT template layers */
export type GISLayerType =
  | 'CABLE'
  | 'POLE'
  | 'FDP'
  | 'FIBER_JOINT'
  | 'ROAD_EOP'
  | 'DUCT'
  | 'HANDHOLE'
  | 'MANHOLE'
  | 'ODF'
  | 'RISER'
  | 'FTC'
  | 'TEST_POINT'
  | 'BUILDING'
  | 'UNKNOWN';

/** Project types detected from GIS data */
export type DetectedProjectType = 'SSD' | 'CLUSTER_DEVELOPMENT' | 'BUILDING_FIBER' | 'UNKNOWN';

/** Asset categories for auto-register */
export type AssetCategory = 'CABLE' | 'POLE' | 'FDP' | 'FIBER_JOINT';

/** Survey task types */
export type SurveyTaskType = 'ROUTE_VERIFICATION' | 'POLE_VERIFICATION' | 'GPS_CAPTURE' | 'PHOTO_COLLECTION';

/** Permit statuses */
export type PermitStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

/** Workflow template names */
export type WorkflowTemplateName = 'SSD_STANDARD' | 'CLUSTER_STANDARD' | 'BUILDING_FIBER_STANDARD';

// ============================================================================
// GeoJSON Feature Interfaces
// ============================================================================

export interface GeoJSONGeometry {
  type: string;
  coordinates: number[] | number[][] | number[][][] | number[][][][];
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties: Record<string, any>;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  crs?: {
    type: string;
    properties: {
      name: string;
    };
  };
}

// ============================================================================
// Parsed Layer Data Interfaces
// ============================================================================

export interface ParsedCableData {
  layerName: string;
  featureCount: number;
  totalLength: number; // meters
  cableType: string;
  fiberCount: number;
  segments: CableSegment[];
}

export interface CableSegment {
  index: number;
  coordinates: [number, number][];
  length: number; // meters
  cableType?: string;
  fiberCount?: number;
  fromPoint?: [number, number];
  toPoint?: [number, number];
  properties?: Record<string, any>;
}

export interface ParsedPoleData {
  layerName: string;
  featureCount: number;
  poles: PoleItem[];
}

export interface PoleItem {
  index: number;
  latitude: number;
  longitude: number;
  elevation?: number;
  poleType?: string;
  height?: number;
  properties: Record<string, any>;
}

export interface ParsedFDPData {
  layerName: string;
  featureCount: number;
  fdps: FDPItem[];
}

export interface FDPItem {
  index: number;
  latitude: number;
  longitude: number;
  fdpCode?: string;
  portCount?: number;
  splitters?: number;
  properties: Record<string, any>;
}

export interface ParsedFiberJointData {
  layerName: string;
  featureCount: number;
  joints: FiberJointItem[];
}

export interface FiberJointItem {
  index: number;
  latitude: number;
  longitude: number;
  jointType?: string;
  capacity?: number;
  properties: Record<string, any>;
}

export interface ParsedRoadData {
  layerName: string;
  featureCount: number;
  totalLength: number; // meters
  roadSegments: RoadSegmentItem[];
}

export interface RoadSegmentItem {
  index: number;
  roadName: string;
  coordinates: [number, number][];
  length: number; // meters
  roadType?: string;
  authority?: string;
  properties: Record<string, any>;
}

/** Generic point asset data (for Duct, Handhole, Manhole, ODF, Riser, FTC, Test Point) */
export interface ParsedPointAssetData {
  layerName: string;
  featureCount: number;
  assetType: GISLayerType;
  assets: PointAssetItem[];
}

export interface PointAssetItem {
  index: number;
  latitude: number;
  longitude: number;
  code?: string;
  type?: string;
  capacity?: number;
  properties: Record<string, any>;
}

// ============================================================================
// GIS Import Result Interfaces
// ============================================================================

export interface GISImportResult {
  importId: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  projectType: DetectedProjectType;
  confidence: number;
  layers: GISLayerResult[];
  analytics: GISAnalytics;
  boq: BOQSummary;
  assetsCreated: number;
  surveyTasksCreated: number;
  permitsCreated: number;
  workflowInstantiated: boolean;
  stagesCreated: number;
  tasksCreated: number;
  audit: GISAuditEntry[];
}

export interface GISLayerResult {
  layerName: string;
  layerType: GISLayerType;
  featureCount: number;
  status: 'PARSED' | 'VALIDATED' | 'FAILED';
  errors: string[];
  warnings: string[];
}

export interface GISAnalytics {
  totalRouteLength: number; // meters
  totalCableLength: number; // meters
  poleCount: number;
  fdpCount: number;
  fiberJointCount: number;
  roadCrossings: number;
  estimatedBOQCost: number;
  coverageStatistics: CoverageStats;
}

export interface CoverageStats {
  region: string;
  district: string;
  areaCovered: number; // sq meters
  populationCoverage?: number;
  buildingCoverage?: number;
}

export interface BOQSummary {
  totalEstimatedCost: number;
  items: BOQItem[];
}

export interface BOQItem {
  category: string;
  description: string;
  unit: string;
  quantity: number;
  unitRate: number;
  amount: number;
  source?: 'NEW' | 'EXISTING'; // NEW = to procure, EXISTING = available in inventory
  itemCode?: string;
  materialId?: string;
}

export interface GISAuditEntry {
  timestamp: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  userId?: string;
}

// ============================================================================
// Project Type Detection
// ============================================================================

export interface ProjectTypeDetectionResult {
  projectType: DetectedProjectType;
  confidence: number;
  reasons: string[];
  detectedFrom: {
    hasFDPs: boolean;
    hasCables: boolean;
    hasPoles: boolean;
    hasRoads: boolean;
    hasJoints: boolean;
    routeLength: number;
    totalAssets: number;
  };
}

// ============================================================================
// Workflow Stage Definitions
// ============================================================================

export interface WorkflowStageDefinition {
  name: string;
  sequence: number;
  tasks: string[];
  reqApproval: boolean;
  reqChecklist: boolean;
  reqPhotos: boolean;
  reqDocuments: boolean;
  reqOTDR: boolean;
  reqGPS: boolean;
}

export interface WorkflowDefinition {
  templateName: string;
  stages: WorkflowStageDefinition[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GISUploadRequest {
  files: Array<{
    fileName: string;
    layerType?: GISLayerType;
    fileData: string; // Base64 or buffer
  }>;
  projectId?: string;
  versionType?: 'PLANNED' | 'FIELD_CHANGE' | 'AS_BUILT';
  notes?: string;
  projectName?: string;
  region?: string;
  district?: string;
  createdById: string;
  poleSpacing?: number;
  /** When false (default), region multiplier is NOT applied (all regions use 1.0x base rates). When true, region-specific rate multipliers are applied. */
  useRegionMultiplier?: boolean;
  /** When true, marks the imported project as completed/historical (status = COMPLETED, GIS route status = APPROVED, versionType = AS_BUILT). */
  isCompletedProject?: boolean;
  /** Local Exchange Area (LEA) identifier */
  lea?: string;
}

export interface GISUploadResponse {
  importId: string;
  status: string;
  layersDetected: GISLayerResult[];
  message: string;
}

export interface GISProcessResponse {
  importId: string;
  result: GISImportResult;
  message: string;
}

// ============================================================================
// Permit Segment
// ============================================================================

export interface PermitSegment {
  roadName: string;
  authority: string;
  length: number;
  startPoint: [number, number];
  endPoint: [number, number];
}

// ============================================================================
// Layer Mapping Configuration
// ============================================================================

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
