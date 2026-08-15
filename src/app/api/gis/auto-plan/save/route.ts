export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { primaryClient } from '@/lib/prisma';
import { ProjectSurveyService } from '@/services/project/project-survey.service';
import { type PlannedPole, type PlannedClosure, type PlannedCable } from '@/services/gis/GISAutoPlanService';
import { safe } from '@/utils/safe-await.util';
// Cache buster to force Next.js module re-evaluation: 1783209330
export const POST = apiHandler(async (req) => {
  const [jsonErr, body] = await safe<Record<string, unknown>>(req.json());
  if (jsonErr || !body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { projectId, routeName, poles, closures, cables, polygon, osmData, metadata } = body as {
    projectId: string;
    routeName: string;
    poles: unknown;
    closures: unknown;
    cables: unknown;
    polygon: unknown;
    osmData: unknown;
    metadata: unknown;
  };
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
    const [txErr, result] = await safe(primaryClient.$transaction(async (tx) => {
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
    }));
    if (txErr || !result) {
      console.error('Save AI Plan Route Error:', txErr);
      return NextResponse.json(
        { error: txErr?.message || 'Failed to save AI planning route' },
        { status: 500 }
      );
    }
    // Automatically trigger BOQ recalculation for the newly saved AI plan
    const [boqErr] = await safe(ProjectSurveyService.completeSurveyAndGenerateBOQ(projectId, {}));
    if (boqErr) {
      console.error('Error generating BOQ from AI plan:', boqErr.message);
    }
    return NextResponse.json({
      success: true,
      message: `AI Route Plan "${routeName}" saved and BOQ recalculated successfully.`,
      routeId: result.id,
    });
}, { rawResponse: true });