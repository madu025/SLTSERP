import { GISLayerType } from './core.types';
import { GISLayerResult, GISImportResult } from './analytics.types';
export interface GISUploadRequest {
  files: Array<{
    fileName: string;
    layerType?: GISLayerType;
    fileData: string; // Base64 or buffer
  }>;
  projectId?: string;
  versionType?: 'PLANNED' | 'FIELD_CHANGE' | 'BEFORE_PAT' | 'AS_BUILT';
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
