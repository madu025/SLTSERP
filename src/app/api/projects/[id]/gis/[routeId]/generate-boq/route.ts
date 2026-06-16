import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST: Generate BOQ from GIS route - auto-calculate quantities and create BOTH
// GISGeneratedBOQ (for GIS tracking) AND ProjectBOQItems (for project BOQ tab / overview)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; routeId: string }> }
) {
    try {
        const { id: projectId, routeId } = await params;
        const body = await request.json();

        // Fetch GIS route with all related elements
        const gisRoute = await prisma.gISRoute.findFirst({
            where: {
                id: routeId,
                projectId
            },
            include: {
                poles: true,
                chambers: true,
                closures: true,
                cableSegments: true
            }
        });

        if (!gisRoute) {
            return NextResponse.json({ error: "GIS route not found" }, { status: 404 });
        }

        const { notes } = body;

        // Auto-calculate quantities
        const poleCount = gisRoute.poles.length;
        const chamberCount = gisRoute.chambers.length;
        const closureCount = gisRoute.closures.length;
        const cableSegmentCount = gisRoute.cableSegments.length;
        const totalCableLength = gisRoute.cableSegments.reduce((sum, seg) => sum + (seg.length || 0), 0);

        // Fetch inventory items for unit rates (try to find matching materials)
        const inventoryItems = await prisma.inventoryItem.findMany({
            where: {
                OR: [
                    { code: { contains: "POLE", mode: "insensitive" } },
                    { code: { contains: "CBL", mode: "insensitive" } },
                    { name: { contains: "Pole", mode: "insensitive" } },
                    { name: { contains: "Fiber", mode: "insensitive" } },
                    { name: { contains: "Cable", mode: "insensitive" } },
                    { name: { contains: "Chamber", mode: "insensitive" } },
                    { name: { contains: "Closure", mode: "insensitive" } },
                    { name: { contains: "Splice", mode: "insensitive" } },
                    { name: { contains: "Manhole", mode: "insensitive" } },
                ]
            },
            take: 50
        });

        // Helper to find a matching rate from inventory
        const findRate = (keywords: string[]): number => {
            const match = inventoryItems.find((item) =>
                keywords.some((kw) =>
                    item.name?.toLowerCase().includes(kw.toLowerCase()) ||
                    item.code?.toLowerCase().includes(kw.toLowerCase())
                )
            );
            return match?.unitPrice || 0;
        };

        // ====================================================================
        // Build GISGeneratedBOQ items (for GIS tracking)
        // ====================================================================
        const gisItems: Array<{
            itemCategory: string;
            itemCode: string;
            description: string;
            unit: string;
            quantity: number;
            unitRate: number;
            amount: number;
            sourceType: string;
            sourceReference: string;
        }> = [];

        // Pole items
        const poleRate = findRate(["pole", "wooden", "concrete"]);
        if (poleCount > 0) {
            const amount = poleCount * poleRate;
            gisItems.push({
                itemCategory: "POLE",
                itemCode: "POLE-001",
                description: "Fiber Optic Pole - Wooden/Concrete",
                unit: "Nos",
                quantity: poleCount,
                unitRate: poleRate,
                amount,
                sourceType: "AUTO_CALCULATED",
                sourceReference: `GIS auto-count: ${poleCount} poles`
            });
        }

        // Chamber items
        const chamberRate = findRate(["chamber", "manhole"]);
        if (chamberCount > 0) {
            const amount = chamberCount * chamberRate;
            gisItems.push({
                itemCategory: "CHAMBER",
                itemCode: "CHMB-001",
                description: "Fiber Optic Chamber / Manhole",
                unit: "Nos",
                quantity: chamberCount,
                unitRate: chamberRate,
                amount,
                sourceType: "AUTO_CALCULATED",
                sourceReference: `GIS auto-count: ${chamberCount} chambers`
            });
        }

        // Closure items
        const closureRate = findRate(["closure", "splice"]);
        if (closureCount > 0) {
            const amount = closureCount * closureRate;
            gisItems.push({
                itemCategory: "CLOSURE",
                itemCode: "CLSR-001",
                description: "Fiber Optic Splice Closure",
                unit: "Nos",
                quantity: closureCount,
                unitRate: closureRate,
                amount,
                sourceType: "AUTO_CALCULATED",
                sourceReference: `GIS auto-count: ${closureCount} closures`
            });
        }

        // Cable segment items
        const cableRate = findRate(["fiber", "cable"]);
        if (cableSegmentCount > 0) {
            const amount = totalCableLength * cableRate;
            gisItems.push({
                itemCategory: "CABLE",
                itemCode: "CBL-001",
                description: "Fiber Optic Cable",
                unit: "Meters",
                quantity: totalCableLength,
                unitRate: cableRate,
                amount,
                sourceType: "AUTO_CALCULATED",
                sourceReference: `GIS auto-sum: ${cableSegmentCount} segments totaling ${totalCableLength}m`
            });
        }

        const totalEstimated = gisItems.reduce((sum, item) => sum + item.amount, 0);

        // ====================================================================
        // Create GISGeneratedBOQ with items
        // ====================================================================
        const boq = await prisma.gISGeneratedBOQ.create({
            data: {
                routeId,
                projectId,
                status: "DRAFT",
                totalEstimated,
                notes: notes || null,
                createdById: body.createdById || null,
                items: {
                    create: gisItems
                }
            },
            include: {
                items: true,
                route: {
                    select: {
                        id: true,
                        name: true,
                        routeLength: true,
                        calculatedPoles: true
                    }
                }
            }
        });

        // ====================================================================
        // ALSO CREATE ProjectBOQItems so they appear in the BOQ tab & overview
        // ====================================================================
        const projectBOQItems = gisItems.map((item, idx) => ({
            projectId,
            itemCode: `${item.itemCode}-${String(idx + 1).padStart(2, '0')}`,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitRate: item.unitRate,
            amount: item.amount,
            category: item.itemCategory,
            remarks: item.sourceReference
        }));

        let boqItemsCreated = 0;
        if (projectBOQItems.length > 0) {
            // Delete any existing auto-generated BOQ items for this route before recreating
            // (to avoid duplicates on re-generation)
            const existingItems = await prisma.projectBOQItem.findMany({
                where: {
                    projectId,
                    remarks: { contains: "GIS auto" }
                }
            });

            if (existingItems.length > 0) {
                await prisma.projectBOQItem.deleteMany({
                    where: { id: { in: existingItems.map(i => i.id) } }
                });
            }

            await prisma.projectBOQItem.createMany({
                data: projectBOQItems
            });
            boqItemsCreated = projectBOQItems.length;
        }

        // Update project actualCost with newly generated BOQ total
        if (totalEstimated > 0) {
            await prisma.project.update({
                where: { id: projectId },
                data: {
                    budget: totalEstimated > 0 ? totalEstimated : undefined,
                }
            });
        }

        // Update GIS route status to BOQ_GENERATED
        await prisma.gISRoute.update({
            where: { id: routeId },
            data: { status: "BOQ_GENERATED" }
        });

        return NextResponse.json({
            ...boq,
            projectBOQItemsCreated: boqItemsCreated,
            message: `BOQ generated: ${gisItems.length} GIS items, ${boqItemsCreated} project BOQ items synced`
        }, { status: 201 });
    } catch (error) {
        console.error("Error generating BOQ from GIS route:", error);
        return NextResponse.json({ error: "Failed to generate BOQ" }, { status: 500 });
    }
}