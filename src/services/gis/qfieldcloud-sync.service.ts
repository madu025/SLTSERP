import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { SURVEY_LAYERS } from '@/config/survey-layers';

interface QFieldProject {
  id: string;
  name: string;
  description?: string;
  qgisProjectFile?: string;
}

interface QFieldDeltaFeature {
  uuid?: string;
  sourceLayerId?: string;
  localLayerId?: string;
  geometry?: string | null;
  method?: string;
  new?: {
    attributes?: Record<string, unknown>;
  };
}

interface QFieldDelta {
  id: string;
  last_status?: string;
  status?: string;
  updated_at?: string;
  created_at?: string;
  content?: QFieldDeltaFeature;
}

interface SyncResult {
  projectId: string;
  syncedPoints: number;
  newPoints: number;
  updatedPoints: number;
  errors: string[];
}

/**
 * QFieldCloud Sync Service
 * Handles data exchange between SLTSERP and QFieldCloud Delta API
 */
export class QFieldCloudSyncService {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_QFIELD_API_URL || 'http://localhost:8100';
  }

  /**
   * Authenticate with QFieldCloud API
   */
  private async authenticate(forceRefresh = false): Promise<string> {
    if (this.authToken && !forceRefresh) return this.authToken;

    const res = await fetch(`${this.baseUrl}/api/v1/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.QFIELD_ADMIN_USER || 'admin',
        password: process.env.QFIELD_ADMIN_PASS || 'admin',
      }),
    });

    if (!res.ok) throw AppError.badRequest('QFieldCloud authentication failed');

    const data = await res.json();
    this.authToken = data.token || data.access_token;
    return this.authToken!;
  }

  /**
   * Helper to perform fetch requests with automatic auth token injection and retry on 401
   */
  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    let token = await this.authenticate();
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Token ${token}`);
    
    let res = await fetch(url, { ...options, headers });
    
    if (res.status === 401) {
      console.log('QFieldCloud token expired or invalid, re-authenticating...');
      token = await this.authenticate(true);
      headers.set('Authorization', `Token ${token}`);
      res = await fetch(url, { ...options, headers });
    }
    
    return res;
  }

  /**
   * Create a new QFieldCloud project for SLTSERP project
   */
  async createQFieldProject(
    sltProjectId: string,
    qgisTemplatePath: string
  ): Promise<QFieldProject> {
    const sltProject = await prisma.project.findUnique({
      where: { id: sltProjectId },
      select: { name: true, projectCode: true, description: true },
    });

    if (!sltProject) throw AppError.badRequest('SLTSERP project not found');

    const cleanProjectName = `${sltProject.projectCode}_${sltProject.name}`.replace(/[^a-zA-Z0-9_.-]/g, '_');

    let qfieldProject: QFieldProject | null = null;

    // Check if the project already exists in QFieldCloud
    try {
      const listRes = await this.fetchWithAuth(`${this.baseUrl}/api/v1/projects/`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const projects = (Array.isArray(listData) ? listData : (listData.results || [])) as QFieldProject[];
        qfieldProject = projects.find((p) => p.name === cleanProjectName) || null;
        if (qfieldProject) {
          console.log(`ℹ️ Reusing existing QFieldCloud project: ${cleanProjectName} (ID: ${qfieldProject.id})`);
        }
      }
    } catch (listErr) {
      console.warn('Failed to query existing projects from QFieldCloud:', listErr);
    }

    if (!qfieldProject) {
      const res = await this.fetchWithAuth(`${this.baseUrl}/api/v1/projects/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: cleanProjectName,
          description: sltProject.description || 'OSP Fiber Optic Survey Project',
          is_public: false,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw AppError.badRequest(`Failed to create QField project: ${err}`);
      }

      qfieldProject = await res.json();
    }
    
    if (!qfieldProject) {
      throw AppError.badRequest('Failed to retrieve or create QFieldCloud project');
    }

    // Upload QGIS project template file if path exists
    let tempDir: string | null = null;
    try {
      const fs = await import('fs');
      const path = await import('path');
      const resolvedPath = path.resolve(qgisTemplatePath);

      if (fs.existsSync(resolvedPath)) {
        let uploadFilePath = resolvedPath;

        // Retrieve field configurations for project from the DB
        const configs = await prisma.qFieldFieldConfig.findMany({
          where: { projectId: sltProjectId },
        });

        if (configs.length > 0) {
          try {
            const { spawnSync } = await import('child_process');
            tempDir = path.join(process.cwd(), 'tmp', `qfield-${sltProjectId}-${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });

            const tempQgzPath = path.join(tempDir, 'QGIS.qgz');
            const tempConfigJsonPath = path.join(tempDir, 'config.json');

            // Copy template
            fs.copyFileSync(resolvedPath, tempQgzPath);

            // Write JSON config
            const configData: Record<string, Record<string, string[]>> = {};
            for (const c of configs) {
              if (!configData[c.layerId]) {
                configData[c.layerId] = {};
              }
              configData[c.layerId][c.fieldName] = c.options;
            }
            fs.writeFileSync(tempConfigJsonPath, JSON.stringify(configData, null, 2), 'utf-8');

            // Run script securely
            const pythonCmd = process.platform === 'win32' ? 'py' : 'python3';
            console.log(`Running dynamic widget patcher on template securely...`);
            const patchResult = spawnSync(pythonCmd, [
              'scripts/patch-qgis-dynamic.py',
              tempQgzPath,
              tempConfigJsonPath,
            ], {
              cwd: process.cwd(),
              encoding: 'utf-8',
            });
            if (patchResult.status !== 0) {
              throw AppError.badRequest(`Dynamic patcher exited with code ${patchResult.status}: ${patchResult.stderr || patchResult.stdout}`);
            }

            uploadFilePath = tempQgzPath;
            console.log('✅ Template patched with custom widget ValueMap configurations.');
          } catch (patchErr) {
            console.error('Error patching QGIS template:', patchErr);
            // Fallback to original template in case of failure
            uploadFilePath = resolvedPath;
          }
        }

        const fileBuffer = fs.readFileSync(uploadFilePath);
        const fileBlob = new Blob([fileBuffer], { type: 'application/octet-stream' });
        const formData = new FormData();
        formData.append('file', fileBlob, 'QGIS.qgz');

        const uploadRes = await this.fetchWithAuth(`${this.baseUrl}/api/v1/files/${qfieldProject.id}/QGIS.qgz/`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          console.error(`Failed to upload QGIS template file: ${uploadRes.status} - ${await uploadRes.text()}`);
        } else {
          console.log('✅ QGIS project template file uploaded successfully to QFieldCloud.');
        }

        const uploadPromises: Promise<void>[] = [];

        // Upload companion GeoPackage files from template root directory
        const templateDir = path.dirname(resolvedPath);
        if (fs.existsSync(templateDir)) {
          const files = fs.readdirSync(templateDir);
          for (const file of files) {
            if (file.endsWith('.gpkg')) {
              const gpkgPath = path.join(templateDir, file);
              const gpkgBuffer = fs.readFileSync(gpkgPath);
              const gpkgBlob = new Blob([gpkgBuffer], { type: 'application/octet-stream' });
              const gpkgFormData = new FormData();
              gpkgFormData.append('file', gpkgBlob, file);

              const uploadPromise = this.fetchWithAuth(`${this.baseUrl}/api/v1/files/${qfieldProject.id}/${file}/`, {
                method: 'POST',
                body: gpkgFormData,
              }).then(async (res) => {
                if (!res.ok) {
                  console.error(`Failed to upload GeoPackage file ${file}: ${res.status} - ${await res.text()}`);
                }
              });
              uploadPromises.push(uploadPromise);
            }
          }
        }



        await Promise.all(uploadPromises);
        console.log('✅ All companion template layers uploaded successfully in parallel to QFieldCloud.');
      } else {
        console.warn(`QGIS Template file not found at: ${resolvedPath}`);
      }
    } catch (err) {
      console.error('Error uploading QGIS template during project creation:', err);
    } finally {
      if (tempDir) {
        try {
          const fs = await import('fs');
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log('✅ Temporary QGIS patching directory cleaned up.');
          }
        } catch (cleanupErr) {
          console.error('Failed to cleanup temporary patching directory:', cleanupErr);
        }
      }
    }

    return qfieldProject;
  }

  /**
   * Delete a project from QFieldCloud
   */
  async deleteQFieldProject(qfieldProjectId: string): Promise<void> {
    const token = await this.authenticate();
    const res = await fetch(`${this.baseUrl}/api/v1/projects/${qfieldProjectId}/`, {
      method: 'DELETE',
      headers: {
        Authorization: `Token ${token}`,
      },
    });

    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      console.error(`Failed to delete QField project ${qfieldProjectId} from QFieldCloud: ${err}`);
      throw AppError.badRequest(`Failed to delete QFieldCloud project: ${err}`);
    }
  }

  /**
   * Push survey layers to QFieldCloud project
   */
  async pushSurveyLayers(qfieldProjectId: string): Promise<void> {
    const token = await this.authenticate();

    const geoJsonLayers = SURVEY_LAYERS.map((layer) => ({
      name: layer.id,
      visible: true,
      geojson: {
        type: 'FeatureCollection',
        features: [], // Empty template - points added via survey
        metadata: {
          layerId: layer.id,
          label: layer.label,
          icon: layer.icon,
          color: layer.color,
          requiredAttributes: layer.requiredAttributes,
          optionalAttributes: layer.optionalAttributes,
        },
      },
    }));

    for (const layer of geoJsonLayers) {
      await fetch(`${this.baseUrl}/api/v1/projects/${qfieldProjectId}/layers/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(layer),
      });
    }
  }

  /**
   * Helper to parse WKT geometries into coordinates and GeoJSON geometry objects
   */
  private parseWktGeometry(wkt: string | null): { lon: number; lat: number; geometry: Record<string, unknown> } | null {
    if (!wkt) return null;

    // Point: POINT (80.123 7.456)
    const pointMatch = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(wkt);
    if (pointMatch) {
      const lon = parseFloat(pointMatch[1]);
      const lat = parseFloat(pointMatch[2]);
      return { lon, lat, geometry: { type: 'Point', coordinates: [lon, lat] } };
    }

    // LineString: LINESTRING (80.1 7.1, 80.2 7.2, ...)
    const lineMatch = /LINESTRING\s*\(([^)]+)\)/i.exec(wkt);
    if (lineMatch) {
      const coordPairs = lineMatch[1].split(',').map((s) => s.trim());
      const coordinates = coordPairs.map((pair) => {
        const parts = pair.split(/\s+/);
        return [parseFloat(parts[0]), parseFloat(parts[1])];
      });
      // Fallback: use first coordinate for representative latitude/longitude
      const [lon, lat] = coordinates[0];
      return { lon, lat, geometry: { type: 'LineString', coordinates } };
    }

    // MultiLineString: MULTILINESTRING (((80.1 7.1, ...)))
    const multiLineMatch = /MULTILINESTRING\s*\(([^)]+)\)/i.exec(wkt);
    if (multiLineMatch) {
      const firstCoordsMatch = /([-\d.]+)\s+([-\d.]+)/.exec(multiLineMatch[1]);
      if (firstCoordsMatch) {
        const lon = parseFloat(firstCoordsMatch[1]);
        const lat = parseFloat(firstCoordsMatch[2]);
        return { lon, lat, geometry: { type: 'MultiLineString', wkt } };
      }
    }

    // Fallback for other geometries: extract the first pair of numbers
    const fallbackMatch = /([-\d.]+)\s+([-\d.]+)/.exec(wkt);
    if (fallbackMatch) {
      const lon = parseFloat(fallbackMatch[1]);
      const lat = parseFloat(fallbackMatch[2]);
      return { lon, lat, geometry: { type: 'Unknown', wkt } };
    }

    return null;
  }

  /**
   * Pull synced survey points from QFieldCloud (Delta API)
   */
  async pullSurveyPoints(sltProjectId: string, qfieldProjectId: string): Promise<SyncResult> {
    const errors: string[] = [];
    let syncedPoints = 0;
    let newPoints = 0;
    let updatedPoints = 0;

    try {
      // Get features modified since last sync
      const lastSync = await prisma.qFieldCloudSyncLog.findFirst({
        where: { projectId: sltProjectId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      });

      const deltaParams = new URLSearchParams();
      const res = await this.fetchWithAuth(
        `${this.baseUrl}/api/v1/deltas/${qfieldProjectId}/?${deltaParams}`
      );

      if (!res.ok) {
        errors.push(`Deltas API returned ${res.status} - ${await res.text()}`);
        return { projectId: sltProjectId, syncedPoints, newPoints, updatedPoints, errors };
      }

      const resData = await res.json();
      let deltas: QFieldDelta[] = [];
      if (Array.isArray(resData)) {
        deltas = resData as QFieldDelta[];
      } else if (resData && typeof resData === 'object' && Array.isArray((resData as Record<string, unknown>).results)) {
        deltas = (resData as Record<string, unknown>).results as QFieldDelta[];
      }

      // Filter in-memory by modified_since and status applied
      let filteredDeltas = deltas.filter(
        (d) => d.last_status === 'applied' || d.status === 'STATUS_APPLIED'
      );

      if (lastSync && lastSync.completedAt) {
        const lastSyncTime = lastSync.completedAt.getTime();
        filteredDeltas = filteredDeltas.filter(
          (d) => {
            const targetTime = d.updated_at || d.created_at;
            return targetTime ? new Date(targetTime).getTime() > lastSyncTime : false;
          }
        );
      }

      if (filteredDeltas.length === 0) {
        console.log('No new applied deltas found to synchronize.');
        return { projectId: sltProjectId, syncedPoints, newPoints, updatedPoints, errors };
      }

      // Find or auto-create active session to avoid foreign key errors
      let activeSession = await prisma.mobileSurveySession.findFirst({
        where: { projectId: sltProjectId, status: 'IN_PROGRESS' },
        orderBy: { startedAt: 'desc' },
      });

      if (!activeSession) {
        activeSession = await prisma.mobileSurveySession.create({
          data: {
            projectId: sltProjectId,
            supervisorId: 'SYSTEM_SYNC',
            status: 'COMPLETED',
            notes: 'Auto-created during QFieldCloud Delta Sync',
            syncStatus: 'SYNCED',
          },
        });
      }

      // Process deltas within a Prisma transaction
      await prisma.$transaction(async (tx) => {
        // Fetch all existing points for this project to build an in-memory lookup map
        const existingPoints = await tx.surveyPoint.findMany({
          where: { projectId: sltProjectId },
        });

        const existingPointsMap = new Map<string, typeof existingPoints[0]>();
        for (const p of existingPoints) {
          const attrs = p.attributes as { qfield_uuid?: string } | null;
          const uuid = attrs?.qfield_uuid;
          if (uuid) {
            existingPointsMap.set(uuid, p);
          }
        }

        for (const delta of filteredDeltas) {
          const feature = delta.content;
          if (!feature) continue;

          const qfieldUuid = feature.uuid;
          if (!qfieldUuid) {
            errors.push(`Delta ${delta.id} missing feature uuid.`);
            continue;
          }

          // Match layer configuration with smart fallback for template QGIS layers
          const layerId = feature.sourceLayerId || feature.localLayerId;
          if (!layerId) {
            errors.push(`Delta ${delta.id} missing layer ID.`);
            continue;
          }

          let layerConfig = SURVEY_LAYERS.find((l) => layerId.startsWith(l.id));
          if (!layerConfig) {
            const normalized = layerId.toLowerCase();
            const deltaAttrs = feature.new?.attributes || {};
            if (normalized.includes('pole')) {
              const isNew = String(deltaAttrs.exist_new || deltaAttrs.Exist_New || '').toLowerCase() === 'new';
              layerConfig = SURVEY_LAYERS.find(l => l.id === (isNew ? 'survey_new_pole' : 'survey_existing_pole'));
            } else if (normalized.includes('cable')) {
              layerConfig = SURVEY_LAYERS.find(l => l.id === 'survey_cable_mid');
            } else if (normalized.includes('fj') || normalized.includes('closure') || normalized.includes('joint')) {
              layerConfig = SURVEY_LAYERS.find(l => l.id === 'survey_joint_closure');
            } else if (normalized.includes('fdp')) {
              layerConfig = SURVEY_LAYERS.find(l => l.id === 'survey_fdp');
            } else if (normalized.includes('chamber') || normalized.includes('mh') || normalized.includes('hh') || normalized.includes('manhole') || normalized.includes('handhole')) {
              layerConfig = SURVEY_LAYERS.find(l => l.id === 'survey_chamber');
            } else if (normalized.includes('odf') || normalized.includes('ftc') || normalized.includes('enclosure')) {
              layerConfig = SURVEY_LAYERS.find(l => l.id === 'survey_enclosure');
            } else if (normalized.includes('road') || normalized.includes('crossing') || normalized.includes('eop')) {
              layerConfig = SURVEY_LAYERS.find(l => l.id === 'survey_road_crossing');
            } else if (normalized.includes('obstruction')) {
              layerConfig = SURVEY_LAYERS.find(l => l.id === 'survey_obstruction');
            } else if (normalized.includes('tp') || normalized.includes('termination') || normalized.includes('access')) {
              layerConfig = SURVEY_LAYERS.find(l => l.id === 'survey_access_point');
            }
          }

          if (!layerConfig) {
            errors.push(`Unknown QGIS layer: ${layerId}`);
            continue;
          }

          const existing = existingPointsMap.get(qfieldUuid);

          // Handle DELETE method
          if (feature.method === 'delete') {
            if (existing) {
              await tx.surveyPoint.delete({
                where: { id: existing.id },
              });
              existingPointsMap.delete(qfieldUuid);
              syncedPoints++;
            }
            continue;
          }

          // Parse geometry WKT
          const geomData = this.parseWktGeometry(feature.geometry || ((feature.new as Record<string, unknown> | undefined)?.geometry as string | null) || null);
          if (!geomData && feature.method === 'create') {
            errors.push(`Feature ${qfieldUuid} missing valid geometry.`);
            continue;
          }

          const lat = geomData ? geomData.lat : (existing?.latitude || 0);
          const lon = geomData ? geomData.lon : (existing?.longitude || 0);

          // Parse attributes
          const deltaAttrs = feature.new?.attributes || {};
          const attributes: Record<string, unknown> = {};

          // Copy all attributes from QField delta to prevent data loss
          for (const key of Object.keys(deltaAttrs)) {
            attributes[key] = deltaAttrs[key];
          }

          // Merge with existing properties
          if (existing) {
            const oldAttrs = existing.attributes as Record<string, unknown> | null;
            if (oldAttrs) {
              for (const key of Object.keys(oldAttrs)) {
                if (!(key in attributes)) {
                  attributes[key] = oldAttrs[key];
                }
              }
            }
          }

          // Parse photo URLs from attributes
          const photoUrls: string[] = [];
          for (const val of Object.values(attributes)) {
            if (
              typeof val === 'string' &&
              (val.toLowerCase().endsWith('.jpg') ||
                val.toLowerCase().endsWith('.png') ||
                val.toLowerCase().endsWith('.jpeg'))
            ) {
              const cleanPath = val.replace(/^\.\//, '');
              photoUrls.push(`${this.baseUrl}/api/v1/files/${qfieldProjectId}/${cleanPath}/`);
            }
          }

          if (existing) {
            // Handle UPDATE / PATCH method
            const updated = await tx.surveyPoint.update({
              where: { id: existing.id },
              data: {
                latitude: lat,
                longitude: lon,
                attributes: {
                  ...(existing.attributes as object),
                  ...attributes,
                  geometry: geomData ? geomData.geometry : undefined,
                },
                photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
              },
            });
            existingPointsMap.set(qfieldUuid, updated);
            updatedPoints++;
            syncedPoints++;
          } else {
            // Handle CREATE method
            const created = await tx.surveyPoint.create({
              data: {
                sessionId: activeSession.id,
                projectId: sltProjectId,
                layerId: layerConfig.id,
                layerName: layerConfig.label,
                latitude: lat,
                longitude: lon,
                attributes: {
                  ...attributes,
                  qfield_uuid: qfieldUuid,
                  sync_source: 'QFIELD_CLOUD',
                  geometry: geomData ? geomData.geometry : undefined,
                },
                photoUrls,
                supervisorId: activeSession.supervisorId || undefined,
              },
            });
            existingPointsMap.set(qfieldUuid, created);
            newPoints++;
            syncedPoints++;
          }
        }
      });

      // Update session points count
      if (activeSession) {
        const totalPoints = await prisma.surveyPoint.count({
          where: { sessionId: activeSession.id },
        });
        await prisma.mobileSurveySession.update({
          where: { id: activeSession.id },
          data: { pointsCount: totalPoints },
        });
      }

      // Log sync completed
      await prisma.qFieldCloudSyncLog.create({
        data: {
          projectId: sltProjectId,
          syncType: 'DELTA_SYNC',
          status: errors.length > 0 ? 'FAILED' : 'COMPLETED',
          featuresCount: filteredDeltas.length,
          errorMessage: errors.length > 0 ? errors.join('; ') : null,
          startedAt: lastSync?.completedAt || new Date(),
          completedAt: new Date(),
        },
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    }

    return { projectId: sltProjectId, syncedPoints, newPoints, updatedPoints, errors };
  }

  /**
   * Full sync: push project config + pull survey data
   */
  static async fullSync(sltProjectId: string, qfieldProjectId: string): Promise<SyncResult> {
    const service = new QFieldCloudSyncService();

    // Log sync start
    const syncLog = await prisma.qFieldCloudSyncLog.create({
      data: {
        projectId: sltProjectId,
        syncType: 'FULL_SYNC',
        status: 'STARTED',
        startedAt: new Date(),
      },
    });

    try {
      const result = await service.pullSurveyPoints(sltProjectId, qfieldProjectId);

      // Update log
      await prisma.qFieldCloudSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: result.errors.length === 0 ? 'COMPLETED' : 'FAILED',
          featuresCount: result.syncedPoints,
          errorMessage: result.errors.join('; ') || null,
          completedAt: new Date(),
        },
      });

      return result;
    } catch (error) {
      // Update log as failed
      await prisma.qFieldCloudSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Full sync failed',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  /**
   * Get sync history for a project
   */
  static async getSyncHistory(projectId: string) {
    return prisma.qFieldCloudSyncLog.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Get synchronization status and aggregated survey point metrics
   */
  static async getSyncStatus(projectId: string) {
    const [syncHistory, lastSync, surveyStats] = await Promise.all([
      this.getSyncHistory(projectId),
      prisma.qFieldCloudSyncLog.findFirst({
        where: { projectId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true, featuresCount: true, syncType: true },
      }),
      prisma.surveyPoint.groupBy({
        by: ['layerId', 'verificationStatus'],
        where: { projectId },
        _count: { id: true },
      }),
    ]);

    // Aggregate survey stats by layer
    const layerStats = SURVEY_LAYERS.map((layer) => {
      const layerPoints = surveyStats.filter((s) => s.layerId === layer.id);
      const total = layerPoints.reduce((sum, s) => sum + s._count.id, 0);
      const pending = layerPoints
        .filter((s) => s.verificationStatus === 'PENDING_VERIFICATION')
        .reduce((sum, s) => sum + s._count.id, 0);
      const verified = layerPoints
        .filter((s) => s.verificationStatus === 'VERIFIED')
        .reduce((sum, s) => sum + s._count.id, 0);
      const approved = layerPoints
        .filter((s) => s.verificationStatus === 'APPROVED')
        .reduce((sum, s) => sum + s._count.id, 0);

      return {
        layerId: layer.id,
        label: layer.label,
        icon: layer.icon,
        color: layer.color,
        total,
        pending,
        verified,
        approved,
      };
    });

    const totalPending = layerStats.reduce((sum, l) => sum + l.pending, 0);
    const totalApproved = layerStats.reduce((sum, l) => sum + l.approved, 0);
    const totalPoints = layerStats.reduce((sum, l) => sum + l.total, 0);

    // Get active sessions
    const activeSessions = await prisma.mobileSurveySession.findMany({
      where: { projectId, status: 'IN_PROGRESS' },
      select: {
        id: true,
        supervisorId: true,
        startedAt: true,
        pointsCount: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    return {
      projectId,
      surveyLayers: layerStats,
      summary: {
        totalPoints,
        totalPending,
        totalApproved,
        activeSessions: activeSessions.length,
        lastSync: lastSync?.completedAt || null,
        lastSyncFeatures: lastSync?.featuresCount || 0,
      },
      activeSessions,
      syncHistory,
    };
  }

  /**
   * Create a QField project and register it in the project database metadata
   */
  static async createQFieldProjectForProject(projectId: string, template?: string) {
    const service = new QFieldCloudSyncService();
    const templateFile = template || 'QGIS Project Template/QGIS.qgz';
    const qfieldProject = await service.createQFieldProject(projectId, templateFile);

    // Push layers after project creation
    await service.pushSurveyLayers(qfieldProject.id);

    // Store QFieldCloud project reference — merge with existing gisMapping to preserve material mappings
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { gisMapping: true },
    });
    const existingGisMapping = (existingProject?.gisMapping as Record<string, unknown> | null) || {};
    await prisma.project.update({
      where: { id: projectId },
      data: {
        gisMapping: { ...existingGisMapping, qfieldProjectId: qfieldProject.id },
      },
    });

    return {
      message: 'QFieldCloud project created with 12 survey layers',
      qfieldProject,
      layersCount: SURVEY_LAYERS.length,
    };
  }
}