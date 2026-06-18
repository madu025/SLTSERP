import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/boq-rates - Get all BOQ rate configs (global + project-specific)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {};
    if (projectId) {
      where.OR = [{ projectId }, { projectId: null }];
    }
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const rates = await prisma.bOQRateConfig.findMany({
      where,
      orderBy: [{ projectId: { sort: 'asc', nulls: 'first' } }, { itemCode: 'asc' }],
    });

    // Group by scope
    const global = rates.filter((r) => r.projectId === null);
    const project = rates.filter((r) => r.projectId !== null);

    return NextResponse.json({
      rates,
      summary: {
        total: rates.length,
        global: global.length,
        projectSpecific: project.length,
      },
      defaultTelecomCableConfig: {
        startReserve: 10,
        endReserve: 10,
        jointReserve: 5,
        maintenanceLoop: 10,
        longRouteThreshold: 500,
        routeFactorPct: 0,
      },
    });
  } catch (error) {
    console.error('Error fetching BOQ rates:', error);
    return NextResponse.json({ error: 'Failed to fetch rates' }, { status: 500 });
  }
}

// POST /api/projects/boq-rates - Create or update a BOQ rate config
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { itemCode, description, unit, unitRate, itemCategory, projectId, isActive } = body;

    if (!itemCode || unitRate === undefined) {
      return NextResponse.json(
        { error: 'itemCode and unitRate are required' },
        { status: 400 }
      );
    }

    // Upsert: update if exists, create if not
    const existing = await prisma.bOQRateConfig.findFirst({
      where: {
        itemCode,
        projectId: projectId || null,
      },
    });

    let rate;
    if (existing) {
      rate = await prisma.bOQRateConfig.update({
        where: { id: existing.id },
        data: {
          description: description ?? existing.description,
          unit: unit ?? existing.unit,
          unitRate: parseFloat(unitRate),
          itemCategory: itemCategory ?? existing.itemCategory,
          isActive: isActive !== undefined ? isActive : existing.isActive,
        },
      });
    } else {
      rate = await prisma.bOQRateConfig.create({
        data: {
          itemCode,
          description: description || itemCode,
          unit: unit || 'UNIT',
          unitRate: parseFloat(unitRate),
          itemCategory: itemCategory || 'MATERIAL',
          projectId: projectId || null,
          isActive: isActive !== undefined ? isActive : true,
        },
      });
    }

    return NextResponse.json(rate, { status: existing ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save rate';
    console.error('BOQ rate error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/projects/boq-rates - Bulk update rates
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { rates } = body; // Array of { itemCode, unitRate, projectId? }

    if (!rates || !Array.isArray(rates) || rates.length === 0) {
      return NextResponse.json({ error: 'rates array is required' }, { status: 400 });
    }

    const results = await Promise.allSettled(
      rates.map(async (r: { itemCode: string; unitRate: number; projectId?: string | null; itemCategory?: string }) => {
        if (!r.itemCode || r.unitRate === undefined) {
          throw new Error(`Missing itemCode or unitRate for entry`);
        }

        const existing = await prisma.bOQRateConfig.findFirst({
          where: { itemCode: r.itemCode, projectId: r.projectId || null },
        });

        if (existing) {
          return prisma.bOQRateConfig.update({
            where: { id: existing.id },
            data: { 
              unitRate: parseFloat(String(r.unitRate)),
              ...(r.itemCategory ? { itemCategory: r.itemCategory } : {})
            },
          });
        }

        return prisma.bOQRateConfig.create({
          data: {
            itemCode: r.itemCode,
            unitRate: parseFloat(String(r.unitRate)),
            projectId: r.projectId || null,
            itemCategory: r.itemCategory || 'MATERIAL',
          },
        });
      })
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({
      message: `Bulk rate update: ${succeeded} succeeded, ${failed} failed`,
      succeeded,
      failed,
      total: rates.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bulk update failed';
    console.error('Bulk rate update error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}