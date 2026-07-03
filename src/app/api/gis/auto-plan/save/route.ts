import { NextRequest, NextResponse } from 'next/server';
import { primaryClient } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, routeName, poles, closures, cables } = body;

    if (!projectId || !routeName) {
      return NextResponse.json(
        { error: 'Project ID and Route Name are required' },
        { status: 400 }
      );
    }

    // Save plan using a database transaction
    const result = await primaryClient.$transaction(async (tx) => {
      // 1. Create Route record
      const route = await tx.gISRoute.create({
        data: {
          projectId,
          name: routeName,
          status: 'DRAFT',
          versionType: 'PLANNED',
          isActive: true,
        },
      });

      // 2. Create Poles
      if (Array.isArray(poles) && poles.length > 0) {
        await tx.gISPole.createMany({
          data: poles.map((p: any) => ({
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
          data: closures.map((c: any) => ({
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
          data: cables.map((cb: any) => ({
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

    return NextResponse.json({
      success: true,
      message: `AI Route Plan "${routeName}" saved successfully.`,
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
