import { NextResponse } from 'next/server';
import { ProjectBOQService } from '@/services/project-boq.service';

// GET /api/projects/boq-rates - Get all BOQ rate configs (global + project-specific)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const isActive = searchParams.get('isActive');

    const isActiveVal = isActive !== null && isActive !== undefined ? isActive === 'true' : undefined;

    const rates = await ProjectBOQService.getBOQRates(projectId, isActiveVal);

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
  } catch (error: unknown) {
    console.error('Error fetching BOQ rates:', error);
    return NextResponse.json({ error: 'Failed to fetch rates' }, { status: 500 });
  }
}

// POST /api/projects/boq-rates - Create or update a BOQ rate config
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { itemCode, unitRate } = body;

    if (!itemCode || unitRate === undefined) {
      return NextResponse.json(
        { error: 'itemCode and unitRate are required' },
        { status: 400 }
      );
    }

    const { rate, isNew } = await ProjectBOQService.saveBOQRate(body);
    return NextResponse.json(rate, { status: isNew ? 201 : 200 });
  } catch (error: unknown) {
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

    const summary = await ProjectBOQService.bulkUpdateBOQRates(rates);

    return NextResponse.json({
      message: `Bulk rate update: ${summary.succeeded} succeeded, ${summary.failed} failed`,
      succeeded: summary.succeeded,
      failed: summary.failed,
      total: summary.total,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bulk update failed';
    console.error('Bulk rate update error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}