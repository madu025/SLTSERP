import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { SURVEY_LAYERS } from '@/config/survey-layers';

interface AsBuiltExport {
  projectName: string;
  projectCode: string;
  generatedAt: string;
  summary: {
    totalPoints: number;
    routeLengthMeters: number;
    poles: { existing: number; new: number };
    closures: number;
    chambers: number;
    fdpCount: number;
    cableSections: number;
  };
  geoJsonLayers: Record<string, GeoJSON.FeatureCollection>;
}

/**
 * As-Built Output Service
 * Generates QGIS/CAD compatible outputs from completed project survey data
 */
export class AsBuiltService {
  /**
   * Generate complete as-built GeoJSON for all survey layers
   */
  static async generateQGIS(projectId: string): Promise<AsBuiltExport> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, projectCode: true, routeLength: true },
    });

    if (!project) throw AppError.badRequest('Project not found');

    // Get ALL survey points (not just approved — as-built uses actual field data)
    const allPoints = await prisma.surveyPoint.findMany({
      where: { projectId },
      orderBy: [{ layerId: 'asc' }, { createdAt: 'asc' }],
    });

    const puntosByLayer: Record<string, typeof allPoints> = {};
    for (const pt of allPoints) {
      if (!puntosByLayer[pt.layerId]) puntosByLayer[pt.layerId] = [];
      puntosByLayer[pt.layerId].push(pt);
    }

    // Build GeoJSON layers
    const geoJsonLayers: Record<string, GeoJSON.FeatureCollection> = {};

    for (const layer of SURVEY_LAYERS) {
      const points = puntosByLayer[layer.id] || [];

      geoJsonLayers[layer.id] = {
        type: 'FeatureCollection',
        features: points.map((pt) => ({
          type: 'Feature',
          id: pt.id,
          geometry: {
            type: 'Point',
            coordinates: [pt.longitude, pt.latitude],
          },
          properties: {
            ...(pt.attributes as Record<string, unknown>),
            layerId: layer.id,
            layerName: layer.label,
            verifiedStatus: pt.verificationStatus,
            photoUrls: pt.photoUrls,
            createdAt: pt.createdAt,
          },
        })),
      };
    }

    // Calculate cable sections for route length estimation
    const cableStartPoints = puntosByLayer['survey_cable_start'] || [];
    const cableEndPoints = puntosByLayer['survey_cable_end'] || [];

    const sectionCount = Math.min(cableStartPoints.length, cableEndPoints.length);

    const summary = {
      totalPoints: allPoints.length,
      routeLengthMeters: project.routeLength || 0,
      poles: {
        existing: (puntosByLayer['survey_existing_pole'] || []).length,
        new: (puntosByLayer['survey_new_pole'] || []).length,
      },
      closures: (puntosByLayer['survey_joint_closure'] || []).length + (puntosByLayer['survey_enclosure'] || []).length,
      chambers: (puntosByLayer['survey_chamber'] || []).length,
      fdpCount: (puntosByLayer['survey_fdp'] || []).length,
      cableSections: sectionCount,
    };

    return {
      projectName: project.name,
      projectCode: project.projectCode,
      generatedAt: new Date().toISOString(),
      summary,
      geoJsonLayers,
    };
  }

  /**
   * Export a single layer as GeoJSON (for GIS desktop import)
   */
  static async exportLayerGeoJSON(projectId: string, layerId: string): Promise<GeoJSON.FeatureCollection> {
    const layerConfig = SURVEY_LAYERS.find((l) => l.id === layerId);
    if (!layerConfig) throw AppError.badRequest(`Unknown layer: ${layerId}`);

    const points = await prisma.surveyPoint.findMany({
      where: { projectId, layerId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      type: 'FeatureCollection',
      features: points.map((pt) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [pt.longitude, pt.latitude],
        },
        properties: {
          id: pt.id,
          layer: layerConfig.label,
          ...(pt.attributes as Record<string, unknown>),
          status: pt.verificationStatus,
          createdAt: pt.createdAt,
        },
      })),
    };
  }

  /**
   * Export as CAD-compatible format (DXF-like JSON)
   * Each point becomes a block reference with attributes
   */
  static async exportCAD(projectId: string): Promise<Record<string, unknown>> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, projectCode: true },
    });

    if (!project) throw AppError.badRequest('Project not found');

    const allPoints = await prisma.surveyPoint.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    const cadBlocks = allPoints.map((pt, index) => {
      const layer = SURVEY_LAYERS.find((l) => l.id === pt.layerId);
      return {
        blockName: layer?.id || pt.layerId,
        blockNumber: index + 1,
        insertionPoint: { x: pt.longitude, y: pt.latitude, z: 0 },
        layer: layer?.label || pt.layerName,
        color: layer?.color || '#000000',
        attributes: {
          id: pt.id,
          layerId: pt.layerId,
          layerName: pt.layerName,
          ...(pt.attributes as Record<string, unknown>),
          status: pt.verificationStatus,
        },
      };
    });

    return {
      drawingName: `${project.projectCode} - ${project.name}`,
      generatedAt: new Date().toISOString(),
      blockCount: cadBlocks.length,
      blocks: cadBlocks,
      layers: SURVEY_LAYERS.map((l) => ({
        name: l.id,
        label: l.label,
        color: l.color,
        blockCount: cadBlocks.filter((b) => b.blockName === l.id).length,
      })),
    };
  }

  /**
   * Generate as-built comparison: surveyed vs approved vs installed
   */
  static async getAsBuiltComparison(projectId: string) {
    const byStatus = await prisma.surveyPoint.groupBy({
      by: ['verificationStatus'],
      where: { projectId },
      _count: { id: true },
    });

    const surveyVsApproved = {
      PENDING: byStatus.find((s) => s.verificationStatus === 'PENDING_VERIFICATION')?._count.id || 0,
      VERIFIED: byStatus.find((s) => s.verificationStatus === 'VERIFIED')?._count.id || 0,
      APPROVED: byStatus.find((s) => s.verificationStatus === 'APPROVED')?._count.id || 0,
      REJECTED: byStatus.find((s) => s.verificationStatus === 'REJECTED')?._count.id || 0,
      FLAGGED: byStatus.find((s) => s.verificationStatus === 'FLAGGED')?._count.id || 0,
      total: byStatus.reduce((sum, s) => sum + s._count.id, 0),
    };

    return {
      surveyed: surveyVsApproved.total,
      approvalStatus: surveyVsApproved,
      approvalRate: surveyVsApproved.total > 0
        ? Math.round((surveyVsApproved.APPROVED / surveyVsApproved.total) * 100)
        : 0,
    };
  }
}