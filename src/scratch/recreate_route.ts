import { primaryClient } from '../lib/prisma';
import { GISAutoPlanService } from '../services/GISAutoPlanService';
import { ProjectSurveyService } from '../services/project-survey.service';
import { type PlannedPole, type PlannedClosure, type PlannedCable } from '../services/GISAutoPlanService';

async function main() {
  const projectId = 'cmr3b0q2a00f5si6khytg417j';

  console.log(`[Recreate Route] Fetching existing PLANNED route for project: ${projectId}...`);
  const existingRoute = await primaryClient.gISRoute.findFirst({
    where: { projectId, versionType: 'PLANNED' },
    orderBy: { createdAt: 'desc' },
  });

  if (!existingRoute) {
    console.error('[Recreate Route] No existing PLANNED route found to base from.');
    return;
  }

  const metadata = existingRoute.metadata as any;
  if (!metadata || !metadata.polygon || !metadata.osmData) {
    console.error('[Recreate Route] Existing route metadata is missing polygon or osmData.');
    return;
  }

  const polygon = metadata.polygon;
  const rawOsmData = JSON.parse(JSON.stringify(metadata.osmData));
  
  // CRITICAL: Strip the mutated roads array so that generatePlan re-extracts the clean roads from elements
  if (rawOsmData.roads) {
    console.log('[Recreate Route] Stripping mutated roads array from OSM metadata...');
    delete rawOsmData.roads;
  }

  const startDeviceType = metadata.startDeviceType || 'OLT';
  
  // Extract feedPoint coordinates from the GeoJSON of this route
  let feedPoint: { lat: number; lon: number } | undefined = undefined;
  const geojson = existingRoute.geojsonData as any;
  if (geojson && geojson.features) {
    const feedPointFeature = geojson.features.find((f: any) => f.properties?.layer === 'FDP' && f.properties?.closureNumber === 0);
    if (feedPointFeature) {
      feedPoint = {
        lat: feedPointFeature.geometry.coordinates[1],
        lon: feedPointFeature.geometry.coordinates[0]
      };
    }
  }

  console.log('[Recreate Route] Extracted feedPoint:', feedPoint);

  // 1. Delete all existing planned routes for this project
  console.log('[Recreate Route] Deleting existing route records (cascade deletes poles/closures/cables)...');
  await primaryClient.gISRoute.deleteMany({
    where: { projectId, versionType: 'PLANNED' }
  });

  // 2. Generate the completely fresh plan
  console.log('[Recreate Route] Generating fresh plan from clean raw OSM data...');
  const plan = await GISAutoPlanService.generatePlan(
    polygon,
    rawOsmData,
    [],
    '8',
    feedPoint,
    startDeviceType
  );

  console.log('[Recreate Route] Plan generated successfully!');
  console.log(`- Quality Score: ${plan.summary.engineeringQualityScore}`);
  console.log(`- Poles: ${plan.poles.length}`);
  console.log(`- Closures: ${plan.closures.length}`);
  console.log(`- Cables: ${plan.cables.length}`);

  // Build the new GeoJSON
  const geojsonData = {
    type: 'FeatureCollection',
    features: [
      ...plan.cables.map((cb) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: cb.coordinates },
        properties: {
          layer: 'CABLE',
          cableType: cb.cableType,
          fiberCount: cb.fiberCount,
          length: cb.length,
          index: cb.index,
          _autoPlanned: true,
        },
      })),
      ...plan.poles.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        properties: {
          layer: 'POLE',
          poleNumber: p.index,
          poleType: p.poleType,
          height: p.height,
          _autoPlanned: true,
        },
      })),
      ...plan.closures.map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
        properties: {
          layer: c.closureType === 'DOME' ? 'FDP' : 'FIBER_JOINT',
          closureNumber: c.index,
          closureType: c.closureType,
          capacity: c.capacity,
          notes: c.notes,
          _autoPlanned: true,
        },
      })),
    ],
  };

  const totalCableLength = plan.cables.reduce((sum, cb) => sum + cb.length, 0);

  // 3. Create the new GISRoute record in DB
  console.log('[Recreate Route] Saving fresh plan as active PLANNED route (V1)...');
  const route = await primaryClient.gISRoute.create({
    data: {
      projectId,
      name: 'AI Planning Route - V1',
      status: 'DRAFT',
      versionType: 'PLANNED',
      version: 1,
      isActive: true,
      routeLength: totalCableLength,
      geojsonData,
      metadata: {
        ...metadata,
        polygon,
        osmData: plan.osmData, // Save clean osmData returned by generatePlan
        engineeringQualityScore: plan.summary.engineeringQualityScore,
      }
    }
  });

  // Create Poles
  if (plan.poles.length > 0) {
    await primaryClient.gISPole.createMany({
      data: plan.poles.map((p) => ({
        routeId: route.id,
        poleNumber: p.index,
        latitude: p.latitude,
        longitude: p.longitude,
        height: p.height || 9,
        poleType: p.poleType || 'CONCRETE',
        status: 'PLANNED',
        properties: { _autoPlanned: true },
      })),
    });
  }

  // Create Closures
  if (plan.closures.length > 0) {
    await primaryClient.gISClosure.createMany({
      data: plan.closures.map((c) => ({
        routeId: route.id,
        closureNumber: c.index,
        closureType: c.closureType || 'TERMINAL',
        latitude: c.latitude,
        longitude: c.longitude,
        capacity: c.capacity || 8,
        status: 'PLANNED',
        notes: c.notes || '',
        properties: { _autoPlanned: true },
      })),
    });
  }

  // Create Cable Segments
  if (plan.cables.length > 0) {
    await primaryClient.gISCableSegment.createMany({
      data: plan.cables.map((cb) => ({
        routeId: route.id,
        segmentNumber: cb.index,
        length: cb.length,
        status: 'PLANNED',
        cableType: cb.cableType || 'ADSS',
        fiberCount: cb.fiberCount || 12,
        properties: {
          coordinates: cb.coordinates || [],
          _autoPlanned: true,
        },
      })),
    });
  }

  // 4. Trigger BOQ recalculation
  console.log('[Recreate Route] Generating BOQ for the fresh route...');
  try {
    await ProjectSurveyService.completeSurveyAndGenerateBOQ(projectId, {});
    console.log('[Recreate Route] BOQ generated successfully!');
  } catch (boqError) {
    console.error('Error generating BOQ:', boqError);
  }

  console.log('[Recreate Route] All done! Active route ID is now:', route.id);
}

main().catch(console.error);
