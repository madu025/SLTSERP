// ============================================================================
// GIS IMPORT SERVICE - Orchestration Engine for GIS Ingestion Pipeline
// ============================================================================
// Enterprise service that orchestrates the full GIS-to-ERP pipeline:
// Parse -> Validate -> Detect Type -> BOQ -> Assets -> Survey -> Permits -> Workflow
// ============================================================================

import { prisma } from '@/lib/prisma';
import { WorkflowEngine } from '../WorkflowEngine';
import { gisParser } from '@/lib/gis/gis-parser';
import { gisValidator } from '@/lib/gis/gis-validator';
import { projectTypeDetector } from '@/lib/gis/project-type-detector';
import { boqEngine } from '@/lib/gis/boq-engine';
import { assetEngine } from '@/lib/gis/asset-engine';
import { surveyGenerator } from '@/lib/gis/survey-generator';
import { permitGenerator } from '@/lib/gis/permit-generator';
import { gisAnalyticsEngine } from '@/lib/gis/gis-analytics-engine';
import { getWorkflowForProjectType } from '@/lib/gis/workflow-definitions';
import { logger } from '@/lib/logger';

import type {
  GISUploadRequest,
  GISUploadResponse,
  GISProcessResponse,
  GISImportResult,
  GISLayerResult,
  GISAnalytics,
  GISLayerType,
  DetectedProjectType,
  BOQSummary,
  GISAuditEntry,
  ParsedCableData,
  ParsedPoleData,
  ParsedFDPData,
  ParsedFiberJointData,
  ParsedRoadData,
  ParsedPointAssetData,
  PoleItem,
  FDPItem,
  FiberJointItem,
  CableSegment,
} from '@/types/gis';
import { resolveRegionMultiplier } from '@/types/gis';
import type { InventoryStockEntry } from '@/lib/gis/boq-engine';

// ============================================================================
// Types
// ============================================================================

export interface GISUploadSession {
  id: string;
  projectId?: string;
  versionType?: 'PLANNED' | 'FIELD_CHANGE' | 'BEFORE_PAT' | 'AS_BUILT';
  notes?: string;
  projectName?: string;
  region?: string;
  district?: string;
  createdById: string;
  files: UploadFileEntry[];
  status: 'UPLOADED' | 'PARSING' | 'PARSED' | 'VALIDATING' | 'VALIDATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  useRegionMultiplier?: boolean;
  isCompletedProject?: boolean;
  lea?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadFileEntry {
  fileName: string;
  layerType: GISLayerType;
  content: string; // Base64 encoded file content
  size: number;
  detectedFormat: string;
}

interface ParsedLayerMap {
  cable?: ParsedCableData;
  pole?: ParsedPoleData;
  fdp?: ParsedFDPData;
  fiberJoint?: ParsedFiberJointData;
  road?: ParsedRoadData;
  // New layer types - all stored as generic point assets
  duct?: ParsedPointAssetData;
  handhole?: ParsedPointAssetData;
  manhole?: ParsedPointAssetData;
  odf?: ParsedPointAssetData;
  riser?: ParsedPointAssetData;
  ftc?: ParsedPointAssetData;
  testPoint?: ParsedPointAssetData;
  building?: ParsedPointAssetData;
}

// ============================================================================
// Helper Functions — Default Checklist & Approval Templates
// ============================================================================

interface DefaultChecklistItem {
  label: string;
  isMandatory: boolean;
}

interface DefaultApprovalLevel {
  level: number;
  role: string;
}

function getDefaultChecklist(stageName: string, reqPhotos: boolean): DefaultChecklistItem[] {
  const items: DefaultChecklistItem[] = [
    { label: `${stageName} completed as per specification`, isMandatory: true },
    { label: `${stageName} documentation completed`, isMandatory: true },
    { label: `Safety compliance verified`, isMandatory: true },
    { label: `Quality standards met`, isMandatory: true },
    { label: `All measurements within tolerance`, isMandatory: false },
  ];
  if (reqPhotos) {
    items.push({ label: `Photos uploaded and verified`, isMandatory: true });
  }
  return items;
}

function getDefaultApprovals(): DefaultApprovalLevel[] {
  // Standard 2-level approval flow
  return [
    { level: 1, role: 'SUPERVISOR' },
    { level: 2, role: 'MANAGER' },
  ];
}

// ============================================================================
// GIS Import Service
// ============================================================================

// Global session store using globalThis to survive Turbopack HMR
const _global = globalThis as typeof globalThis & { __gisSessions?: Map<string, import('./GISImportService').GISUploadSession> };
if (!_global.__gisSessions) _global.__gisSessions = new Map();

export class GISImportService {
  private static get sessions() { return _global.__gisSessions!; }

  /**
   * Helper to detect if a file or feature properties represent an existing/installed asset
   */
  private static checkIsExisting(fileName: string, properties: Record<string, unknown> | null | undefined): boolean {
    const fileLower = fileName.toLowerCase();
    const isExistingFile =
      fileLower.includes('ex-') ||
      fileLower.includes('existing') ||
      fileLower.includes('exist') ||
      fileLower.includes('verified') ||
      fileLower.includes('old') ||
      fileLower.includes('as-built') ||
      fileLower.includes('asbuilt') ||
      fileLower.includes('historical');

    if (isExistingFile) return true;

    if (properties) {
      for (const key of Object.keys(properties)) {
        const val = String(properties[key]).toLowerCase();
        if (
          key.toLowerCase().includes('exist') ||
          key.toLowerCase().includes('status') ||
          key.toLowerCase().includes('state')
        ) {
          if (
            val.includes('exist') ||
            val.includes('verif') ||
            val.includes('inst') ||
            val.includes('old')
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Generate a unique project code
   * Format: {TYPE}_SLTS_{YEAR}_{SEQUENCE}
   */
  private static async generateProjectCode(
    projectType: DetectedProjectType
  ): Promise<string> {
    const year = new Date().getFullYear();
    const typePrefix =
      projectType === 'SSD'
        ? 'FSSD'
        : projectType === 'CLUSTER_DEVELOPMENT'
        ? 'FCLU'
        : projectType === 'BUILDING_FIBER'
        ? 'FBLD'
        : 'FOSP';

    // Get count of projects this year to determine sequence
    const count = await prisma.project.count({
      where: {
        projectCode: {
          startsWith: `${typePrefix}_SLTS_${year}`,
        },
      },
    });

    const sequence = String(count + 1).padStart(3, '0');
    return `${typePrefix}_SLTS_${year}_${sequence}`;
  }

  /**
   * STEP 1: Upload files and create an import session
   */
  static async uploadFiles(
    request: GISUploadRequest
  ): Promise<GISUploadResponse> {
    const importId = `GIS-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const files: UploadFileEntry[] = request.files.map((f) => {
      const format = gisParser.detectFileFormat(f.fileName);
      const layerType =
        f.layerType || gisParser.detectLayerType(f.fileName);

      return {
        fileName: f.fileName,
        layerType,
        content: f.fileData,
        size: f.fileData.length,
        detectedFormat: format,
      };
    });

    // Detect layer types for each file
    const layersDetected: GISLayerResult[] = files.map((f) => ({
      layerName: f.fileName,
      layerType: f.layerType,
      featureCount: 0,
      status: 'PARSED' as const,
      errors: [],
      warnings: [],
    }));

    // Create session
    const session: GISUploadSession = {
      id: importId,
      projectId: request.projectId,
      versionType: request.versionType,
      notes: request.notes,
      projectName: request.projectName,
      region: request.region,
      district: request.district,
      createdById: request.createdById,
      files,
      status: 'UPLOADED',
      useRegionMultiplier: request.useRegionMultiplier ?? false,
      isCompletedProject: request.isCompletedProject ?? false,
      lea: request.lea,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(importId, session);

    return {
      importId,
      status: 'UPLOADED',
      layersDetected,
      message: `${files.length} file(s) uploaded successfully. Ready for processing.`,
    };
  }

  /**
   * STEP 2: Process all uploaded files through the full pipeline
   */
  static async processImport(
    importId: string
  ): Promise<GISProcessResponse> {
    const session = this.sessions.get(importId);
    if (!session) {
      throw new Error(`Import session ${importId} not found`);
    }

    const auditLog: GISAuditEntry[] = [];
    const startTime = Date.now();

    try {
      session.status = 'PARSING';
      session.updatedAt = new Date();

      // ====================================================================
      // PHASE 1: Parse all files
      // ====================================================================
      const parsedLayers: ParsedLayerMap = {};
      const layerResults: GISLayerResult[] = [];

      for (const file of session.files) {
        try {
          // Decode base64 content to raw GeoJSON string before parsing
          const rawContent = Buffer.from(file.content, 'base64').toString('utf-8');
          // Pass the client-selected layer type override (stored in the session entry)
          const parsed = gisParser.autoParseLayer(
            file.fileName,
            rawContent,
            file.layerType
          );
          const layerType = parsed.layerType;

          // Store parsed data by type (and merge if multiple files of the same type exist)
          switch (layerType) {
            case 'CABLE':
              if (parsedLayers.cable) {
                const existing = parsedLayers.cable;
                const incoming = parsed.parsedData as ParsedCableData;
                existing.featureCount += incoming.featureCount;
                existing.totalLength += incoming.totalLength;
                const startIdx = existing.segments.length;
                existing.segments.push(
                  ...incoming.segments.map((s, idx) => ({ ...s, index: startIdx + idx + 1 }))
                );
              } else {
                parsedLayers.cable = parsed.parsedData as ParsedCableData;
              }
              break;
            case 'POLE':
              if (parsedLayers.pole) {
                const existing = parsedLayers.pole;
                const incoming = parsed.parsedData as ParsedPoleData;
                existing.featureCount += incoming.featureCount;
                const startIdx = existing.poles.length;
                existing.poles.push(
                  ...incoming.poles.map((p, idx) => ({ ...p, index: startIdx + idx + 1 }))
                );
              } else {
                parsedLayers.pole = parsed.parsedData as ParsedPoleData;
              }
              break;
            case 'FDP':
              if (parsedLayers.fdp) {
                const existing = parsedLayers.fdp;
                const incoming = parsed.parsedData as ParsedFDPData;
                existing.featureCount += incoming.featureCount;
                const startIdx = existing.fdps.length;
                existing.fdps.push(
                  ...incoming.fdps.map((f, idx) => ({ ...f, index: startIdx + idx + 1 }))
                );
              } else {
                parsedLayers.fdp = parsed.parsedData as ParsedFDPData;
              }
              break;
            case 'FIBER_JOINT':
              if (parsedLayers.fiberJoint) {
                const existing = parsedLayers.fiberJoint;
                const incoming = parsed.parsedData as ParsedFiberJointData;
                existing.featureCount += incoming.featureCount;
                const startIdx = existing.joints.length;
                existing.joints.push(
                  ...incoming.joints.map((j, idx) => ({ ...j, index: startIdx + idx + 1 }))
                );
              } else {
                parsedLayers.fiberJoint = parsed.parsedData as ParsedFiberJointData;
              }
              break;
            case 'ROAD_EOP':
              if (parsedLayers.road) {
                const existing = parsedLayers.road;
                const incoming = parsed.parsedData as ParsedRoadData;
                existing.featureCount += incoming.featureCount;
                existing.totalLength += incoming.totalLength;
                const startIdx = existing.roadSegments.length;
                existing.roadSegments.push(
                  ...incoming.roadSegments.map((r, idx) => ({ ...r, index: startIdx + idx + 1 }))
                );
              } else {
                parsedLayers.road = parsed.parsedData as ParsedRoadData;
              }
              break;
            case 'DUCT':
              if (parsedLayers.duct) {
                const existing = parsedLayers.duct;
                const incoming = parsed.parsedData as ParsedPointAssetData;
                existing.featureCount += incoming.featureCount;
                const startIdx = existing.assets.length;
                existing.assets.push(
                  ...incoming.assets.map((a, idx) => ({ ...a, index: startIdx + idx + 1 }))
                );
              } else {
                parsedLayers.duct = parsed.parsedData as ParsedPointAssetData;
              }
              break;
            case 'HANDHOLE':
              if (parsedLayers.handhole) {
                const existing = parsedLayers.handhole;
                const incoming = parsed.parsedData as ParsedPointAssetData;
                existing.featureCount += incoming.featureCount;
                const startIdx = existing.assets.length;
                existing.assets.push(
                  ...incoming.assets.map((a, idx) => ({ ...a, index: startIdx + idx + 1 }))
                );
              } else {
                parsedLayers.handhole = parsed.parsedData as ParsedPointAssetData;
              }
              break;
            case 'MANHOLE':
              if (parsedLayers.manhole) {
                const existing = parsedLayers.manhole;
                const incoming = parsed.parsedData as ParsedPointAssetData;
                existing.featureCount += incoming.featureCount;
                const startIdx = existing.assets.length;
                existing.assets.push(
                  ...incoming.assets.map((a, idx) => ({ ...a, index: startIdx + idx + 1 }))
                );
              } else {
                parsedLayers.manhole = parsed.parsedData as ParsedPointAssetData;
              }
              break;
            case 'ODF':
              if (parsedLayers.odf) {
                const existing = parsedLayers.odf;
                const incoming = parsed.parsedData as ParsedPointAssetData;
                existing.featureCount += incoming.featureCount;
                const startIdx = existing.assets.length;
                existing.assets.push(
                  ...incoming.assets.map((a, idx) => ({ ...a, index: startIdx + idx + 1 }))
                );
              } else {
                parsedLayers.odf = parsed.parsedData as ParsedPointAssetData;
              }
              break;
            case 'RISER':
              if (parsedLayers.riser) {
                const existing = parsedLayers.riser;
                const incoming = parsed.parsedData as ParsedPointAssetData;
                existing.featureCount += incoming.featureCount;
                const startIdx = existing.assets.length;
                existing.assets.push(
                  ...incoming.assets.map((a, idx) => ({ ...a, index: startIdx + idx + 1 }))
                );
              } else {
                parsedLayers.riser = parsed.parsedData as ParsedPointAssetData;
              }
              break;
            case 'FTC':
              if (parsedLayers.ftc) {
                const existing = parsedLayers.ftc;
                const incoming = parsed.parsedData as ParsedPointAssetData;
                existing.featureCount += incoming.featureCount;
                const startIdx = existing.assets.length;
                existing.assets.push(
                  ...incoming.assets.map((a, idx) => ({ ...a, index: startIdx + idx + 1 }))
                );
              } else {
                parsedLayers.ftc = parsed.parsedData as ParsedPointAssetData;
              }
              break;
            case 'TEST_POINT':
              if (parsedLayers.testPoint) {
                const existing = parsedLayers.testPoint;
                const incoming = parsed.parsedData as ParsedPointAssetData;
                existing.featureCount += incoming.featureCount;
                const startIdx = existing.assets.length;
                existing.assets.push(
                  ...incoming.assets.map((a, idx) => ({ ...a, index: startIdx + idx + 1 }))
                );
              } else {
                parsedLayers.testPoint = parsed.parsedData as ParsedPointAssetData;
              }
              break;
            case 'BUILDING':
              if (parsedLayers.building) {
                const existing = parsedLayers.building;
                const incoming = parsed.parsedData as ParsedPointAssetData;
                existing.featureCount += incoming.featureCount;
                const startIdx = existing.assets.length;
                existing.assets.push(
                  ...incoming.assets.map((a, idx) => ({ ...a, index: startIdx + idx + 1 }))
                );
              } else {
                parsedLayers.building = parsed.parsedData as ParsedPointAssetData;
              }
              break;
          }

          let featureCount = 0;
          if ('featureCount' in parsed.parsedData) {
            featureCount = parsed.parsedData.featureCount;
          } else if ('segments' in parsed.parsedData) {
            featureCount = (parsed.parsedData as ParsedCableData).segments.length;
          }

          layerResults.push({
            layerName: file.fileName,
            layerType,
            featureCount,
            status: 'PARSED',
            errors: [],
            warnings: [],
          });

          auditLog.push({
            timestamp: new Date().toISOString(),
            action: 'LAYER_PARSED',
            entity: layerType,
            entityId: file.fileName,
            details: `Parsed ${file.fileName} as ${layerType} (${featureCount} features)`,
          });
        } catch (err) {
          const error = err as Error;
          layerResults.push({
            layerName: file.fileName,
            layerType: 'UNKNOWN',
            featureCount: 0,
            status: 'FAILED',
            errors: [error.message || 'Parse failed'],
            warnings: [],
          });

          auditLog.push({
            timestamp: new Date().toISOString(),
            action: 'LAYER_PARSE_FAILED',
            entity: 'UNKNOWN',
            entityId: file.fileName,
            details: `Failed to parse ${file.fileName}: ${error.message}`,
          });
        }
      }

      session.status = 'PARSED';
      session.updatedAt = new Date();

      // ====================================================================
      // AUTO-SNAP: Automatically align disconnected cables within 10m limit
      // ====================================================================
      if (parsedLayers.cable) {
        // Collect all potential snap target points (Poles, FDPs, FiberJoints)
        const snapTargets: [number, number][] = [];
        if (parsedLayers.pole?.poles) {
          parsedLayers.pole.poles.forEach((p: PoleItem) => snapTargets.push([p.longitude, p.latitude]));
        }
        if (parsedLayers.fdp?.fdps) {
          parsedLayers.fdp.fdps.forEach((f: FDPItem) => snapTargets.push([f.longitude, f.latitude]));
        }
        if (parsedLayers.fiberJoint?.joints) {
          parsedLayers.fiberJoint.joints.forEach((j: FiberJointItem) => snapTargets.push([j.longitude, j.latitude]));
        }

        const snapToleranceMeters = 10;
        let snapCount = 0;
        let newTotalLength = 0;

        parsedLayers.cable.segments.forEach((seg: CableSegment) => {
          const coords = seg.coordinates;
          if (coords && coords.length >= 2 && snapTargets.length > 0) {
            const startPt = coords[0]; // [lng, lat]
            const endPt = coords[coords.length - 1]; // [lng, lat]

            // Check distance and snap start point
            let closestStart: [number, number] | null = null;
            let minStartDist = Infinity;
            
            // Check distance and snap end point
            let closestEnd: [number, number] | null = null;
            let minEndDist = Infinity;

            for (const target of snapTargets) {
              const startDist = gisParser.haversineDistance(startPt, target);
              if (startDist <= snapToleranceMeters && startDist < minStartDist) {
                minStartDist = startDist;
                closestStart = target;
              }

              const endDist = gisParser.haversineDistance(endPt, target);
              if (endDist <= snapToleranceMeters && endDist < minEndDist) {
                minEndDist = endDist;
                closestEnd = target;
              }
            }

            if (closestStart) {
              coords[0] = [closestStart[0], closestStart[1]];
              seg.fromPoint = [closestStart[0], closestStart[1]];
              snapCount++;
            }
            if (closestEnd) {
              coords[coords.length - 1] = [closestEnd[0], closestEnd[1]];
              seg.toPoint = [closestEnd[0], closestEnd[1]];
              snapCount++;
            }

            // Recalculate segment length
            seg.length = gisParser.calculatePolylineLength(coords);
          }
          newTotalLength += seg.length;
        });

        if (snapCount > 0) {
          parsedLayers.cable.totalLength = newTotalLength;
          logger.info(`[GIS-SNAP] Auto-snapped ${snapCount} cable endpoints to closest poles/joints`);
          auditLog.push({
            timestamp: new Date().toISOString(),
            action: 'GIS_AUTO_SNAP',
            entity: 'CABLE',
            entityId: session.id,
            details: `Auto-snapped ${snapCount} cable endpoints within ${snapToleranceMeters}m limit to closest poles/joints.`,
          });
        }
      }

      // ====================================================================
      // PHASE 2: Validate all parsed layers
      // ====================================================================
      session.status = 'VALIDATING';
      session.updatedAt = new Date();

      const layersMap = new Map<GISLayerType, unknown>();
      if (parsedLayers.cable) layersMap.set('CABLE', parsedLayers.cable);
      if (parsedLayers.pole) layersMap.set('POLE', parsedLayers.pole);
      if (parsedLayers.fdp) layersMap.set('FDP', parsedLayers.fdp);
      if (parsedLayers.fiberJoint) layersMap.set('FIBER_JOINT', parsedLayers.fiberJoint);
      if (parsedLayers.road) layersMap.set('ROAD_EOP', parsedLayers.road);
      // New layer types
      if (parsedLayers.duct) layersMap.set('DUCT', parsedLayers.duct);
      if (parsedLayers.handhole) layersMap.set('HANDHOLE', parsedLayers.handhole);
      if (parsedLayers.manhole) layersMap.set('MANHOLE', parsedLayers.manhole);
      if (parsedLayers.odf) layersMap.set('ODF', parsedLayers.odf);
      if (parsedLayers.riser) layersMap.set('RISER', parsedLayers.riser);
      if (parsedLayers.ftc) layersMap.set('FTC', parsedLayers.ftc);
      if (parsedLayers.testPoint) layersMap.set('TEST_POINT', parsedLayers.testPoint);
      if (parsedLayers.building) layersMap.set('BUILDING', parsedLayers.building);

      const validationResult = gisValidator.validateAll(layersMap);

      // Update layer results with validation status
      for (const vr of validationResult.layerResults) {
        const existing = layerResults.find(
          (lr) => lr.layerType === vr.layerType
        );
        if (existing) {
          existing.status = vr.status;
          existing.errors.push(...vr.errors);
          existing.warnings.push(...vr.warnings);
        }
      }

      auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'VALIDATION_COMPLETED',
        entity: 'ALL_LAYERS',
        entityId: importId,
        details: `Validation: ${validationResult.isValid ? 'PASSED' : 'FAILED'} (${validationResult.errors.length} errors, ${validationResult.warnings.length} warnings)`,
      });

      session.status = 'VALIDATED';
      session.updatedAt = new Date();

      // ====================================================================
      // PHASE 3: Detect Project Type
      // ====================================================================
      const typeDetection = projectTypeDetector.detect(layersMap);

      auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'PROJECT_TYPE_DETECTED',
        entity: 'PROJECT_TYPE',
        entityId: typeDetection.projectType,
        details: `Detected: ${typeDetection.projectType} (${typeDetection.confidence}% confidence) - ${typeDetection.reasons.join('; ')}`,
      });

      // ====================================================================
      // PHASE 4a: Load Inventory Stock (before BOQ generation)
      // ====================================================================
      const inventoryStock: InventoryStockEntry[] = [];

      const invItems = await prisma.inventoryItem.findMany({
        where: {
          OR: [
            { code: { startsWith: 'POLE' } },
            { code: { startsWith: 'CBL' } },
            { code: { startsWith: 'FDP' } },
            { code: { startsWith: 'CLO' } },
            { code: { startsWith: 'DUCT' } },
            { code: { startsWith: 'HH' } },
            { code: { startsWith: 'MH' } },
            { code: { startsWith: 'ODF' } },
            { code: { startsWith: 'RISER' } },
            { code: { startsWith: 'FTC' } },
            { code: { startsWith: 'TP' } },
            { name: { contains: 'Pole', mode: 'insensitive' } },
            { name: { contains: 'Fiber', mode: 'insensitive' } },
            { name: { contains: 'Cable', mode: 'insensitive' } },
            { name: { contains: 'Chamber', mode: 'insensitive' } },
            { name: { contains: 'Closure', mode: 'insensitive' } },
            { name: { contains: 'Splice', mode: 'insensitive' } },
            { name: { contains: 'Manhole', mode: 'insensitive' } },
            { name: { contains: 'Duct', mode: 'insensitive' } },
            { name: { contains: 'Handhole', mode: 'insensitive' } },
            { name: { contains: 'ODF', mode: 'insensitive' } },
            { name: { contains: 'Riser', mode: 'insensitive' } },
            { name: { contains: 'FTC', mode: 'insensitive' } },
            { name: { contains: 'Test Point', mode: 'insensitive' } },
          ],
        },
        include: { stocks: true },
      });

      for (const item of invItems) {
        const totalQty = item.stocks.reduce((s: number, st) => s + (Number(st.quantity) || 0), 0);
        if (totalQty <= 0) continue;
        const typedItem = item as unknown as { id: string; code?: string; name?: string; unit?: string };
        const code = typedItem.code?.toUpperCase() || '';
        const name = typedItem.name?.toUpperCase() || '';
        let category = '';
        if (code.startsWith('CBL') || name.includes('CABLE') || name.includes('FIBER')) category = 'CABLE';
        else if (code.startsWith('POLE') || name.includes('POLE')) category = 'POLE';
        else if (code.startsWith('FDP') || name.includes('FDP')) category = 'FDP';
        else if (code.startsWith('CLO') || name.includes('CLOSURE') || name.includes('SPLICE') || name.includes('JOINT')) category = 'FIBER_JOINT';
        else if (code.startsWith('DUCT') || name.includes('DUCT')) category = 'DUCT';
        else if (code.startsWith('HH') || name.includes('HANDHOLE')) category = 'HANDHOLE';
        else if (code.startsWith('MH') || name.includes('MANHOLE') || name.includes('CHAMBER')) category = 'MANHOLE';
        else if (code.startsWith('ODF') || name.includes('ODF')) category = 'ODF';
        else if (code.startsWith('RISER') || name.includes('RISER')) category = 'RISER';
        else if (code.startsWith('FTC') || name.includes('FTC')) category = 'FTC';
        else if (code.startsWith('TP') || name.includes('TEST POINT')) category = 'TEST_POINT';
        else continue;
        const existing = inventoryStock.find((e) => e.category === category);
        if (existing) {
          existing.availableQty += totalQty;
        } else {
          inventoryStock.push({
            category,
            availableQty: totalQty,
            itemCode: typedItem.code || undefined,
            materialId: typedItem.id,
            unit: typedItem.unit || undefined,
          });
        }
      }

      auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'INVENTORY_LOADED',
        entity: 'InventoryItem',
        entityId: importId,
        details: `Loaded ${inventoryStock.length} inventory stock categories (${invItems.length} items) for BOQ sourcing`,
      });

      // ====================================================================
      // PHASE 4b: Generate BOQ with inventory stock and region multiplier
      // ====================================================================
      // Only apply region multiplier if user has enabled it in the upload UI
      const regionMultiplier = session.useRegionMultiplier
        ? resolveRegionMultiplier(session.region)
        : 1.0;
      const boq = boqEngine.generateBOQ(
        layersMap,
        session.region,
        regionMultiplier,
        inventoryStock
      );

      auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'BOQ_GENERATED',
        entity: 'GISGeneratedBOQ',
        entityId: importId,
        details: `BOQ generated: ${boq.items.length} items, total LKR ${boq.totalEstimatedCost.toLocaleString()} (region multiplier: ${regionMultiplier}x, ${session.useRegionMultiplier ? 'enabled' : 'disabled'})`,
      });

      // ====================================================================
      // PHASE 5: Compute Analytics
      // ====================================================================
      const analytics = gisAnalyticsEngine.compute({
        cableData: parsedLayers.cable,
        poleData: parsedLayers.pole,
        fdpData: parsedLayers.fdp,
        jointData: parsedLayers.fiberJoint,
        roadData: parsedLayers.road,
        boq,
        region: session.region,
        district: session.district,
      });

      // ====================================================================
      // PHASE 6: Persist everything to database
      // ====================================================================
      session.status = 'PROCESSING';
      session.updatedAt = new Date();

      const result = await this.persistToDatabase(
        session,
        parsedLayers,
        layersMap,
        typeDetection.projectType,
        typeDetection.confidence,
        boq,
        analytics,
        layerResults,
        auditLog
      );

      session.status = 'COMPLETED';
      session.updatedAt = new Date();

      const elapsed = Date.now() - startTime;
      logger.info(
        `GIS Import ${importId} completed in ${elapsed}ms. ` +
          `Project: ${result.projectCode}, ` +
          `Assets: ${result.assetsCreated}, ` +
          `Surveys: ${result.surveyTasksCreated}, ` +
          `Permits: ${result.permitsCreated}, ` +
          `Workflow: ${result.workflowInstantiated ? 'YES' : 'NO'}`
      );

      return {
        importId,
        result,
        message: `GIS import completed successfully. Project ${result.projectCode} created with ${result.assetsCreated} assets, ${result.surveyTasksCreated} survey tasks, and ${result.permitsCreated} permits.`,
      };
    } catch (err) {
      const error = err as Error;
      session.status = 'FAILED';
      session.updatedAt = new Date();

      auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'IMPORT_FAILED',
        entity: 'GISImport',
        entityId: importId,
        details: `Import failed: ${error.message}`,
      });

      logger.error(`GIS Import ${importId} failed: ${error.message}`, error);

      throw err;
    }
  }

  /**
   * Persist all GIS data to the database
   */
  private static async persistToDatabase(
    session: GISUploadSession,
    parsedLayers: ParsedLayerMap,
    layersMap: Map<GISLayerType, unknown>,
    projectType: DetectedProjectType,
    confidence: number,
    boq: BOQSummary,
    analytics: GISAnalytics,
    layerResults: GISLayerResult[],
    auditLog: GISAuditEntry[]
  ): Promise<GISImportResult> {
    let project: import('@prisma/client').Project | null = null;
    let isUpgrade = false;

    if (session.projectId) {
      isUpgrade = true;
      project = await prisma.project.findUnique({ where: { id: session.projectId } });
      if (!project) throw new Error(`Project ${session.projectId} not found for route upgrade.`);
      session.isCompletedProject = project.status === 'COMPLETED';
    } else {
      const projectCode = await this.generateProjectCode(projectType);
      const projectName = session.projectName || `${projectType} Project - ${projectCode}`;

      // ======================================================================
      // 1. CREATE PROJECT (With Automated OPMC/Region lookup)
      // ======================================================================
      let opmcId: string | null = null;
      if (session.region) {
        const opmc = await prisma.oPMC.findFirst({
          where: {
            OR: [
              { name: { contains: session.region, mode: 'insensitive' } },
              { rtom: { contains: session.region, mode: 'insensitive' } },
              { region: { contains: session.region, mode: 'insensitive' } },
            ],
          },
        });
        if (opmc) {
          opmcId = opmc.id;
        }
      }

      project = await prisma.project.create({
        data: {
          projectCode,
          name: projectName,
          description: session.isCompletedProject
            ? `Historical completed project imported from GIS. Type: ${projectType} (${confidence}% confidence).`
            : `Auto-created from GIS import. Type: ${projectType} (${confidence}% confidence). ${layerResults.length} layers imported.`,
          type: projectType,
          status: session.isCompletedProject ? 'COMPLETED' : 'PLANNING',
          location: session.region
            ? `${session.region}${session.district ? ` / ${session.district}` : ''}${session.lea ? ` / ${session.lea}` : ''}`
            : null,
          opmcId,
          budget: boq.totalEstimatedCost,
          actualCost: session.isCompletedProject ? boq.totalEstimatedCost : 0,
          variance: session.isCompletedProject ? 0 : boq.totalEstimatedCost,
          startDate: new Date(),
          estimatedDuration: 180,
        },
      });

      auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'PROJECT_CREATED',
        entity: 'Project',
        entityId: project.id,
        details: `Project ${projectCode} created (${projectType})`,
      });
    }

    const projectCode = project.projectCode;
    const projectName = project.name;

    // ======================================================================
    // 2. CREATE GIS ROUTE
    // ======================================================================
    let gisRouteId: string | null = null;

    if (parsedLayers.cable) {
      const routeName = `GIS Route - ${projectCode}`;

      // Construct GeoJSON FeatureCollection on the fly for National Map rendering
      const features: Record<string, unknown>[] = [];

      if (parsedLayers.cable) {
        parsedLayers.cable.segments.forEach((seg) => {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: seg.coordinates,
            },
            properties: {
              layer: 'CABLE',
              cable_type: seg.cableType || parsedLayers.cable?.cableType,
              fiber_count: seg.fiberCount || parsedLayers.cable?.fiberCount,
              length: seg.length,
              ...seg.properties,
            },
          });
        });
      }

      if (parsedLayers.pole) {
        parsedLayers.pole.poles.forEach((pole) => {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [pole.longitude, pole.latitude],
            },
            properties: {
              layer: 'POLE',
              pole_number: pole.properties?.PL_Number || `PL-${pole.index}`,
              pole_type: pole.poleType,
              height: pole.height,
              ...pole.properties,
            },
          });
        });
      }

      if (parsedLayers.fdp) {
        parsedLayers.fdp.fdps.forEach((fdp) => {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [fdp.longitude, fdp.latitude],
            },
            properties: {
              layer: 'FDP',
              fdp_number: fdp.properties?.FDP_Number || fdp.fdpCode || `FDP-${fdp.index}`,
              capacity: fdp.properties?.Capacity || fdp.portCount,
              ...fdp.properties,
            },
          });
        });
      }

      if (parsedLayers.fiberJoint) {
        parsedLayers.fiberJoint.joints.forEach((joint) => {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [joint.longitude, joint.latitude],
            },
            properties: {
              layer: 'FIBER_JOINT',
              joint_number: joint.properties?.Joint_Number || `JT-${joint.index}`,
              type: joint.jointType,
              ...joint.properties,
            },
          });
        });
      }

      // Add other point asset layers if present
      const pointKeys: Array<'duct' | 'handhole' | 'manhole' | 'odf' | 'riser' | 'ftc' | 'testPoint' | 'building'> = [
        'duct',
        'handhole',
        'manhole',
        'odf',
        'riser',
        'ftc',
        'testPoint',
        'building',
      ];
      pointKeys.forEach((key) => {
        const parsedData = parsedLayers[key] as ParsedPointAssetData | undefined;
        if (parsedData) {
          parsedData.assets.forEach((asset) => {
            features.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [asset.longitude, asset.latitude],
              },
              properties: {
                layer: key.toUpperCase(),
                name: asset.properties?.Name || asset.code,
                status: asset.properties?.Status || asset.type,
                ...asset.properties,
              },
            });
          });
        }
      });

      let nextVersion = 1;
      let parentVersionId: string | undefined = undefined;

      if (isUpgrade) {
        const activeRoute = await prisma.gISRoute.findFirst({
          where: { projectId: project.id, isActive: true },
          orderBy: { version: 'desc' }
        });
        if (activeRoute) {
          nextVersion = activeRoute.version + 1;
          parentVersionId = activeRoute.id;

          // Deactivate old route
          await prisma.gISRoute.update({
            where: { id: activeRoute.id },
            data: { isActive: false }
          });
        }
      }

      const route = await prisma.gISRoute.create({
        data: {
          projectId: project.id,
          name: routeName,
          description: session.isCompletedProject
            ? `Historical completed route imported from GIS.`
            : `Auto-generated GIS route from ${layerResults.length} imported layers`,
          sourceFormat: 'GEOJSON',
          routeLength: parsedLayers.cable.totalLength,
          status: session.isCompletedProject ? 'APPROVED' : 'IMPORTED',
          versionType: session.versionType || (session.isCompletedProject ? 'AS_BUILT' : 'PLANNED'),
          version: nextVersion,
          parentVersionId,
          geojsonData: {
            type: 'FeatureCollection',
            features,
          },
          isActive: true,
        },
      });
      gisRouteId = route.id;

      if (parentVersionId) {
        await prisma.gISRoute.update({
          where: { id: parentVersionId },
          data: { childVersionId: route.id }
        });
      }

      auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'GIS_ROUTE_CREATED',
        entity: 'GISRoute',
        entityId: route.id,
        details: `Route ${routeName} created (${parsedLayers.cable.totalLength.toFixed(2)}m)`,
      });

      // ====================================================================
      // 2a. CREATE CABLE SEGMENTS
      // ====================================================================
      if (parsedLayers.cable.segments.length > 0) {
        await prisma.gISCableSegment.createMany({
          data: parsedLayers.cable.segments.map((seg) => ({
            routeId: route.id,
            segmentNumber: seg.index,
            length: seg.length,
            cableType: seg.cableType || parsedLayers.cable?.cableType,
            fiberCount: seg.fiberCount || parsedLayers.cable?.fiberCount,
            status: (session.isCompletedProject || GISImportService.checkIsExisting(seg.properties?._sourceFile || '', seg.properties)) ? 'INSTALLED' : 'PLANNED',
            properties: {
              ...(seg.properties || {}),
              coordinates: seg.coordinates || [],
            },
          })),
        });
      }

      // ====================================================================
      // 2b. CREATE POLES
      // ====================================================================
      if (parsedLayers.pole) {
        await prisma.gISPole.createMany({
          data: parsedLayers.pole.poles.map((pole) => {
            const props = pole.properties || {};
            const sourceFile = props._sourceFile || '';
            const isExisting = GISImportService.checkIsExisting(sourceFile, props);
            
            return {
              routeId: route.id,
              poleNumber: pole.index,
              latitude: pole.latitude,
              longitude: pole.longitude,
              elevation: pole.elevation,
              poleType: pole.poleType || 'CONCRETE',
              height: pole.height || 9,
              status: isExisting ? 'VERIFIED' : (session.isCompletedProject ? 'VERIFIED' : 'PLANNED'),
              properties: props,
            };
          }),
        });

        auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'POLES_CREATED',
          entity: 'GISPole',
          entityId: route.id,
          details: `${parsedLayers.pole.poles.length} poles created`,
        });
      }

      // ====================================================================
      // 2c. CREATE FDPs AS CLOSURES (GISClosure)
      // ====================================================================
      if (parsedLayers.fdp) {
        await prisma.gISClosure.createMany({
          data: parsedLayers.fdp.fdps.map((fdp, idx) => {
            const props = fdp.properties || {};
            const sourceFile = props._sourceFile || '';
            const isExisting = GISImportService.checkIsExisting(sourceFile, props);
            return {
              routeId: route.id,
              closureNumber: fdp.index || idx + 1,
              closureType: 'TERMINAL',
              latitude: fdp.latitude,
              longitude: fdp.longitude,
              capacity: fdp.portCount || 8,
              status: (isExisting || session.isCompletedProject) ? 'VERIFIED' : 'PLANNED',
              notes: `FDP ${fdp.fdpCode || fdp.index} - ${fdp.portCount || '?'} ports${fdp.splitters ? `, ${fdp.splitters} splitter(s)` : ''}`,
              properties: props,
            };
          }),
        });

        auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'FDPS_CREATED_AS_CLOSURES',
          entity: 'GISClosure',
          entityId: route.id,
          details: `${parsedLayers.fdp.fdps.length} FDPs created as closures`,
        });
      }

      // ====================================================================
      // 2d. CREATE FIBER JOINTS AS CLOSURES (GISClosure)
      // ====================================================================
      if (parsedLayers.fiberJoint) {
        await prisma.gISClosure.createMany({
          data: parsedLayers.fiberJoint.joints.map((joint, idx) => {
            const props = joint.properties || {};
            const sourceFile = props._sourceFile || '';
            const isExisting = GISImportService.checkIsExisting(sourceFile, props);
            return {
              routeId: route.id,
              closureNumber: 100 + (joint.index || idx + 1),
              closureType: joint.jointType || 'DOME',
              latitude: joint.latitude,
              longitude: joint.longitude,
              capacity: joint.capacity || 48,
              status: (isExisting || session.isCompletedProject) ? 'VERIFIED' : 'PLANNED',
              notes: `Fiber Joint ${joint.index} - ${joint.jointType || 'DOME'} type, ${joint.capacity || 48}F capacity`,
              properties: props,
            };
          }),
        });

        auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'FIBER_JOINTS_CREATED_AS_CLOSURES',
          entity: 'GISClosure',
          entityId: route.id,
          details: `${parsedLayers.fiberJoint.joints.length} fiber joints created as closures`,
        });
      }

      // ====================================================================
      // 2e. CREATE CHAMBERS (GISChamber)
      // ====================================================================
      const chambersToCreate: import('@prisma/client').Prisma.GISChamberCreateManyInput[] = [];
      let chamberSeq = 1;

      if (parsedLayers.manhole?.assets?.length) {
          for (const mh of parsedLayers.manhole.assets) {
            const props = mh.properties || {};
            const sourceFile = props._sourceFile || '';
            const isExisting = GISImportService.checkIsExisting(sourceFile, props);
            chambersToCreate.push({
              routeId: route.id,
              chamberNumber: chamberSeq++,
              chamberType: mh.type || 'MANHOLE',
              latitude: mh.latitude,
              longitude: mh.longitude,
              status: (isExisting || session.isCompletedProject) ? 'VERIFIED' : 'PLANNED',
              notes: mh.code ? `Manhole Code: ${mh.code}` : undefined,
            });
          }
        }
  
        if (parsedLayers.handhole?.assets?.length) {
          for (const hh of parsedLayers.handhole.assets) {
            const props = hh.properties || {};
            const sourceFile = props._sourceFile || '';
            const isExisting = GISImportService.checkIsExisting(sourceFile, props);
            chambersToCreate.push({
              routeId: route.id,
              chamberNumber: chamberSeq++,
              chamberType: hh.type || 'HANDHOLE',
              latitude: hh.latitude,
              longitude: hh.longitude,
              status: (isExisting || session.isCompletedProject) ? 'VERIFIED' : 'PLANNED',
              notes: hh.code ? `Handhole Code: ${hh.code}` : undefined,
            });
          }
        }

      if (chambersToCreate.length > 0) {
        await prisma.gISChamber.createMany({
          data: chambersToCreate,
        });

        auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'CHAMBERS_CREATED',
          entity: 'GISChamber',
          entityId: route.id,
          details: `${chambersToCreate.length} chambers created (manholes + handholes)`,
        });
      }
    }

    // ======================================================================
    // 3. GENERATE ASSETS (ProjectAsset records)
    // ======================================================================
    const assetResult = assetEngine.generateAssets(
      layersMap,
      projectCode,
      session.createdById
    );

    if (assetResult.assets.length > 0) {
      if (isUpgrade) {
        await prisma.projectAsset.deleteMany({ where: { projectId: project.id, sourceType: 'GIS_ROUTE' } });
      }

      await prisma.projectAsset.createMany({
        data: assetResult.assets.map((a) => ({
          projectId: project.id,
          assetType: a.assetType,
          assetCode: a.assetCode,
          assetName: a.assetName,
          latitude: a.latitude,
          longitude: a.longitude,
          status: 'ACTIVE',
          sourceType: a.sourceType,
          createdById: session.createdById,
        })),
      });

      auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'ASSETS_CREATED',
        entity: 'ProjectAsset',
        entityId: project.id,
        details: `${assetResult.count} assets created from GIS data`,
      });
    }

    // ======================================================================
    // 4. CREATE SURVEY REQUESTS
    // ======================================================================
    let surveyTasksCreated = 0;
    if (!session.isCompletedProject && !isUpgrade) {
      const surveyResult = surveyGenerator.generateSurveyTasks(layersMap);

      if (surveyResult.tasks.length > 0) {
        // Create a survey request for the field team
        const surveyRequest = await prisma.surveyRequest.create({
          data: {
            projectId: project.id,
            requestNumber: `SRV-${projectCode}`,
            title: `Field Survey - ${projectName}`,
            description: `Auto-generated survey from GIS import. ${surveyResult.count} tasks to complete.`,
            surveyType: 'ROUTE_SURVEY',
            priority: 'HIGH',
            status: 'PENDING',
            createdById: session.createdById,
          },
        });

        auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'SURVEY_REQUEST_CREATED',
          entity: 'SurveyRequest',
          entityId: surveyRequest.id,
          details: `Survey request ${surveyRequest.requestNumber} created with ${surveyResult.count} field tasks`,
        });

        // Create FieldTasks
        if (surveyResult.tasks.length > 0) {
          await prisma.fieldTask.createMany({
            data: surveyResult.tasks.map((t) => ({
              projectId: project.id,
              title: t.title,
              description: t.description,
              status: 'ASSIGNED',
              priority: t.priority,
              latitude: t.latitude,
              longitude: t.longitude,
            })),
          });

          surveyTasksCreated = surveyResult.tasks.length;
        }

        auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'FIELD_TASKS_CREATED',
          entity: 'FieldTask',
          entityId: surveyRequest.id,
          details: `${surveyTasksCreated} field tasks created from GIS survey`,
        });
      }
    }

    // ======================================================================
    // 5. CREATE PERMITS
    // ======================================================================
    let permitsCreated = 0;
    if (!session.isCompletedProject && !isUpgrade) {
      const permitResult = permitGenerator.generatePermits(
        layersMap,
        session.region
      );

      if (permitResult.permits.length > 0) {
        // Find or create permit types
        for (const permit of permitResult.permits) {
          // Find or create authority entity
          let authorityEntity = await prisma.authorityEntity.findFirst({
            where: { name: permit.authority },
          });

          if (!authorityEntity) {
            authorityEntity = await prisma.authorityEntity.create({
              data: {
                name: permit.authority,
                shortName: permit.authority.substring(0, 10),
                isActive: true,
              },
            });
          }

          // Find or create permit type
          let permitType = await prisma.permitType.findFirst({
            where: { code: permit.permitTypeCode },
          });

          if (!permitType) {
            permitType = await prisma.permitType.create({
              data: {
                name: permit.permitType || permit.permitTypeCode,
                code: permit.permitTypeCode,
                authorityId: authorityEntity.id,
                isActive: true,
              },
            });
          }

          // Create the permit
          await prisma.projectPermit.create({
            data: {
              projectId: project.id,
              permitTypeId: permitType.id,
              permitNumber: `PERM-${projectCode}-${String(permitsCreated + 1).padStart(3, '0')}`,
              status: permit.status,
              cost: permit.cost,
              remarks: `${permit.roadName} - ${permit.authority}`,
              appliedById: session.createdById,
            },
          });

          permitsCreated++;
        }

        auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'PERMITS_CREATED',
          entity: 'ProjectPermit',
          entityId: project.id,
          details: `${permitsCreated} permits created via ${permitResult.authorities.join(', ')}`,
        });
      }
    }

    // ======================================================================
    // 6. GENERATE BOQ (GISGeneratedBOQ)
    // ======================================================================
    if (boq.items.length > 0 && gisRouteId) {
      const generatedBOQ = await prisma.gISGeneratedBOQ.create({
        data: {
          routeId: gisRouteId,
          projectId: project.id,
          status: 'DRAFT',
          totalEstimated: boq.totalEstimatedCost,
          createdById: session.createdById,
        },
      });

      // Create BOQ items — use the engine's pre-computed source/materialId/itemCode
      await prisma.gISGeneratedBOQItem.createMany({
        data: boq.items.map((item, idx) => ({
          boqId: generatedBOQ.id,
          itemCategory: item.category,
          itemCode: item.itemCode || `BOQ-${projectCode}-${item.category.substring(0, 3)}-${String(idx + 1).padStart(2, '0')}`,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitRate: item.unitRate,
          amount: item.amount,
          sourceType: item.source === 'EXISTING' ? 'EXISTING_STOCK' : 'AUTO_CALCULATED',
          sourceReference: item.materialId
            ? `Inventory: ${item.materialId} (${item.itemCode || 'N/A'})`
            : `GIS Import ${session.id}`,
        })),
      });

      // Sync BOQ items to ProjectBOQItem for dashboard BOQ tab visibility.
      // Now uses the boq engine's pre-computed source/materialId/itemCode directly
      // instead of duplicating inventory logic.
      if (!session.isCompletedProject) {
        if (isUpgrade) {
          await prisma.projectBOQItem.deleteMany({ where: { projectId: project.id, remarks: { startsWith: 'GIS Import' } } });
        }

        const categoryCounters: Record<string, number> = {};
        await prisma.projectBOQItem.createMany({
          data: boq.items.map((item) => {
            const catKey = item.category.substring(0, 3);
            categoryCounters[catKey] = (categoryCounters[catKey] || 0) + 1;
            const seq = String(categoryCounters[catKey]).padStart(2, '0');
            const roundedAmount = Math.round(item.amount * 100) / 100;
            const source: 'EXISTING' | 'NEW' = item.source || 'NEW';

            let remarks = `GIS Import ${session.id}`;
            if (source === 'EXISTING') {
              remarks = `GIS Import ${session.id} | Available in stock (${item.itemCode || item.materialId})`;
            } else {
              remarks = `GIS Import ${session.id} | No stock available — procurement required`;
            }

            return {
              projectId: project.id,
              category: item.category,
              itemCode: item.itemCode || `BOQ-${projectCode}-${catKey}-${seq}`,
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              unitRate: Math.round(item.unitRate * 100) / 100,
              amount: roundedAmount,
              source,
              materialId: item.materialId || null,
              remarks,
            };
          }),
        });

        // Create milestones from BOQ categories for dashboard milestone tab
        const milestoneNames = [...new Set(boq.items.map((i) => i.category))];
        await prisma.projectMilestone.createMany({
          data: milestoneNames.map((cat, idx) => ({
            projectId: project.id,
            name: cat,
            description: `GIS-generated milestone for ${cat}`,
            targetDate: new Date(Date.now() + (idx + 1) * 30 * 86400000), // spaced every 30 days
            status: 'PENDING',
          })),
        });

        auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'MILESTONES_CREATED',
          entity: 'ProjectMilestone',
          entityId: project.id,
          details: `${milestoneNames.length} milestones created from BOQ categories`,
        });
      }

      auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'BOQ_PERSISTED',
        entity: 'GISGeneratedBOQ',
        entityId: generatedBOQ.id,
        details: `BOQ persisted with ${boq.items.length} items, total LKR ${boq.totalEstimatedCost.toLocaleString()} (synced to ProjectBOQItem)`,
      });
    }

    // ======================================================================
    // 7. INSTANTIATE WORKFLOW
    // ======================================================================
    let workflowInstantiated = false;
    let stagesCreated = 0;
    let tasksCreated = 0;

    if (!session.isCompletedProject && !isUpgrade) {
      try {
        // Get or create ProjectType for workflow template mapping
        let projectTypeRecord = await prisma.projectType.findFirst({
          where: {
            name: {
              contains: projectType === 'CLUSTER_DEVELOPMENT' ? 'Cluster' :
                        projectType === 'BUILDING_FIBER' ? 'Building' :
                        projectType === 'SSD' ? 'SSD' : 'OSP',
            },
          },
        });

        if (!projectTypeRecord) {
          projectTypeRecord = await prisma.projectType.create({
            data: {
              name: projectType === 'CLUSTER_DEVELOPMENT' ? 'Cluster Development' :
                    projectType === 'BUILDING_FIBER' ? 'Building Fiber' :
                    projectType === 'SSD' ? 'SSD' : 'OSP FTTH',
              description: `Auto-created for GIS import project type: ${projectType}`,
            },
          });
        }

        // Update project with project type
        await prisma.project.update({
          where: { id: project.id },
          data: { projectTypeId: projectTypeRecord.id },
        });

        // Check if a workflow template exists for this project type
        const existingTemplate = await prisma.workflowTemplate.findFirst({
          where: { projectTypeId: projectTypeRecord.id, isActive: true },
        });

        let template = existingTemplate;

        if (!template) {
          // Create a workflow template from the definitions
          const workflowDef = getWorkflowForProjectType(projectType);
          const templateName = `${workflowDef.templateName} - Auto Generated`;
          
          // Find by name first (may exist from previous run with different projectTypeId)
          template = await prisma.workflowTemplate.findFirst({
            where: { name: templateName }
          });
          
          if (template) {
            // Update to link to current project type
            template = await prisma.workflowTemplate.update({
              where: { id: template.id },
              data: { projectTypeId: projectTypeRecord.id, isActive: true },
            });
          } else {
            template = await prisma.workflowTemplate.create({
              data: {
                name: templateName,
                description: `Auto-generated workflow template for ${projectType}`,
                projectTypeId: projectTypeRecord.id,
                isActive: true,
              },
            });
          }
        }

        // ============================================================
        // BACKFILL: Ensure stage/checklist/approval templates exist
        // This runs for BOTH existing and newly created templates to fix
        // templates created by prior versions that omitted checklists/approvals
        // ============================================================
        {
          const workflowDef = getWorkflowForProjectType(projectType);

          // Fetch existing stage templates (may have been created in a prior run)
          const existingStageTemplates = await prisma.workflowStageTemplate.findMany({
            where: { workflowTemplateId: template.id },
            include: {
              checklistTemplates: true,
              approvalTemplates: true,
            },
          });

          const stageTemplateByName = new Map(existingStageTemplates.map(s => [s.name, s]));
          const stageTemplateBySeq = new Map(existingStageTemplates.map(s => [s.sequence, s]));

          // Create stage templates if they don't exist, and backfill any missing sub-templates
          for (const stageDef of workflowDef.stages) {
            let stageTemplate = stageTemplateByName.get(stageDef.name) || stageTemplateBySeq.get(stageDef.sequence);

            if (!stageTemplate) {
              // Create new stage template
              stageTemplate = await prisma.workflowStageTemplate.create({
                data: {
                  name: stageDef.name,
                  description: `Stage ${stageDef.sequence}: ${stageDef.name}`,
                  sequence: stageDef.sequence,
                  workflowTemplateId: template.id,
                  reqApproval: stageDef.reqApproval,
                  reqChecklist: stageDef.reqChecklist,
                  reqPhotos: stageDef.reqPhotos,
                  reqDocuments: stageDef.reqDocuments,
                  reqOTDR: stageDef.reqOTDR,
                  reqGPS: stageDef.reqGPS,
                },
                include: {
                  checklistTemplates: true,
                  approvalTemplates: true,
                },
              });

              // Create task templates for the new stage
              for (const taskDef of stageDef.tasks) {
                await prisma.workflowTaskTemplate.create({
                  data: {
                    name: taskDef,
                    description: `${stageDef.name} - ${taskDef}`,
                    priority: 'MEDIUM',
                    stageTemplateId: stageTemplate.id,
                  },
                });
              }
            } else if (stageTemplate.name !== stageDef.name) {
              // Align the name of the stage template with the code registry definitions
              stageTemplate = await prisma.workflowStageTemplate.update({
                where: { id: stageTemplate.id },
                data: { name: stageDef.name },
                include: {
                  checklistTemplates: true,
                  approvalTemplates: true,
                },
              });
            }

            // Backfill checklist templates if stage requires checklist but has none
            // This fixes templates created by prior versions that omitted checklists
            if (stageDef.reqChecklist && stageTemplate.checklistTemplates.length === 0) {
              const checklistItems = getDefaultChecklist(stageDef.name, stageDef.reqPhotos);
              for (const clItem of checklistItems) {
                await prisma.workflowChecklistTemplate.create({
                  data: {
                    stageTemplateId: stageTemplate.id,
                    label: clItem.label,
                    isMandatory: clItem.isMandatory,
                  },
                });
              }
              logger.info(`Backfilled ${checklistItems.length} checklist templates for stage "${stageDef.name}"`);
            }

            // Backfill approval templates if stage requires approval but has none
            // This fixes templates created by prior versions that omitted approvals
            if (stageDef.reqApproval && stageTemplate.approvalTemplates.length === 0) {
              const approvalLevels = getDefaultApprovals();
              for (const apItem of approvalLevels) {
                await prisma.workflowApprovalTemplate.create({
                  data: {
                    stageTemplateId: stageTemplate.id,
                    level: apItem.level,
                    role: apItem.role,
                  },
                });
              }
              logger.info(`Backfilled ${approvalLevels.length} approval templates for stage "${stageDef.name}"`);
            }
          }
        }

        // Initialize project workflow using the WorkflowEngine
        const projectWorkflow = await WorkflowEngine.initializeProjectWorkflow(
          project.id,
          projectTypeRecord.id
        );

        workflowInstantiated = true;

        // Count stages and tasks created
        stagesCreated = await prisma.projectStageInstance.count({
          where: { projectWorkflowInstanceId: projectWorkflow.id },
        });
        tasksCreated = await prisma.projectTaskInstance.count({
          where: {
            stage: { projectWorkflowInstanceId: projectWorkflow.id },
          },
        });

        auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'WORKFLOW_INSTANTIATED',
          entity: 'ProjectWorkflowInstance',
          entityId: projectWorkflow.id,
          details: `Workflow instantiated: ${stagesCreated} stages, ${tasksCreated} tasks`,
        });
      } catch (wfErr) {
        const wfError = wfErr as Error;
        logger.warn(`Workflow instantiation failed for project ${projectCode}: ${wfError.message}`);
        auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'WORKFLOW_INSTANTIATION_FAILED',
          entity: 'ProjectWorkflowInstance',
          entityId: project.id,
          details: `Workflow instantiation failed: ${wfError.message}`,
        });
      }
    }

    // ======================================================================
    // 8. CREATE AUDIT LOG ENTRIES
    // ======================================================================
    for (const entry of auditLog) {
      await prisma.workflowAuditLog.create({
        data: {
          userId: session.createdById,
          action: entry.action,
          entityType: entry.entity,
          entityId: entry.entityId,
          details: { message: entry.details },
        },
      });
    }

    // ======================================================================
    // BUILD RESULT
    // ======================================================================
    return {
      importId: session.id,
      projectId: project.id,
      projectCode,
      projectName,
      projectType,
      confidence,
      layers: layerResults,
      analytics,
      boq,
      assetsCreated: assetResult.count,
      surveyTasksCreated,
      permitsCreated,
      workflowInstantiated,
      stagesCreated,
      tasksCreated,
      audit: auditLog,
    };
  }

  /**
   * Get session status
   */
  static getSession(importId: string): GISUploadSession | undefined {
    return this.sessions.get(importId);
  }

  /**
   * List all sessions
   */
  static listSessions(): GISUploadSession[] {
    return Array.from(this.sessions.values());
  }
}