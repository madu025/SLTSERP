import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string; routeId: string }> }
) {
    try {
        const { id: projectId, routeId } = await params;
        const route = await prisma.gISRoute.findUnique({
            where: { id: routeId },
            include: { versions: { orderBy: { version: "desc" } } }
        });
        if (!route || route.id !== routeId) {
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
        const { routeId } = await params;
        const body = await request.json();
        const { routeName, geoJson, length, description, isActive } = body;
        const route = await prisma.gISRoute.update({
            where: { id: routeId },
            data: {
                routeName: routeName ?? undefined,
                geoJson: geoJson ?? undefined,
                length: length ?? undefined,
                description: description ?? undefined,
                isActive: isActive ?? undefined
            }
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
        const { routeId } = await params;
        await prisma.gISRoute.delete({ where: { id: routeId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting GIS route:", error);
        return NextResponse.json({ error: "Failed to delete route" }, { status: 500 });
    }
}