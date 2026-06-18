import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch As-Planned vs As-Built progress for a GIS route
// Aggregates installation status of poles, chambers, closures, and cable segments
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; routeId: string }> }
) {
    try {
        const { id: projectId, routeId } = await params;

        const gisRoute = await prisma.gISRoute.findFirst({
            where: { id: routeId, projectId },
            include: {
                poles: {
                    select: { id: true, poleNumber: true, status: true, latitude: true, longitude: true, installationDate: true }
                },
                chambers: {
                    select: { id: true, chamberNumber: true, status: true, latitude: true, longitude: true, installationDate: true }
                },
                closures: {
                    select: { id: true, closureNumber: true, status: true, latitude: true, longitude: true, installationDate: true }
                },
                cableSegments: {
                    select: { id: true, segmentNumber: true, status: true, length: true }
                }
            }
        });

        if (!gisRoute) {
            return NextResponse.json({ error: "GIS route not found" }, { status: 404 });
        }

        // Status counts
        const countByStatus = (items: { status: string }[], status: string) =>
            items.filter(i => i.status === status).length;

        // Poles
        const poleStats = {
            total: gisRoute.poles.length,
            planned: countByStatus(gisRoute.poles, "PLANNED"),
            installed: countByStatus(gisRoute.poles, "INSTALLED"),
            verified: countByStatus(gisRoute.poles, "VERIFIED"),
            progressPercent: gisRoute.poles.length > 0
                ? Math.round((countByStatus(gisRoute.poles, "INSTALLED") + countByStatus(gisRoute.poles, "VERIFIED")) / gisRoute.poles.length * 100)
                : 0,
            items: gisRoute.poles
        };

        // Chambers
        const chamberStats = {
            total: gisRoute.chambers.length,
            planned: countByStatus(gisRoute.chambers, "PLANNED"),
            installed: countByStatus(gisRoute.chambers, "INSTALLED"),
            verified: countByStatus(gisRoute.chambers, "VERIFIED"),
            progressPercent: gisRoute.chambers.length > 0
                ? Math.round((countByStatus(gisRoute.chambers, "INSTALLED") + countByStatus(gisRoute.chambers, "VERIFIED")) / gisRoute.chambers.length * 100)
                : 0,
            items: gisRoute.chambers
        };

        // Closures
        const closureStats = {
            total: gisRoute.closures.length,
            planned: countByStatus(gisRoute.closures, "PLANNED"),
            installed: countByStatus(gisRoute.closures, "INSTALLED"),
            verified: countByStatus(gisRoute.closures, "VERIFIED"),
            progressPercent: gisRoute.closures.length > 0
                ? Math.round((countByStatus(gisRoute.closures, "INSTALLED") + countByStatus(gisRoute.closures, "VERIFIED")) / gisRoute.closures.length * 100)
                : 0,
            items: gisRoute.closures
        };

        // Cable Segments (PLANNED / INSTALLED)
        const cableStats = {
            total: gisRoute.cableSegments.length,
            totalLength: gisRoute.cableSegments.reduce((sum, s) => sum + (s.length || 0), 0),
            installedLength: gisRoute.cableSegments
                .filter(s => s.status === "INSTALLED")
                .reduce((sum, s) => sum + (s.length || 0), 0),
            planned: countByStatus(gisRoute.cableSegments, "PLANNED"),
            installed: countByStatus(gisRoute.cableSegments, "INSTALLED"),
            progressPercent: gisRoute.cableSegments.length > 0
                ? Math.round(countByStatus(gisRoute.cableSegments, "INSTALLED") / gisRoute.cableSegments.length * 100)
                : 0,
            items: gisRoute.cableSegments
        };

        // Overall route progress
        const totalElements = gisRoute.poles.length + gisRoute.chambers.length + gisRoute.closures.length + gisRoute.cableSegments.length;
        const totalInstalled =
            countByStatus(gisRoute.poles, "INSTALLED") + countByStatus(gisRoute.poles, "VERIFIED") +
            countByStatus(gisRoute.chambers, "INSTALLED") + countByStatus(gisRoute.chambers, "VERIFIED") +
            countByStatus(gisRoute.closures, "INSTALLED") + countByStatus(gisRoute.closures, "VERIFIED") +
            countByStatus(gisRoute.cableSegments, "INSTALLED");

        const overallProgress = totalElements > 0
            ? Math.round((totalInstalled / totalElements) * 100)
            : 0;

        // Variance tracking
        const plannedPoles = gisRoute.calculatedPoles || gisRoute.poles.length;
        const installedPoles = countByStatus(gisRoute.poles, "INSTALLED") + countByStatus(gisRoute.poles, "VERIFIED");
        const poleVariance = plannedPoles - installedPoles;

        const routeLengthMeters = gisRoute.routeLength || 0;
        const installedCableLength = gisRoute.cableSegments
            .filter(s => s.status === "INSTALLED")
            .reduce((sum, s) => sum + (s.length || 0), 0);

        return NextResponse.json({
            routeId,
            routeName: gisRoute.name,
            overallProgress,
            totalElements,
            totalInstalled,
            poleStats,
            chamberStats,
            closureStats,
            cableStats,
            variance: {
                plannedPoles,
                installedPoles,
                poleVariance,
                plannedRouteLengthMeters: routeLengthMeters,
                installedCableLengthMeters: installedCableLength,
                cableLengthVarianceMeters: routeLengthMeters - installedCableLength
            },
            status: gisRoute.status,
            asBuiltComplete: overallProgress === 100
        });
    } catch (error) {
        console.error("Error fetching GIS route progress:", error);
        return NextResponse.json({ error: "Failed to fetch route progress" }, { status: 500 });
    }
}

// PATCH: Update status of individual GIS elements (bulk update)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; routeId: string }> }
) {
    try {
        const { id: projectId, routeId } = await params;
        const body = await request.json();
        const { elementType, elementIds, status, installationDate } = body;

        if (!elementType || !elementIds || !Array.isArray(elementIds) || elementIds.length === 0) {
            return NextResponse.json({ error: "elementType and elementIds array are required" }, { status: 400 });
        }

        if (!status || !["PLANNED", "INSTALLED", "VERIFIED"].includes(status)) {
            return NextResponse.json({ error: "Valid status is required: PLANNED, INSTALLED, or VERIFIED" }, { status: 400 });
        }

        // Verify route ownership
        const gisRoute = await prisma.gISRoute.findFirst({
            where: { id: routeId, projectId },
            select: { id: true }
        });

        if (!gisRoute) {
            return NextResponse.json({ error: "GIS route not found" }, { status: 404 });
        }

        let updatedCount = 0;
        const updateData: any = { status };
        if (installationDate) {
            updateData.installationDate = new Date(installationDate);
        }

        switch (elementType) {
            case "POLE":
                const poleResult = await prisma.gISPole.updateMany({
                    where: { id: { in: elementIds }, routeId },
                    data: updateData
                });
                updatedCount = poleResult.count;
                break;
            case "CHAMBER":
                const chamberResult = await prisma.gISChamber.updateMany({
                    where: { id: { in: elementIds }, routeId },
                    data: updateData
                });
                updatedCount = chamberResult.count;
                break;
            case "CLOSURE":
                const closureResult = await prisma.gISClosure.updateMany({
                    where: { id: { in: elementIds }, routeId },
                    data: updateData
                });
                updatedCount = closureResult.count;
                break;
            case "CABLE":
                const cableResult = await prisma.gISCableSegment.updateMany({
                    where: { id: { in: elementIds }, routeId },
                    data: updateData
                });
                updatedCount = cableResult.count;
                break;
            default:
                return NextResponse.json({ error: "Invalid elementType. Must be POLE, CHAMBER, CLOSURE, or CABLE" }, { status: 400 });
        }

        // Check if all elements are installed and update route status if so
        if (status === "INSTALLED" || status === "VERIFIED") {
            const route = await prisma.gISRoute.findFirst({
                where: { id: routeId },
                include: {
                    poles: { select: { status: true } },
                    chambers: { select: { status: true } },
                    closures: { select: { status: true } },
                    cableSegments: { select: { status: true } }
                }
            });

            if (route) {
                const allElements = [
                    ...route.poles,
                    ...route.chambers,
                    ...route.closures,
                    ...route.cableSegments
                ];
                const allInstalled = allElements.length > 0 &&
                    allElements.every(e => e.status === "INSTALLED" || e.status === "VERIFIED");

                if (allInstalled && route.status !== "BOQ_GENERATED") {
                    // Optionally auto-promote route status
                }
            }
        }

        return NextResponse.json({
            updatedCount,
            message: `Updated ${updatedCount} ${elementType}(s) to ${status}`
        });
    } catch (error) {
        console.error("Error updating GIS element status:", error);
        return NextResponse.json({ error: "Failed to update element status" }, { status: 500 });
    }
}