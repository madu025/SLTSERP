import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export class ProjectBOQPRService {
    static async getPRGenerationStatus(projectId: string) {
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

        return {
            canGenerate: !!boqApproval && !existingPR,
            boqApproved: !!boqApproval,
            boqTotal: null,
            materialItemsCount,
            existingPR,
        };
    }

    static async generatePR(projectId: string, userId: string) {
        const boqApproval = await prisma.bOQApproval.findFirst({
            where: { projectId, status: 'APPROVED' },
        });

        if (!boqApproval) {
            throw AppError.badRequest('BOQ must be approved before generating purchase requisition');
        }

        const boqItems = await prisma.projectBOQItem.findMany({
            where: {
                projectId,
                category: { in: ['MATERIAL', 'MATERIAL+LABOR', 'CABLE'] },
                source: 'NEW'
            },
        });

        if (boqItems.length === 0) {
            return {
                message: 'No shortfall material items found in BOQ. All materials are either in stock or labor-only.',
                pr: null,
                summary: null
            };
        }

        const existingPR = await prisma.projectRequisition.findFirst({
            where: {
                projectId,
                status: { notIn: ['CANCELLED', 'REJECTED'] },
            },
        });

        if (existingPR) {
            return {
                message: 'PR already exists for this project',
                existingPR: {
                    prNumber: existingPR.prNumber,
                    status: existingPR.status,
                    estimatedTotal: existingPR.estimatedTotal,
                },
                action: 'view_existing',
            };
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { name: true, projectCode: true, budget: true },
        });

        if (!project) throw AppError.notFound('Project not found');

        const count = await prisma.projectRequisition.count();
        const prNumber = `PR-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

        const materialItems = boqItems.filter((i) => i.category === 'MATERIAL');
        const materialLaborItems = boqItems.filter((i) => i.category === 'MATERIAL+LABOR');
        const cableItems = boqItems.filter((i) => i.category === 'CABLE');

        const totalMaterial = materialItems.reduce((s, i) => s + i.amount, 0);
        const totalMaterialLabor = materialLaborItems.reduce((s, i) => s + i.amount, 0);
        const totalCable = cableItems.reduce((s, i) => s + i.amount, 0);
        const estimatedTotal = totalMaterial + totalMaterialLabor + totalCable;

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
                include: { items: true },
            });

            await tx.project.update({
                where: { id: projectId },
                data: { status: 'MATERIAL_REQUESTED' },
            });

            return requisition;
        });

        return {
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
        };
    }
}