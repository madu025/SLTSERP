import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AutoBOQService } from '@/services/auto-boq.service';

/**
 * POST /api/projects/[id]/auto-boq
 * Auto-generate Bill of Quantities from approved GIS survey points.
 * Deletes any previously auto-calculated items for this project,
 * then inserts fresh BOQ items from the AutoBOQService calculation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Optional config overrides from request body
    let cableConfigOverride: Partial<{
      startReserve: number;
      endReserve: number;
      jointReserve: number;
      maintenanceLoop: number;
      longRouteThreshold: number;
      routeFactorPct: number;
    }> = {};

    try {
      const body = await request.json();
      if (body && typeof body === 'object') {
        cableConfigOverride = body.cableConfig || {};
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    // 1. Generate BOQ from AutoBOQService
    const { boq, summary, cableConfig } = await AutoBOQService.generateBOQ(
      projectId,
      cableConfigOverride
    );

    if (!boq || boq.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'No approved survey points found. BOQ generation produced no items.',
          summary: { TOTAL: 0 },
          itemCount: 0,
        },
        { status: 200 }
      );
    }

    // 2. Delete existing auto-calculated items (identified by remarks marker)
    await prisma.projectBOQItem.deleteMany({
      where: {
        projectId,
        remarks: {
          contains: 'AUTO_CALCULATED',
        },
      },
    });

    // 3. Insert all new auto-calculated items in a transaction
    const createdItems = await prisma.$transaction(
      boq.map((item) =>
        prisma.projectBOQItem.create({
          data: {
            projectId,
            itemCode: item.itemCode,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitRate: item.unitRate,
            amount: item.amount,
            category: item.itemCategory,
            source: 'NEW',
            remarks: `AUTO_CALCULATED | ${item.sourceReference}`,
          },
        })
      )
    );

    return NextResponse.json(
      {
        success: true,
        message: `BOQ generated successfully. ${createdItems.length} items created.`,
        summary,
        cableConfig,
        itemCount: createdItems.length,
        items: createdItems,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Auto-BOQ generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate auto-BOQ',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}