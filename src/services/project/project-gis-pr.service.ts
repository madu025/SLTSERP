import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

interface GenerateGISPRInput {
    requestedById: string;
    priority?: string;
    requiredDate?: string;
    deliveryLocation?: string;
    remarks?: string;
}

export class ProjectGISPRService {
    static async generatePR(projectId: string, routeId: string, data: GenerateGISPRInput) {
        const { requestedById, priority, requiredDate, deliveryLocation, remarks } = data;

        const gisRoute = await prisma.gISRoute.findFirst({
            where: { id: routeId, projectId },
            select: { id: true, name: true }
        });

        if (!gisRoute) {
            throw AppError.notFound('GIS route not found');
        }

        const boqItems = await prisma.projectBOQItem.findMany({
            where: {
                projectId,
                source: "NEW",
                remarks: { contains: "GIS auto" }
            },
            orderBy: { category: "asc" }
        });

        if (boqItems.length === 0) {
            throw AppError.badRequest('No NEW (to procure) BOQ items found for this GIS route. All items may already be in stock.');
        }

        const estimatedTotal = boqItems.reduce((sum, item) => sum + item.amount, 0);

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const prSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const prNumber = `PR-GIS-${dateStr}-${prSuffix}`;

        const requisition = await prisma.projectRequisition.create({
            data: {
                prNumber,
                projectId,
                title: `GIS Route BOQ Procurement - ${gisRoute.name}`,
                description: `Automatically generated from GIS route "${gisRoute.name}" BOQ. ${boqItems.length} items require procurement.`,
                status: "DRAFT",
                type: "MATERIAL",
                priority: priority || "MEDIUM",
                requiredDate: requiredDate ? new Date(requiredDate) : null,
                deliveryLocation: deliveryLocation || null,
                requestedById,
                estimatedTotal,
                remarks: remarks ||
                    `Auto-generated from GIS route "${gisRoute.name}" (${routeId}). ${boqItems.length} items to procure.`,
                items: {
                    create: boqItems.map((item) => ({
                        boqItemId: item.id,
                        itemCode: item.itemCode,
                        description: item.description,
                        unit: item.unit,
                        quantity: item.quantity,
                        estimatedPrice: item.unitRate,
                        totalEstimated: item.amount,
                        notes: item.remarks || null
                    }))
                }
            },
            include: {
                items: true,
                project: {
                    select: { id: true, name: true, projectCode: true }
                }
            }
        });

        return {
            requisition,
            prNumber,
            totalItems: boqItems.length,
            estimatedTotal,
            message: `Purchase Requisition ${prNumber} created with ${boqItems.length} items totaling ${estimatedTotal.toLocaleString()}`
        };
    }
}