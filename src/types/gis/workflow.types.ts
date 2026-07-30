
import { DetectedProjectType } from './core.types';
export type PermitStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type WorkflowTemplateName = 'SSD_STANDARD' | 'CLUSTER_STANDARD' | 'BUILDING_FIBER_STANDARD';

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

export interface PermitSegment {
  roadName: string;
  authority: string;
  length: number;
  startPoint: [number, number];
  endPoint: [number, number];
}