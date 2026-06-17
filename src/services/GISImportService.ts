// ============================================================================
// GIS IMPORT SERVICE - Orchestration Engine for GIS Ingestion Pipeline
// ============================================================================
// Enterprise service that orchestrates the full GIS-to-ERP pipeline:
// Parse -> Validate -> Detect Type -> BOQ -> Assets -> Survey -> Permits -> Workflow
// ============================================================================

import { prisma } from '@/lib/prisma';
import { WorkflowEngine } from './WorkflowEngine';
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
} from '@/types/gis';

// ============================================================================
// Types
// ============================================================================

export interface GISUploadSession {
  id: string;
  projectId?: string;
  projectName?: string;
  region?: string;
  district?: string;
  createdById: string;
  files: UploadFileEntry[];
  status: 'UPLOADED' | 'PARSING' | 'PARSED' | 'VALIDATING' | 'VALIDATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
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
      projectName: request.projectName,
      region: request.region,
      district: request.district,
      createdById: request.createdById,
      files,
      status: 'UPLOADED',
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
          const parsed = gisParser.autoParseLayer(file.fileName, rawContent);
          const layerType = parsed.layerType;

          // Store parsed data by type
          switch (layerType) {
            case 'CABLE':
              parsedLayers.cable = parsed.parsedData as ParsedCableData;
              break;
            case 'POLE':
              parsedLayers.pole = parsed.parsedData as ParsedPoleData;
              break;
            case 'FDP':
              parsedLayers.fdp = parsed.parsedData as ParsedFDPData;
              break;
            case 'FIBER_JOINT':
              parsedLayers.fiberJoint = parsed.parsedData as ParsedFiberJointData;
              break;
            case 'ROAD_EOP':
              parsedLayers.road = parsed.parsedData as ParsedRoadData;
              break;
          }

          const featureCount =
            (parsed.parsedData as any)?.featureCount ||
            (parsed.parsedData as any)?.segments?.length ||
            0;

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
        } catch (err: any) {
          layerResults.push({
            layerName: file.fileName,
            layerType: 'UNKNOWN',
            featureCount: 0,
            status: 'FAILED',
            errors: [err.message || 'Parse failed'],
            warnings: [],
          });

          auditLog.push({
            timestamp: new Date().toISOString(),
            action: 'LAYER_PARSE_FAILED',
            entity: 'UNKNOWN',
            entityId: file.fileName,
            details: `Failed to parse ${file.fileName}: ${err.message}`,
          });
        }
      }

      session.status = 'PARSED';
      session.updatedAt = new Date();

      // ====================================================================
      // PHASE 2: Validate all parsed layers
      // ====================================================================
      session.status = 'VALIDATING';
      session.updatedAt = new Date();

      const layersMap = new Map<GISLayerType, any>();
      if (parsedLayers.cable) layersMap.set('CABLE', parsedLayers.cable);
      if (parsedLayers.pole) layersMap.set('POLE', parsedLayers.pole);
      if (parsedLayers.fdp) layersMap.set('FDP', parsedLayers.fdp);
      if (parsedLayers.fiberJoint) layersMap.set('FIBER_JOINT', parsedLayers.fiberJoint);
      if (parsedLayers.road) layersMap.set('ROAD_EOP', parsedLayers.road);

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
      // PHASE 4: Generate BOQ
      // ====================================================================
      const boq = boqEngine.generateBOQ(
        layersMap,
        session.region,
        1.0
      );

      auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'BOQ_GENERATED',
        entity: 'GISGeneratedBOQ',
        entityId: importId,
        details: `BOQ generated: ${boq.items.length} items, total LKR ${boq.totalEstimatedCost.toLocaleString()}`,
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
    } catch (err: any) {
      session.status = 'FAILED';
      session.updatedAt = new Date();

      auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'IMPORT_FAILED',
        entity: 'GISImport',
        entityId: importId,
        details: `Import failed: ${err.message}`,
      });

      logger.error(`GIS Import ${importId} failed: ${err.message}`, err);

      throw err;
    }
  }

  /**
   * Persist all GIS data to the database
   */
  private static async persistToDatabase(
    session: GISUploadSession,
    parsedLayers: ParsedLayerMap,
    layersMap: Map<GISLayerType, any>,
    projectType: DetectedProjectType,
    confidence: number,
    boq: BOQSummary,
    analytics: GISAnalytics,
    layerResults: GISLayerResult[],
    auditLog: GISAuditEntry[]
  ): Promise<GISImportResult> {
    const projectCode = await this.generateProjectCode(projectType);
    const projectName =
      session.projectName ||
      `${projectType} Project - ${projectCode}`;

    // ======================================================================
    // 1. CREATE PROJECT
    // ======================================================================
    const project = await prisma.project.create({
      data: {
        projectCode,
        name: projectName,
        description: `Auto-created from GIS import. Type: ${projectType} (${confidence}% confidence). ${layerResults.length} layers imported.`,
        type: projectType,
        status: 'PLANNING',
        location: session.region ? `${session.region}${session.district ? ` / ${session.district}` : ''}` : null,
        budget: boq.totalEstimatedCost,
        actualCost: 0,
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

    // ======================================================================
    // 2. CREATE GIS ROUTE
    // ======================================================================
    let gisRouteId: string | null = null;

    if (parsedLayers.cable) {
      const routeName = `GIS Route - ${projectCode}`;
      const route = await prisma.gISRoute.create({
        data: {
          projectId: project.id,
          name: routeName,
          description: `Auto-generated GIS route from ${layerResults.length} imported layers`,
          sourceFormat: 'GEOJSON',
          routeLength: parsedLayers.cable.totalLength,
          status: 'IMPORTED',
        },
      });
      gisRouteId = route.id;

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
            status: 'PLANNED',
          })),
        });
      }

      // ====================================================================
      // 2b. CREATE POLES
      // ====================================================================
      if (parsedLayers.pole) {
        await prisma.gISPole.createMany({
          data: parsedLayers.pole.poles.map((pole) => ({
            routeId: route.id,
            poleNumber: pole.index,
            latitude: pole.latitude,
            longitude: pole.longitude,
            elevation: pole.elevation,
            poleType: pole.poleType || 'CONCRETE',
            height: pole.height || 9,
            status: 'PLANNED',
          })),
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
          data: parsedLayers.fdp.fdps.map((fdp, idx) => ({
            routeId: route.id,
            closureNumber: fdp.index || idx + 1,
            closureType: 'TERMINAL',
            latitude: fdp.latitude,
            longitude: fdp.longitude,
            capacity: fdp.portCount || 8,
            status: 'PLANNED',
            notes: `FDP ${fdp.fdpCode || fdp.index} - ${fdp.portCount || '?'} ports${fdp.splitters ? `, ${fdp.splitters} splitter(s)` : ''}`,
          })),
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
          data: parsedLayers.fiberJoint.joints.map((joint, idx) => ({
            routeId: route.id,
            closureNumber: 100 + (joint.index || idx + 1), // Offset to avoid collision with FDPs
            closureType: joint.jointType || 'DOME',
            latitude: joint.latitude,
            longitude: joint.longitude,
            capacity: joint.capacity || 48,
            status: 'PLANNED',
            notes: `Fiber Joint ${joint.index} - ${joint.jointType || 'DOME'} type, ${joint.capacity || 48}F capacity`,
          })),
        });

        auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'FIBER_JOINTS_CREATED_AS_CLOSURES',
          entity: 'GISClosure',
          entityId: route.id,
          details: `${parsedLayers.fiberJoint.joints.length} fiber joints created as closures`,
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
    const surveyResult = surveyGenerator.generateSurveyTasks(layersMap);
    let surveyTasksCreated = 0;

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

    // ======================================================================
    // 5. CREATE PERMITS
    // ======================================================================
    const permitResult = permitGenerator.generatePermits(
      layersMap,
      session.region
    );
    let permitsCreated = 0;

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

      // Create BOQ items
      await prisma.gISGeneratedBOQItem.createMany({
        data: boq.items.map((item) => ({
          boqId: generatedBOQ.id,
          itemCategory: item.category,
          itemCode: `BOQ-${projectCode}-${item.category.substring(0, 3)}`,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitRate: item.unitRate,
          amount: item.amount,
          sourceType: 'AUTO_CALCULATED',
          sourceReference: `GIS Import ${session.id}`,
        })),
      });

      // Sync BOQ items to ProjectBOQItem for dashboard BOQ tab visibility
      // Track category counters to ensure unique item codes
      const categoryCounters: Record<string, number> = {};
      await prisma.projectBOQItem.createMany({
        data: boq.items.map((item) => {
          const catKey = item.category.substring(0, 3);
          categoryCounters[catKey] = (categoryCounters[catKey] || 0) + 1;
          const seq = String(categoryCounters[catKey]).padStart(2, '0');
          // Round amount to 2 decimal places to avoid floating point drift
          const roundedAmount = Math.round(item.amount * 100) / 100;
          return {
            projectId: project.id,
            category: item.category,
            itemCode: `BOQ-${projectCode}-${catKey}-${seq}`,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitRate: Math.round(item.unitRate * 100) / 100,
            amount: roundedAmount,
          };
        }),
      });

      auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'BOQ_PERSISTED',
        entity: 'GISGeneratedBOQ',
        entityId: generatedBOQ.id,
        details: `BOQ persisted with ${boq.items.length} items, total LKR ${boq.totalEstimatedCost.toLocaleString()} (synced to ProjectBOQItem)`,
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

    // ======================================================================
    // 7. INSTANTIATE WORKFLOW
    // ======================================================================
    let workflowInstantiated = false;
    let stagesCreated = 0;
    let tasksCreated = 0;

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

        // Only create stage templates if template is fresh (no stages yet)
        const existingStages = await prisma.workflowStageTemplate.count({
          where: { workflowTemplateId: template.id },
        });

        if (existingStages === 0) {
          // Create stage templates
          for (const stageDef of workflowDef.stages) {
            const stageTemplate = await prisma.workflowStageTemplate.create({
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
            });

            // Create task templates for each stage
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
    } catch (wfErr: any) {
      logger.warn(`Workflow instantiation failed for project ${projectCode}: ${wfErr.message}`);
      auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'WORKFLOW_INSTANTIATION_FAILED',
        entity: 'ProjectWorkflowInstance',
        entityId: project.id,
        details: `Workflow instantiation failed: ${wfErr.message}`,
      });
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
