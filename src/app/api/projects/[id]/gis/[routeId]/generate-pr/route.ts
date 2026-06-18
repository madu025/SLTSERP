import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST: Generate a Purchase Requisition (PR) from the GIS route's auto-generated BOQ
// Collects all ProjectBOQItems marked as source=NEW (to procure) for this route
// and creates a ProjectRequisition with its ProjectRequisitionItems.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; routeId: string }> }
) {
    try {
        const { id: projectId, routeId } = await params;
        const body = await request.json();
        const { requestedById, priority, requiredDate, deliveryLocation, remarks } = body;

        if (!requestedById) {
            return NextResponse.json({ error: "requestedById is required" }, { status: 400 });
        }

        // Verify the GIS route exists and belongs to this project
        const gisRoute = await prisma.gISRoute.findFirst({
            where: { id: routeId, projectId },
            select: { id: true, name: true }
        });

        if (!gisRoute) {
            return NextResponse.json({ error: "GIS route not found" }, { status: 404 });
        }

        // Find ProjectBOQItems linked to this route's GIS auto-generation
        // They are identified by having remarks containing "GIS auto"
        const boqItems = await prisma.projectBOQItem.findMany({
            where: {
                projectId,
                source: "NEW",
                remarks: { contains: "GIS auto" }
            },
            orderBy: { category: "asc" }
        });

        if (boqItems.length === 0) {
            return NextResponse.json(
                { error: "No NEW (to procure) BOQ items found for this GIS route. All items may already be in stock." },
                { status: 400 }
            );
        }

        // Calculate total estimated from all items
        const estimatedTotal = boqItems.reduce((sum, item) => sum + item.amount, 0);

        // Generate PR number (e.g., PR-GIS-20260618-XXXX)
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const prSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const prNumber = `PR-GIS-${dateStr}-${prSuffix}`;

        // Create the ProjectRequisition with all items
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

        return NextResponse.json({
            requisition,
            prNumber,
            totalItems: boqItems.length,
            estimatedTotal,
            message: `Purchase Requisition ${prNumber} created with ${boqItems.length} items totaling ${estimatedTotal.toLocaleString()}`
        }, { status: 201 });
    } catch (error) {
        console.error("Error generating PR from GIS BOQ:", error);
        return NextResponse.json({ error: "Failed to generate purchase requisition" }, { status: 500 });
    }
}