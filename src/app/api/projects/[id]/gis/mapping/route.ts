import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch the project's GIS material mappings and available inventory items
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, gisMapping: true }
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Fetch inventory items suitable for GIS material mapping
        // (Poles, Cable, Chambers, Closures, and related OSP materials)
        const inventoryItems = await prisma.inventoryItem.findMany({
            where: {
                OR: [
                    { category: "OSP" },
                    { name: { contains: "Pole", mode: "insensitive" } },
                    { name: { contains: "Cable", mode: "insensitive" } },
                    { name: { contains: "Fiber", mode: "insensitive" } },
                    { name: { contains: "Chamber", mode: "insensitive" } },
                    { name: { contains: "Closure", mode: "insensitive" } },
                    { name: { contains: "Splice", mode: "insensitive" } },
                    { name: { contains: "Manhole", mode: "insensitive" } },
                    { name: { contains: "Duct", mode: "insensitive" } },
                    { code: { contains: "POLE", mode: "insensitive" } },
                    { code: { contains: "CBL", mode: "insensitive" } },
                    { code: { contains: "CHMB", mode: "insensitive" } },
                    { code: { contains: "CLSR", mode: "insensitive" } },
                ]
            },
            select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                unitPrice: true,
                category: true,
                description: true,
            },
            orderBy: { name: "asc" },
            take: 200
        });

        // Return current mappings (may be null) and available items
        const mappings = (project.gisMapping as Record<string, {
            materialId: string;
            itemCode?: string;
            name?: string;
            unitPrice?: number;
            updatedAt?: string;
        }> | null) || {};

        return NextResponse.json({
            mappings,
            inventoryItems
        });
    } catch (error) {
        console.error("Error fetching GIS mappings:", error);
        return NextResponse.json({ error: "Failed to fetch GIS mappings" }, { status: 500 });
    }
}

// POST: Save the project's GIS material mappings
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { mappings } = body;

        if (!mappings || typeof mappings !== "object") {
            return NextResponse.json({ error: "Invalid mappings data" }, { status: 400 });
        }

        // Validate that each mapping has a valid materialId
        for (const [category, mapping] of Object.entries(mappings)) {
            const m = mapping as any;
            if (!m?.materialId) {
                return NextResponse.json(
                    { error: `Missing materialId for category "${category}"` },
                    { status: 400 }
                );
            }
        }

        // Fetch current inventory items to enrich the mapping data
        const materialIds = Object.values(mappings).map((m: any) => m.materialId);
        const inventoryItems = await prisma.inventoryItem.findMany({
            where: { id: { in: materialIds } },
            select: { id: true, code: true, name: true, unitPrice: true }
        });

        const itemMap = new Map(inventoryItems.map(i => [i.id, i]));

        // Build enriched mapping object with item details for fast lookups
        const enrichedMappings: Record<string, {
            materialId: string;
            itemCode: string;
            name: string;
            unitPrice: number;
            updatedAt: string;
        }> = {};

        for (const [category, mapping] of Object.entries(mappings)) {
            const m = mapping as any;
            const item = itemMap.get(m.materialId);
            enrichedMappings[category] = {
                materialId: m.materialId,
                itemCode: item?.code || "",
                name: item?.name || "",
                unitPrice: item?.unitPrice || 0,
                updatedAt: new Date().toISOString()
            };
        }

        // Save to Project.gisMapping JSON field — merge with existing to preserve qfieldProjectId
        const existingProject = await prisma.project.findUnique({
            where: { id: projectId },
            select: { gisMapping: true }
        });
        const existingGisMapping = (existingProject?.gisMapping as Record<string, unknown> | null) || {};
        const mergedMapping = { ...existingGisMapping, ...enrichedMappings };

        await prisma.project.update({
            where: { id: projectId },
            data: { gisMapping: mergedMapping }
        });

        return NextResponse.json({
            mappings: enrichedMappings,
            message: "GIS material mappings saved successfully"
        });
    } catch (error) {
        console.error("Error saving GIS mappings:", error);
        return NextResponse.json({ error: "Failed to save GIS mappings" }, { status: 500 });
    }
}