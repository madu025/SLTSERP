import { prisma } from '@/lib/prisma';
import { SURVEY_LAYERS } from '@/config/survey-layers';

interface QFieldProject {
  id: string;
  name: string;
  description?: string;
  qgisProjectFile?: string;
}

interface QFieldFeature {
  type: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: Record<string, unknown>;
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
  private async authenticate(): Promise<string> {
    if (this.authToken) return this.authToken;

    const res = await fetch(`${this.baseUrl}/api/v1/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.QFIELD_ADMIN_USER || 'admin',
        password: process.env.QFIELD_ADMIN_PASS || 'admin',
      }),
    });

    if (!res.ok) throw new Error('QFieldCloud authentication failed');

    const data = await res.json();
    this.authToken = data.token || data.access_token;
    return this.authToken!;
  }

  /**
   * Create a new QFieldCloud project for SLTSERP project
   */
  async createQFieldProject(
    sltProjectId: string,
    qgisTemplatePath: string
  ): Promise<QFieldProject> {
    const token = await this.authenticate();
    const sltProject = await prisma.project.findUnique({
      where: { id: sltProjectId },
      select: { name: true, projectCode: true, description: true },
    });

    if (!sltProject) throw new Error('SLTSERP project not found');

    const cleanProjectName = `${sltProject.projectCode}_${sltProject.name}`.replace(/[^a-zA-Z0-9_.-]/g, '_');

    const res = await fetch(`${this.baseUrl}/api/v1/projects/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
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
      throw new Error(`Failed to create QField project: ${err}`);
    }

    const qfieldProject = await res.json();

    // Upload QGIS project template file if path exists
    try {
      const fs = await import('fs');
      const path = await import('path');
      const resolvedPath = path.resolve(qgisTemplatePath);

      if (fs.existsSync(resolvedPath)) {
        const fileBuffer = fs.readFileSync(resolvedPath);
        const fileBlob = new Blob([fileBuffer], { type: 'application/octet-stream' });
        const formData = new FormData();
        formData.append('file', fileBlob, 'QGIS.qgz');

        const uploadRes = await fetch(`${this.baseUrl}/api/v1/files/${qfieldProject.id}/QGIS.qgz/`, {
          method: 'POST',
          headers: {
            Authorization: `Token ${token}`,
          },
          body: formData,
        });

        if (!uploadRes.ok) {
          console.error(`Failed to upload QGIS template file: ${uploadRes.status} - ${await uploadRes.text()}`);
        } else {
          console.log('✅ QGIS project template file uploaded successfully to QFieldCloud.');
        }

        // Upload companion GeoJSON files from QGIS Project Template/GeoJSON/
        const templateDir = path.dirname(resolvedPath);
        const geoJsonDir = path.join(templateDir, 'GeoJSON');
        if (fs.existsSync(geoJsonDir)) {
          const files = fs.readdirSync(geoJsonDir);
          for (const file of files) {
            if (file.endsWith('.geojson')) {
              const geoJsonPath = path.join(geoJsonDir, file);
              const geoJsonBuffer = fs.readFileSync(geoJsonPath);
              const geoJsonBlob = new Blob([geoJsonBuffer], { type: 'application/json' });
              const geoJsonFormData = new FormData();
              geoJsonFormData.append('file', geoJsonBlob, file);

              const geoJsonUploadRes = await fetch(`${this.baseUrl}/api/v1/files/${qfieldProject.id}/GeoJSON/${file}/`, {
                method: 'POST',
                headers: {
                  Authorization: `Token ${token}`,
                },
                body: geoJsonFormData,
              });

              if (!geoJsonUploadRes.ok) {
                console.error(`Failed to upload GeoJSON file ${file}: ${geoJsonUploadRes.status}`);
              }
            }
          }
          console.log('✅ All GeoJSON template layers uploaded successfully to QFieldCloud.');
        }
      } else {
        console.warn(`QGIS Template file not found at: ${resolvedPath}`);
      }
    } catch (err) {
      console.error('Error uploading QGIS template during project creation:', err);
    }

    return qfieldProject;
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
   * Pull synced survey points from QFieldCloud (Delta API)
   */
  async pullSurveyPoints(sltProjectId: string, qfieldProjectId: string): Promise<SyncResult> {
    const token = await this.authenticate();
    const errors: string[] = [];
    let syncedPoints = 0;
    let newPoints = 0;
    let updatedPoints = 0;

    try {
      // Delta API: get features modified since last sync
      const lastSync = await prisma.qFieldCloudSyncLog.findFirst({
        where: { projectId: sltProjectId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      });

      const deltaParams = new URLSearchParams();
      if (lastSync) {
        deltaParams.set('modified_since', lastSync.completedAt!.toISOString());
      }

      const res = await fetch(
        `${this.baseUrl}/api/v1/projects/${qfieldProjectId}/features/?${deltaParams}`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );

      if (!res.ok) {
        errors.push(`Delta API returned ${res.status}`);
        return { projectId: sltProjectId, syncedPoints, newPoints, updatedPoints, errors };
      }

      const features: QFieldFeature[] = await res.json();

      // Find active in-progress session for this project
      const activeSession = await prisma.mobileSurveySession.findFirst({
        where: { projectId: sltProjectId, status: 'IN_PROGRESS' },
        orderBy: { startedAt: 'desc' },
      });

      for (const feature of features) {
        const [lon, lat] = feature.geometry.coordinates;
        const layerId = feature.properties.layerId as string;
        const layerConfig = SURVEY_LAYERS.find((l) => l.id === layerId);

        if (!layerConfig) {
          errors.push(`Unknown layer: ${layerId}`);
          continue;
        }

        // Extract only defined attributes (ignore QFieldCloud metadata)
        const allKeys = [...layerConfig.requiredAttributes, ...layerConfig.optionalAttributes];
        const attributes: Record<string, unknown> = {};
        for (const key of allKeys) {
          if (key in feature.properties) {
            attributes[key] = feature.properties[key];
          }
        }

        // Check if point already exists (QFieldCloud UUID as pointReference)
        const qfieldUuid = feature.properties.uuid || feature.properties.qfieldcloud_uuid;

        if (qfieldUuid) {
          const existing = await prisma.surveyPoint.findFirst({
            where: {
              projectId: sltProjectId,
              attributes: { equals: { qfield_uuid: qfieldUuid } },
            },
          });

          if (existing) {
            await prisma.surveyPoint.update({
              where: { id: existing.id },
              data: {
                latitude: lat,
                longitude: lon,
                attributes: { ...(existing.attributes as object), ...attributes },
                photoUrls: feature.properties.photo_urls
                  ? (feature.properties.photo_urls as string[])
                  : undefined,
              },
            });
            updatedPoints++;
            syncedPoints++;
            continue;
          }
        }

        // Create new survey point
        await prisma.surveyPoint.create({
          data: {
            sessionId: activeSession?.id || 'SYNC_DIRECT',
            projectId: sltProjectId,
            layerId: layerId,
            layerName: layerConfig.label,
            latitude: lat,
            longitude: lon,
            attributes: {
              ...attributes,
              qfield_uuid: qfieldUuid,
              sync_source: 'QFIELD_CLOUD',
            },
            photoUrls: feature.properties.photo_urls
              ? (feature.properties.photo_urls as string[])
              : [],
            supervisorId: activeSession?.supervisorId,
          },
        });

        newPoints++;
        syncedPoints++;
      }

      // Log sync
      await prisma.qFieldCloudSyncLog.create({
        data: {
          projectId: sltProjectId,
          syncType: 'DELTA_SYNC',
          status: errors.length > 0 ? 'COMPLETED' : 'COMPLETED',
          featuresCount: features.length,
          errorMessage: errors.length > 0 ? errors.join('; ') : null,
          startedAt: lastSync?.completedAt || new Date(),
          completedAt: new Date(),
        },
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
    await prisma.qFieldCloudSyncLog.create({
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
      await prisma.qFieldCloudSyncLog.updateMany({
        where: { projectId: sltProjectId, status: 'STARTED', syncType: 'FULL_SYNC' },
        data: {
          status: result.errors.length === 0 ? 'COMPLETED' : 'COMPLETED',
          featuresCount: result.syncedPoints,
          errorMessage: result.errors.join('; ') || null,
          completedAt: new Date(),
        },
      });

      return result;
    } catch (error) {
      // Update log as failed
      await prisma.qFieldCloudSyncLog.updateMany({
        where: { projectId: sltProjectId, status: 'STARTED', syncType: 'FULL_SYNC' },
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
}