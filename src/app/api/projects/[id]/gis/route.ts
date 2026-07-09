import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GISAuditService } from "@/services/gis-audit.service";

export const dynamic = 'force-dynamic';

// GET: List GIS routes for project with poles count
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        const gisRoutes = await prisma.gISRoute.findMany({
            where: { projectId },
            include: {
                _count: {
                    select: {
                        poles: true,
                        chambers: true,
                        closures: true,
                        cableSegments: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json(gisRoutes);
    } catch (error) {
        console.error("Error fetching GIS routes:", error);
        return NextResponse.json({ error: "Failed to fetch GIS routes" }, { status: 500 });
    }
}

// POST: Create a GIS route
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { name, description, routeLength, poleSpacing, sourceFile, sourceFormat, geojsonData, metadata, createdById } = body;

        if (!name) {
            return NextResponse.json({ error: "GIS route name is required" }, { status: 400 });
        }

        const calculatedPoles = routeLength && poleSpacing
            ? Math.ceil(parseFloat(routeLength) / parseFloat(poleSpacing))
            : null;

        const gisRoute = await prisma.gISRoute.create({
            data: {
                projectId,
                name,
                description: description || null,
                routeLength: routeLength ? parseFloat(routeLength) : null,
                poleSpacing: poleSpacing ? parseFloat(poleSpacing) : null,
                calculatedPoles,
                sourceFile: sourceFile || null,
                sourceFormat: sourceFormat || null,
                geojsonData: geojsonData || null,
                metadata: metadata || null,
                createdById: createdById || null,
                status: "DRAFT"
            },
            include: {
                _count: {
                    select: {
                        poles: true,
                        chambers: true,
                        closures: true,
                        cableSegments: true
                    }
                }
            }
        });

        // Write audit log
        const performedById = createdById || request.headers.get('x-user-id') || 'unknown';
        await GISAuditService.logChange({
            projectId,
            entityType: 'GISRoute',
            entityId: gisRoute.id,
            action: 'ROUTE_CREATED',
            performedById,
            routeVersion: gisRoute.version,
            source: 'WEB_PORTAL'
        }).catch((e) => console.error('Audit log failed on route create:', e));

        return NextResponse.json(gisRoute, { status: 201 });
    } catch (error) {
        console.error("Error creating GIS route:", error);
        return NextResponse.json({ error: "Failed to create GIS route" }, { status: 500 });
    }
}
