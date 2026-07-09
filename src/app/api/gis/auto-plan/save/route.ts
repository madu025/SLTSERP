import { NextRequest, NextResponse } from 'next/server';
import { primaryClient } from '@/lib/prisma';
import { ProjectSurveyService } from '@/services/project-survey.service';
import { type PlannedPole, type PlannedClosure, type PlannedCable } from '@/services/GISAutoPlanService';

// Cache buster to force Next.js module re-evaluation: 1783209330
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, routeName, poles, closures, cables, polygon, osmData, metadata } = body;

    if (!projectId || !routeName) {
      return NextResponse.json(
        { error: 'Project ID and Route Name are required' },
        { status: 400 }
      );
    }

    // Build GeoJSON feature collection for the saved route.
    const geojsonData = {
      type: 'FeatureCollection',
      features: [
        ...(Array.isArray(cables)
          ? (cables as PlannedCable[]).map((cb) => ({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: cb.coordinates,
              },
              properties: {
                layer: 'CABLE',
                cableType: cb.cableType,
                fiberCount: cb.fiberCount,
                length: cb.length,
                index: cb.index,
                _autoPlanned: true,
              },
            }))
          : []),
        ...(Array.isArray(poles)
          ? (poles as PlannedPole[]).map((p) => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [p.longitude, p.latitude],
              },
              properties: {
                layer: 'POLE',
                poleNumber: p.index,
                poleType: p.poleType,
                height: p.height,
                _autoPlanned: true,
              },
            }))
          : []),
        ...(Array.isArray(closures)
          ? (closures as PlannedClosure[]).map((c) => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [c.longitude, c.latitude],
              },
              properties: {
                layer: c.index === 0 ? 'FEED_POINT' : (c.closureType === 'TERMINAL' ? 'FDP' : 'FIBER_JOINT'),
                closureNumber: c.index,
                closureType: c.closureType,
                capacity: c.capacity,
                notes: c.notes,
                _autoPlanned: true,
              },
            }))
          : []),
      ],
    };

    // Save plan using a database transaction
    const result = await primaryClient.$transaction(async (tx) => {
      // 1. Create Route record
      const totalCableLength = Array.isArray(cables) 
        ? (cables as PlannedCable[]).reduce((sum, cb) => sum + cb.length, 0)
        : 0;

      // Handle V1 / V2 versioning for comparison
      const existingRoute = await tx.gISRoute.findFirst({
        where: { projectId, versionType: 'PLANNED' },
        orderBy: { createdAt: 'asc' },
      });

      let nextVersion = 1;
      let finalRouteName = routeName;
      if (existingRoute) {
        nextVersion = 2;
        finalRouteName = routeName.includes('V2') ? routeName : routeName + ' - V2 (Optimized)';
        // Ensure old route is V1
        await tx.gISRoute.update({
          where: { id: existingRoute.id },
          data: { version: 1, name: existingRoute.name.includes('V1') ? existingRoute.name : existingRoute.name + ' - V1 (Old)' }
        });
      }

      const route = await tx.gISRoute.create({
        data: {
          projectId,
          name: finalRouteName,
          status: 'DRAFT',
          versionType: 'PLANNED',
          version: nextVersion,
          isActive: true,
          routeLength: totalCableLength,
          geojsonData,
          metadata: {
            ...(typeof metadata === 'object' && metadata !== null ? metadata : {}),
            polygon: polygon || undefined,
            osmData: osmData || undefined,
          },
        },
      });

      // 2. Create Poles
      if (Array.isArray(poles) && poles.length > 0) {
        await tx.gISPole.createMany({
          data: (poles as PlannedPole[]).map((p: PlannedPole) => ({
            routeId: route.id,
            poleNumber: p.index,
            latitude: p.latitude,
            longitude: p.longitude,
            height: p.height || 9,
            poleType: p.poleType || 'CONCRETE',
            status: 'PLANNED',
            properties: {
              _autoPlanned: true,
            },
          })),
        });
      }

      // 3. Create Closures (FDPs / Joints)
      if (Array.isArray(closures) && closures.length > 0) {
        await tx.gISClosure.createMany({
          data: (closures as PlannedClosure[]).map((c: PlannedClosure) => ({
            routeId: route.id,
            closureNumber: c.index,
            closureType: c.closureType || 'TERMINAL',
            latitude: c.latitude,
            longitude: c.longitude,
            capacity: c.capacity || 8,
            status: 'PLANNED',
            notes: c.notes || '',
            properties: {
              _autoPlanned: true,
            },
          })),
        });
      }

      // 4. Create Cable Segments
      if (Array.isArray(cables) && cables.length > 0) {
        await tx.gISCableSegment.createMany({
          data: (cables as PlannedCable[]).map((cb: PlannedCable) => ({
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

      return route;
    });

    // Automatically trigger BOQ recalculation for the newly saved AI plan
    try {
      await ProjectSurveyService.completeSurveyAndGenerateBOQ(projectId, {});
    } catch (boqError) {
      console.error('Error generating BOQ from AI plan:', boqError);
    }

    return NextResponse.json({
      success: true,
      message: `AI Route Plan "${routeName}" saved and BOQ recalculated successfully.`,
      routeId: result.id,
    });

  } catch (error: unknown) {
    console.error('Save AI Plan Route Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: msg || 'Failed to save AI planning route' },
      { status: 500 }
    );
  }
}
