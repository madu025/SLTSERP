import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ id: string }>;

// POST /api/projects/[id]/boq/generate-pr - Auto-generate Purchase Requisition from approved BOQ
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify BOQ is approved
    const boqApproval = await prisma.bOQApproval.findFirst({
      where: { projectId, status: 'APPROVED' },
    });

    if (!boqApproval) {
      return NextResponse.json(
        { error: 'BOQ must be approved before generating purchase requisition' },
        { status: 400 }
      );
    }

    // Get all BOQ items that require material (isNewMaterial layers)
    const boqItems = await prisma.projectBOQItem.findMany({
      where: {
        projectId,
        category: { in: ['MATERIAL', 'MATERIAL+LABOR', 'CABLE'] },
      },
    });

    if (boqItems.length === 0) {
      return NextResponse.json(
        { message: 'No material items found in BOQ. Labor-only project — no PR needed.' },
        { status: 200 }
      );
    }

    // Check for existing PR
    const existingPR = await prisma.projectRequisition.findFirst({
      where: {
        projectId,
        status: { notIn: ['CANCELLED', 'REJECTED'] },
      },
    });

    if (existingPR) {
      return NextResponse.json({
        message: 'PR already exists for this project',
        existingPR: {
          prNumber: existingPR.prNumber,
          status: existingPR.status,
          estimatedTotal: existingPR.estimatedTotal,
        },
        action: 'view_existing',
      });
    }

    // Get project for naming
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, projectCode: true, budget: true },
    });

    if (!project) throw new Error('Project not found');

    // Generate PR number
    const count = await prisma.projectRequisition.count();
    const prNumber = `PR-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

    // Calculate totals by category
    const materialItems = boqItems.filter((i) => i.category === 'MATERIAL');
    const materialLaborItems = boqItems.filter((i) => i.category === 'MATERIAL+LABOR');
    const cableItems = boqItems.filter((i) => i.category === 'CABLE');

    const totalMaterial = materialItems.reduce((s, i) => s + i.amount, 0);
    const totalMaterialLabor = materialLaborItems.reduce((s, i) => s + i.amount, 0);
    const totalCable = cableItems.reduce((s, i) => s + i.amount, 0);
    const estimatedTotal = totalMaterial + totalMaterialLabor + totalCable;

    // Create PR with all material items
    const pr = await prisma.$transaction(async (tx) => {
      const requisition = await tx.projectRequisition.create({
        data: {
          prNumber,
          projectId,
          title: `Material Request — ${project.projectCode}: ${project.name}`,
          description: `Auto-generated from approved BOQ. Materials: ${materialItems.length}, M+L: ${materialLaborItems.length}, Cable: ${cableItems.length}`,
          status: 'DRAFT',
          requestedById: userId,
          estimatedTotal,
          items: {
            create: [
              ...materialItems.map((item) => ({
                itemCode: item.itemCode,
                description: item.description,
                unit: item.unit,
                quantity: item.quantity,
                estimatedPrice: item.unitRate,
                totalEstimated: item.amount,
                notes: item.remarks || item.source,
              })),
              ...materialLaborItems.map((item) => ({
                itemCode: item.itemCode,
                description: item.description,
                unit: item.unit,
                quantity: item.quantity,
                estimatedPrice: item.unitRate,
                totalEstimated: item.amount,
                notes: item.remarks || item.source,
              })),
              ...cableItems.map((item) => ({
                itemCode: item.itemCode,
                description: item.description,
                unit: item.unit,
                quantity: item.quantity,
                estimatedPrice: item.unitRate,
                totalEstimated: item.amount,
                notes: item.remarks || item.source,
              })),
            ],
          },
        },
        include: {
          items: true,
        },
      });

      return requisition;
    });

    // Update project status
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'MATERIAL_REQUESTED' },
    });

    return NextResponse.json(
      {
        message: 'Purchase Requisition generated from approved BOQ',
        pr,
        summary: {
          prNumber,
          materialItems: materialItems.length,
          materialLaborItems: materialLaborItems.length,
          cableItems: cableItems.length,
          totalItems: boqItems.length,
          estimatedTotal,
          categories: {
            MATERIAL: totalMaterial,
            'MATERIAL+LABOR': totalMaterialLabor,
            CABLE: totalCable,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate PR';
    console.error('Generate PR error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/projects/[id]/boq/generate-pr - Get PR generation status
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;

    const [boqApproval, existingPR] = await Promise.all([
      prisma.bOQApproval.findFirst({
        where: { projectId, status: 'APPROVED' },
        select: { id: true, financeApprovedAt: true },
      }),
      prisma.projectRequisition.findFirst({
        where: { projectId, status: { notIn: ['CANCELLED', 'REJECTED'] } },
        select: { id: true, prNumber: true, status: true, estimatedTotal: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const materialItemsCount = await prisma.projectBOQItem.count({
      where: { projectId, category: { in: ['MATERIAL', 'MATERIAL+LABOR', 'CABLE'] } },
    });

    return NextResponse.json({
      canGenerate: !!boqApproval && !existingPR,
      boqApproved: !!boqApproval,
      boqTotal: null as unknown as number | null, // Computed below
      materialItemsCount,
      existingPR,
    });
  } catch (error) {
    console.error('Error fetching PR status:', error);
    return NextResponse.json({ error: 'Failed to fetch PR status' }, { status: 500 });
  }
}