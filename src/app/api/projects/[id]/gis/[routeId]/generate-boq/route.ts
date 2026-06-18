import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateProgressOnBOQGenerate } from "@/lib/project-progress";

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

        // ====================================================================
        // LOAD PROJECT-LEVEL GIS MATERIAL MAPPING (if configured)
        // ====================================================================
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { gisMapping: true }
        });

        type MappingEntry = {
            materialId: string;
            itemCode: string;
            name: string;
            unitPrice: number;
        };
        const gisMapping = (project?.gisMapping as Record<string, MappingEntry> | null) || {};

        // Fetch inventory items for unit rates + stock (try explicit mappings first, fallback to keyword lookup)
        const mappedMaterialIds = Object.values(gisMapping)
            .map((m: MappingEntry) => m.materialId)
            .filter(Boolean);

        const inventoryItems = await prisma.inventoryItem.findMany({
            where: mappedMaterialIds.length > 0
                ? { id: { in: mappedMaterialIds } }
                : {
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
            include: {
                stocks: true,
            },
            take: 50
        });

        // Build a lookup map by materialId for fast access
        const inventoryById = new Map(inventoryItems.map(i => [i.id, i]));

        // Helper to get mapped inventory item for a category
        const getMappedItem = (category: string): (typeof inventoryItems)[number] | undefined => {
            const mapping = gisMapping[category] as MappingEntry | undefined;
            if (mapping?.materialId) {
                const item = inventoryById.get(mapping.materialId);
                if (item) return item;
            }
            // Fallback: keyword search
            const keywords = category === "POLE" ? ["pole", "wooden", "concrete"]
                : category === "CHAMBER" ? ["chamber", "manhole"]
                : category === "CLOSURE" ? ["closure", "splice"]
                : category === "CABLE" ? ["fiber", "cable"]
                : [];
            return inventoryItems.find((item) =>
                keywords.some((kw) =>
                    item.name?.toLowerCase().includes(kw.toLowerCase()) ||
                    item.code?.toLowerCase().includes(kw.toLowerCase())
                )
            );
        };

        // Helper to get unit rate from mapped item or fallback
        const getRate = (category: string): number => {
            const item = getMappedItem(category);
            return item?.unitPrice || 0;
        };

        // Build available stock map by BOQ category.
        // Sums stock across all stores for each mapped/fallback inventory item.
        const stockByCategory = new Map<string, { availableQty: number; itemCode: string; materialId: string }>();
        for (const category of ["POLE", "CHAMBER", "CLOSURE", "CABLE"]) {
            const inv = getMappedItem(category);
            if (inv) {
                const qty = inv.stocks.reduce((s, st) => s + (st.quantity || 0), 0);
                stockByCategory.set(category, { availableQty: qty, itemCode: inv.code, materialId: inv.id });
            }
        }

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

        // Helper to build description from mapped item
        const getDescription = (category: string, fallback: string): string => {
            const mapping = gisMapping[category] as MappingEntry | undefined;
            return mapping?.name || fallback;
        };

        // Helper to get itemCode from mapped item
        const getItemCode = (category: string, fallback: string): string => {
            const mapping = gisMapping[category] as MappingEntry | undefined;
            return mapping?.itemCode || fallback;
        };

        // Helper to get unit from mapped item
        const getUnit = (category: string, fallback: string): string => {
            const item = getMappedItem(category);
            return item?.unit || fallback;
        };

        // Pole items
        const poleRate = getRate("POLE");
        if (poleCount > 0) {
            const amount = poleCount * poleRate;
            gisItems.push({
                itemCategory: "POLE",
                itemCode: getItemCode("POLE", "POLE-001"),
                description: getDescription("POLE", "Fiber Optic Pole - Wooden/Concrete"),
                unit: getUnit("POLE", "Nos"),
                quantity: poleCount,
                unitRate: poleRate,
                amount,
                sourceType: gisMapping["POLE"] ? "MAPPED" : "AUTO_CALCULATED",
                sourceReference: `GIS auto-count: ${poleCount} poles`
            });
        }

        // Chamber items
        const chamberRate = getRate("CHAMBER");
        if (chamberCount > 0) {
            const amount = chamberCount * chamberRate;
            gisItems.push({
                itemCategory: "CHAMBER",
                itemCode: getItemCode("CHAMBER", "CHMB-001"),
                description: getDescription("CHAMBER", "Fiber Optic Chamber / Manhole"),
                unit: getUnit("CHAMBER", "Nos"),
                quantity: chamberCount,
                unitRate: chamberRate,
                amount,
                sourceType: gisMapping["CHAMBER"] ? "MAPPED" : "AUTO_CALCULATED",
                sourceReference: `GIS auto-count: ${chamberCount} chambers`
            });
        }

        // Closure items
        const closureRate = getRate("CLOSURE");
        if (closureCount > 0) {
            const amount = closureCount * closureRate;
            gisItems.push({
                itemCategory: "CLOSURE",
                itemCode: getItemCode("CLOSURE", "CLSR-001"),
                description: getDescription("CLOSURE", "Fiber Optic Splice Closure"),
                unit: getUnit("CLOSURE", "Nos"),
                quantity: closureCount,
                unitRate: closureRate,
                amount,
                sourceType: gisMapping["CLOSURE"] ? "MAPPED" : "AUTO_CALCULATED",
                sourceReference: `GIS auto-count: ${closureCount} closures`
            });
        }

        // Cable segment items
        const cableRate = getRate("CABLE");
        if (cableSegmentCount > 0) {
            const amount = totalCableLength * cableRate;
            gisItems.push({
                itemCategory: "CABLE",
                itemCode: getItemCode("CABLE", "CBL-001"),
                description: getDescription("CABLE", "Fiber Optic Cable"),
                unit: getUnit("CABLE", "Meters"),
                quantity: totalCableLength,
                unitRate: cableRate,
                amount,
                sourceType: gisMapping["CABLE"] ? "MAPPED" : "AUTO_CALCULATED",
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
        // Categorize each item as EXISTING (in stock) or NEW (to procure) based
        // on available inventory quantities.
        // ====================================================================
        const projectBOQItems = gisItems.map((item, idx) => {
            const stockInfo = stockByCategory.get(item.itemCategory);
            let source: "EXISTING" | "NEW" = "NEW";
            let materialId: string | undefined;
            let remarks = item.sourceReference;

            if (stockInfo && stockInfo.availableQty >= item.quantity) {
                // Enough stock available in inventory — mark as EXISTING
                source = "EXISTING";
                materialId = stockInfo.materialId;
                remarks = `${item.sourceReference} | Available in stock: ${stockInfo.availableQty} ${item.unit} (${stockInfo.itemCode})`;
            } else if (stockInfo && stockInfo.availableQty > 0) {
                // Partial stock — still NEW (procurement needed) but note partial availability
                source = "NEW";
                materialId = stockInfo.materialId;
                remarks = `${item.sourceReference} | Partial stock: ${stockInfo.availableQty}/${item.quantity} ${item.unit} available (${stockInfo.itemCode})`;
            } else {
                // No stock — must procure
                source = "NEW";
                remarks = `${item.sourceReference} | No stock available — procurement required`;
            }

            return {
                projectId,
                itemCode: `${item.itemCode}-${String(idx + 1).padStart(2, '0')}`,
                description: item.description,
                unit: item.unit,
                quantity: item.quantity,
                unitRate: item.unitRate,
                amount: item.amount,
                category: item.itemCategory,
                source,
                materialId: materialId || null,
                remarks
            };
        });

        // Tally for response messaging
        const existingCount = projectBOQItems.filter(i => i.source === "EXISTING").length;
        const newCount = projectBOQItems.filter(i => i.source === "NEW").length;

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

        // Auto-update project progress after BOQ generation
        await updateProgressOnBOQGenerate(projectId);

        return NextResponse.json({
            ...boq,
            projectBOQItemsCreated: boqItemsCreated,
            sourceBreakdown: { existing: existingCount, new: newCount },
            message: `BOQ generated: ${gisItems.length} GIS items, ${boqItemsCreated} project BOQ items synced (${existingCount} existing in stock, ${newCount} to procure)`
        }, { status: 201 });
    } catch (error) {
        console.error("Error generating BOQ from GIS route:", error);
        return NextResponse.json({ error: "Failed to generate BOQ" }, { status: 500 });
    }
}