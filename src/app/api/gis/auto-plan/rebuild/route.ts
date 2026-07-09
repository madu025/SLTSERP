import { NextResponse } from 'next/server';
import { primaryClient } from '@/lib/prisma';
import { GISAutoPlanService } from '@/services/GISAutoPlanService';
import { ProjectSurveyService } from '@/services/project-survey.service';

export const dynamic = 'force-dynamic';
// Cache buster comment to force Next.js route re-evaluation: 1783209356

export async function GET() {
  try {
    const projectId = 'cmr3b0q2a00f5si6khytg417j';
    
    // 1. Find the existing route
    const existingRoute = await primaryClient.gISRoute.findFirst({
      where: { projectId, versionType: 'PLANNED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!existingRoute) {
      return NextResponse.json({ error: 'No existing route found to rebuild.' }, { status: 404 });
    }

    const metadata = existingRoute.metadata as any;
    if (!metadata || !metadata.polygon || !metadata.osmData) {
      return NextResponse.json({ error: 'Metadata is missing polygon or osmData.' }, { status: 400 });
    }

    const { polygon, osmData, startDeviceType } = metadata;
    
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

    // 2. Generate the new plan
    const plan = await GISAutoPlanService.generatePlan(polygon, osmData, [], '8', feedPoint, startDeviceType);

    // 3. Delete the old poles, closures, cables associated with this route ID
    await primaryClient.gISPole.deleteMany({ where: { routeId: existingRoute.id } });
    await primaryClient.gISClosure.deleteMany({ where: { routeId: existingRoute.id } });
    await primaryClient.gISCableSegment.deleteMany({ where: { routeId: existingRoute.id } });

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

    // Update Route including score in metadata
    console.log('OSP QUALITY SCORE:', plan.summary.engineeringQualityScore);
    const p4 = plan.poles.find(p => p.index === 4);
    const p70 = plan.poles.find(p => p.index === 70);
    if (p4) console.log('DEBUG P4:', p4);
    if (p70) console.log('DEBUG P70:', p70);

    await primaryClient.gISRoute.update({
      where: { id: existingRoute.id },
      data: {
        routeLength: totalCableLength,
        geojsonData,
        metadata: {
          ...metadata,
          engineeringQualityScore: plan.summary.engineeringQualityScore,
        }
      }
    });

    // Create New Poles
    if (plan.poles.length > 0) {
      await primaryClient.gISPole.createMany({
        data: plan.poles.map((p) => ({
          routeId: existingRoute.id,
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

    // Create New Closures
    if (plan.closures.length > 0) {
      await primaryClient.gISClosure.createMany({
        data: plan.closures.map((c) => ({
          routeId: existingRoute.id,
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

    // Create New Cable Segments
    if (plan.cables.length > 0) {
      await primaryClient.gISCableSegment.createMany({
        data: plan.cables.map((cb) => ({
          routeId: existingRoute.id,
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

    // Recompute BOQ
    try {
      await ProjectSurveyService.completeSurveyAndGenerateBOQ(projectId, {});
    } catch (boqError) {
      console.error('Error generating BOQ:', boqError);
    }

    return NextResponse.json({
      success: true,
      score: plan.summary.engineeringQualityScore,
      violations: plan.summary.violations,
      p4,
      p70,
      closures: plan.closures,
      debugLogs: plan.debugLogs,
      message: `Route updated successfully in place! Quality Score: ${plan.summary.engineeringQualityScore}`
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
