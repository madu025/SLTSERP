import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GISAuditService } from "@/services/gis-audit.service";

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string; routeId: string }> }
) {
    try {
        const { routeId } = await params;

        const route = await prisma.gISRoute.findUnique({
            where: { id: routeId },
            include: {
                poles: {
                    orderBy: { poleNumber: 'asc' }
                },
                chambers: true,
                closures: {
                    orderBy: { closureNumber: 'asc' }
                },
                cableSegments: {
                    orderBy: { segmentNumber: 'asc' }
                },
                generatedBOQs: true
            }
        });

        if (!route) {
            return NextResponse.json({ error: "Route not found" }, { status: 404 });
        }

        return NextResponse.json(route);
    } catch (error) {
        console.error("Error fetching GIS route:", error);
        return NextResponse.json({ error: "Failed to fetch route" }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; routeId: string }> }
) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: projectId, routeId } = await params;
        const body = await request.json();
        const { name, description, routeLength, poleSpacing, status, geojsonData, isActive } = body;

        // Fetch current state before update for audit diff
        const before = await prisma.gISRoute.findUnique({ where: { id: routeId } });

        const route = await prisma.gISRoute.update({
            where: { id: routeId },
            data: {
                name: name ?? undefined,
                description: description ?? undefined,
                routeLength: routeLength ?? undefined,
                poleSpacing: poleSpacing ?? undefined,
                status: status ?? undefined,
                geojsonData: geojsonData ?? undefined,
                isActive: isActive ?? undefined
            }
        });

        // Build field change diff for audit log
        const fieldChanges: Record<string, { oldValue: unknown; newValue: unknown }>[] = [];
        if (before) {
            if (name !== undefined && before.name !== name) fieldChanges.push({ name: { oldValue: before.name, newValue: name } });
            if (status !== undefined && before.status !== status) fieldChanges.push({ status: { oldValue: before.status, newValue: status } });
            if (routeLength !== undefined && before.routeLength !== routeLength) fieldChanges.push({ routeLength: { oldValue: before.routeLength, newValue: routeLength } });
            if (isActive !== undefined && before.isActive !== isActive) fieldChanges.push({ isActive: { oldValue: before.isActive, newValue: isActive } });
        }

        // Write audit log
        await GISAuditService.logChange({
            projectId,
            entityType: 'GISRoute',
            entityId: routeId,
            action: 'ROUTE_UPDATED',
            performedById: userId,
            fieldChanges: fieldChanges.length > 0 ? fieldChanges : undefined,
            routeVersion: route.version,
            source: 'WEB_PORTAL'
        });

        return NextResponse.json(route);
    } catch (error) {
        console.error("Error updating GIS route:", error);
        return NextResponse.json({ error: "Failed to update route" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; routeId: string }> }
) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: projectId, routeId } = await params;

        // Fetch route info before deletion for audit record
        const route = await prisma.gISRoute.findUnique({ where: { id: routeId } });

        // Delete related child entities in correct order via transaction to prevent foreign key violations
        await prisma.$transaction(async (tx) => {
            // Nullify OTDR test references first
            await tx.oTDRTest.updateMany({
                where: {
                    cableSegment: {
                        routeId: routeId
                    }
                },
                data: {
                    cableSegmentId: null
                }
            });

            await tx.gISGeneratedBOQItem.deleteMany({
                where: { generatedBOQ: { routeId } }
            });
            await tx.gISGeneratedBOQ.deleteMany({
                where: { routeId }
            });
            await tx.gISCableSegment.deleteMany({
                where: { routeId }
            });
            await tx.gISPole.deleteMany({
                where: { routeId }
            });
            await tx.gISClosure.deleteMany({
                where: { routeId }
            });
            await tx.gISChamber.deleteMany({
                where: { routeId }
            });
            await tx.gISRoute.delete({
                where: { id: routeId }
            });
        });

        // Write audit log (fire-and-forget — route is deleted, best effort)
        await GISAuditService.logChange({
            projectId,
            entityType: 'GISRoute',
            entityId: routeId,
            action: 'ROUTE_DELETED',
            performedById: userId,
            routeVersion: route?.version,
            source: 'WEB_PORTAL'
        }).catch((e) => console.error('Audit log failed after delete:', e));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting GIS route:", error);
        return NextResponse.json({ error: "Failed to delete route" }, { status: 500 });
    }
}