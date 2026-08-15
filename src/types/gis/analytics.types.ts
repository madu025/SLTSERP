import { GISLayerType, DetectedProjectType } from './core.types';
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