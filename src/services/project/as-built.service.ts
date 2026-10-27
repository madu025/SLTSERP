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

    // Completed GIS imports are stored in GISRoute and its child tables when
    // no live QField session is used.  Keep the as-built export useful for
    // that supported historical-import path instead of returning empty data.
    if (allPoints.length === 0) {
      return await this.generateGISRouteExport(projectId);
    }

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
            coordinates: [Number(pt.longitude), Number(pt.latitude)],
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
      routeLengthMeters: Number(project.routeLength || 0),
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

  /** Export a completed/as-built GIS route when no SurveyPoint rows exist. */
  private static async generateGISRouteExport(projectId: string): Promise<AsBuiltExport> {
    const [project, route] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, projectCode: true, routeLength: true },
      }),
      prisma.gISRoute.findFirst({
        where: { projectId, isActive: true },
        orderBy: { createdAt: 'desc' },
        include: {
          poles: true,
          closures: true,
          chambers: true,
          cableSegments: true,
        },
      }),
    ]);

    if (!project) throw AppError.badRequest('Project not found');

    const emptyCollection = (): GeoJSON.FeatureCollection => ({
      type: 'FeatureCollection',
      features: [],
    });
    const layers: Record<string, GeoJSON.FeatureCollection> = Object.fromEntries(
      SURVEY_LAYERS.map((layer) => [layer.id, emptyCollection()])
    );

    if (!route) {
      return {
        projectName: project.name,
        projectCode: project.projectCode,
        generatedAt: new Date().toISOString(),
        summary: {
          totalPoints: 0,
          routeLengthMeters: Number(project.routeLength || 0),
          poles: { existing: 0, new: 0 },
          closures: 0,
          chambers: 0,
          fdpCount: 0,
          cableSections: 0,
        },
        geoJsonLayers: layers,
      };
    }

    const routeData = route.geojsonData as { type?: string; features?: unknown[] } | null;
    if (routeData?.type === 'FeatureCollection' && Array.isArray(routeData.features)) {
      const routeFeatures = routeData.features as GeoJSON.Feature[];
      layers.fiber_route = routeData as unknown as GeoJSON.FeatureCollection;
      layers.survey_road_crossing.features = routeFeatures.filter((feature) =>
        (feature.properties as Record<string, unknown> | null)?.layer === 'ROAD_EOP'
      );
    }

    const pointFeature = (
      id: string,
      longitude: unknown,
      latitude: unknown,
      properties: Record<string, unknown>
    ): GeoJSON.Feature => ({
      type: 'Feature',
      id,
      geometry: {
        type: 'Point',
        coordinates: [Number(longitude), Number(latitude)],
      },
      properties,
    });

    const existingPoles = route.poles.filter((pole) =>
      String((pole.properties as Record<string, unknown> | null)?.Exist_New || '').toLowerCase() === 'existing'
    );
    const newPoles = route.poles.filter((pole) => !existingPoles.includes(pole));
    layers.survey_existing_pole.features = existingPoles.map((pole) => pointFeature(
      pole.id,
      pole.longitude,
      pole.latitude,
      { poleNumber: pole.poleNumber, poleType: pole.poleType, status: pole.status, ...(pole.properties as Record<string, unknown> || {}) }
    ));
    layers.survey_new_pole.features = newPoles.map((pole) => pointFeature(
      pole.id,
      pole.longitude,
      pole.latitude,
      { poleNumber: pole.poleNumber, poleType: pole.poleType, status: pole.status, ...(pole.properties as Record<string, unknown> || {}) }
    ));
    layers.survey_joint_closure.features = route.closures.filter((closure) =>
      String(closure.closureType || '').toUpperCase() !== 'TERMINAL'
    ).map((closure) => pointFeature(
      closure.id,
      closure.longitude,
      closure.latitude,
      { closureNumber: closure.closureNumber, closureType: closure.closureType, capacity: closure.capacity, status: closure.status, ...(closure.properties as Record<string, unknown> || {}) }
    ));
    layers.survey_fdp.features = route.closures.filter((closure) =>
      String(closure.closureType || '').toUpperCase() === 'TERMINAL'
    ).map((closure) => pointFeature(
      closure.id,
      closure.longitude,
      closure.latitude,
      { closureNumber: closure.closureNumber, closureType: closure.closureType, capacity: closure.capacity, status: closure.status, ...(closure.properties as Record<string, unknown> || {}) }
    ));
    layers.survey_chamber.features = route.chambers.map((chamber) => pointFeature(
      chamber.id,
      chamber.longitude,
      chamber.latitude,
      { chamberNumber: chamber.chamberNumber, chamberType: chamber.chamberType, status: chamber.status }
    ));
    const cableFeatures = (routeData?.features || []).filter((feature) => {
      const candidate = feature as GeoJSON.Feature;
      return candidate.geometry?.type === 'LineString' &&
        (candidate.properties as Record<string, unknown> | null)?.layer === 'CABLE';
    }) as GeoJSON.Feature<GeoJSON.LineString>[];
    layers.survey_cable_start.features = cableFeatures.flatMap((feature, index) => {
      const coordinates = feature.geometry.coordinates;
      const start = coordinates[0];
      return start ? [{
        type: 'Feature',
        id: `${String(feature.id || index)}-start`,
        geometry: { type: 'Point', coordinates: start },
        properties: { endpoint: 'A', source: 'GIS_ROUTE' },
      }] : [];
    });
    layers.survey_cable_end.features = cableFeatures.flatMap((feature, index) => {
      const coordinates = feature.geometry.coordinates;
      const end = coordinates[coordinates.length - 1];
      return end ? [{
        type: 'Feature',
        id: `${String(feature.id || index)}-end`,
        geometry: { type: 'Point', coordinates: end },
        properties: { endpoint: 'B', source: 'GIS_ROUTE' },
      }] : [];
    });

    return {
      projectName: project.name,
      projectCode: project.projectCode,
      generatedAt: new Date().toISOString(),
      summary: {
        totalPoints: route.poles.length + route.closures.length + route.chambers.length,
        routeLengthMeters: Number(route.routeLength || project.routeLength || 0),
        poles: { existing: existingPoles.length, new: newPoles.length },
        closures: route.closures.length,
        chambers: route.chambers.length,
        fdpCount: route.closures.filter((closure) => String(closure.closureType || '').toUpperCase() === 'TERMINAL').length,
        cableSections: route.cableSegments.length,
      },
      geoJsonLayers: layers,
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
          coordinates: [Number(pt.longitude), Number(pt.latitude)],
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
    const points = await prisma.surveyPoint.findMany({
      where: { projectId },
      select: { layerId: true, verificationStatus: true },
    });

    if (points.length > 0) {
      const layers = SURVEY_LAYERS.map((layer) => {
        const layerPoints = points.filter((point) => point.layerId === layer.id);
        return {
          layerId: layer.id,
          layerName: layer.label,
          surveyed: layerPoints.length,
          approved: layerPoints.filter((point) => ['APPROVED', 'VERIFIED'].includes(point.verificationStatus)).length,
          installed: layerPoints.filter((point) => ['APPROVED', 'VERIFIED'].includes(point.verificationStatus)).length,
        };
      });
      return {
        layers,
        totalSurveyed: points.length,
        totalApproved: layers.reduce((sum, layer) => sum + layer.approved, 0),
        totalInstalled: layers.reduce((sum, layer) => sum + layer.installed, 0),
      };
    }

    const route = await prisma.gISRoute.findFirst({
      where: { projectId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        geojsonData: true,
        poles: true,
        closures: true,
        chambers: true,
        cableSegments: true,
      },
    });
    const layers = SURVEY_LAYERS.map((layer) => {
      const assets = layer.id === 'survey_existing_pole'
        ? (route?.poles || []).filter((pole) => String((pole.properties as Record<string, unknown> | null)?.Exist_New || '').toLowerCase() === 'existing')
        : layer.id === 'survey_new_pole'
          ? (route?.poles || []).filter((pole) => String((pole.properties as Record<string, unknown> | null)?.Exist_New || '').toLowerCase() !== 'existing')
          : layer.id === 'survey_joint_closure'
            ? (route?.closures || []).filter((closure) => String(closure.closureType || '').toUpperCase() !== 'TERMINAL')
            : layer.id === 'survey_fdp'
              ? (route?.closures || []).filter((closure) => String(closure.closureType || '').toUpperCase() === 'TERMINAL')
              : layer.id === 'survey_chamber'
                ? route?.chambers || []
                : layer.id === 'survey_road_crossing'
                  ? (((route?.geojsonData as { features?: GeoJSON.Feature[] } | null)?.features || []).filter((feature) =>
                    (feature.properties as Record<string, unknown> | null)?.layer === 'ROAD_EOP'
                  ))
                : layer.id === 'survey_cable_start' || layer.id === 'survey_cable_end'
                  ? route?.cableSegments || []
                  : [];
      const count = assets.length;
      const installed = assets.filter((asset) =>
        ['APPROVED', 'VERIFIED', 'INSTALLED'].includes(String((asset as { status?: string }).status))
      ).length;
      return { layerId: layer.id, layerName: layer.label, surveyed: count, approved: installed, installed };
    });
    return {
      layers,
      totalSurveyed: layers.reduce((sum, layer) => sum + layer.surveyed, 0),
      totalApproved: layers.reduce((sum, layer) => sum + layer.approved, 0),
      totalInstalled: layers.reduce((sum, layer) => sum + layer.installed, 0),
    };
  }
}
