// ============================================================================
// GIS IMPORT ENGINE - Type Definitions
// ============================================================================
// Enterprise OSP Telecom GIS Type Definitions for SLTSERP
// ============================================================================

/** Supported GIS file formats */
export type GISFileFormat = 'GEOJSON' | 'QGIS' | 'SHP' | 'KML' | 'KMZ' | 'GEOPACKAGE';

/** GIS Layer names as per Telecom OSP standards */
export type GISLayerType = 'CABLE' | 'POLE' | 'FDP' | 'FIBER_JOINT' | 'ROAD_EOP' | 'BUILDING' | 'UNKNOWN';

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
  projectName?: string;
  region?: string;
  district?: string;
  createdById: string;
  poleSpacing?: number;
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
  'cables': 'CABLE',
  'Cables': 'CABLE',
  'CABLE': 'CABLE',
  'poles': 'POLE',
  'Poles': 'POLE',
  'POLE': 'POLE',
  'fdp': 'FDP',
  'FDP': 'FDP',
  'FDPs': 'FDP',
  'fdps': 'FDP',
  'fj': 'FIBER_JOINT',
  'FJ': 'FIBER_JOINT',
  'fiber_joint': 'FIBER_JOINT',
  'FiberJoint': 'FIBER_JOINT',
  'fiber_joints': 'FIBER_JOINT',
  'road_eops': 'ROAD_EOP',
  'Road_EOPs': 'ROAD_EOP',
  'ROAD_EOP': 'ROAD_EOP',
  'roads': 'ROAD_EOP',
  'building': 'BUILDING',
  'buildings': 'BUILDING',
};

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
};

// ============================================================================
// GPS Constants
// ============================================================================

export const GPS_CONSTANTS = {
  EARTH_RADIUS_M: 6371000,
  DEG_TO_RAD: Math.PI / 180,
};
