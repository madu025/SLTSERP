import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST: Generate BOQ from GIS route - auto-calculate quantities and create GISGeneratedBOQ with items
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

        // Build auto-calculated BOQ items
        const items: Array<{
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
        if (poleCount > 0) {
            items.push({
                itemCategory: "POLE",
                itemCode: "POLE-001",
                description: "Fiber Optic Pole - Wooden/Concrete",
                unit: "Nos",
                quantity: poleCount,
                unitRate: 0,
                amount: 0,
                sourceType: "AUTO_CALCULATED",
                sourceReference: `GIS auto-count: ${poleCount} poles`
            });
        }

        // Chamber items
        if (chamberCount > 0) {
            items.push({
                itemCategory: "CHAMBER",
                itemCode: "CHMB-001",
                description: "Fiber Optic Chamber / Manhole",
                unit: "Nos",
                quantity: chamberCount,
                unitRate: 0,
                amount: 0,
                sourceType: "AUTO_CALCULATED",
                sourceReference: `GIS auto-count: ${chamberCount} chambers`
            });
        }

        // Closure items
        if (closureCount > 0) {
            items.push({
                itemCategory: "CLOSURE",
                itemCode: "CLSR-001",
                description: "Fiber Optic Splice Closure",
                unit: "Nos",
                quantity: closureCount,
                unitRate: 0,
                amount: 0,
                sourceType: "AUTO_CALCULATED",
                sourceReference: `GIS auto-count: ${closureCount} closures`
            });
        }

        // Cable segment items
        if (cableSegmentCount > 0) {
            items.push({
                itemCategory: "CABLE",
                itemCode: "CBL-001",
                description: "Fiber Optic Cable",
                unit: "Meters",
                quantity: totalCableLength,
                unitRate: 0,
                amount: 0,
                sourceType: "AUTO_CALCULATED",
                sourceReference: `GIS auto-sum: ${cableSegmentCount} segments totaling ${totalCableLength}m`
            });
        }

        const totalEstimated = items.reduce((sum, item) => sum + item.amount, 0);

        // Create GISGeneratedBOQ with items
        const boq = await prisma.gISGeneratedBOQ.create({
            data: {
                routeId,
                projectId,
                status: "DRAFT",
                totalEstimated,
                notes: notes || null,
                createdById: body.createdById || null,
                items: {
                    create: items
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

        // Update GIS route status to BOQ_GENERATED
        await prisma.gISRoute.update({
            where: { id: routeId },
            data: { status: "BOQ_GENERATED" }
        });

        return NextResponse.json(boq, { status: 201 });
    } catch (error) {
        console.error("Error generating BOQ from GIS route:", error);
        return NextResponse.json({ error: "Failed to generate BOQ" }, { status: 500 });
    }
}
