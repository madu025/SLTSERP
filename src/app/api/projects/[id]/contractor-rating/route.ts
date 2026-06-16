import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: List contractor performance scores, optionally filter by evaluationMonth
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const { searchParams } = new URL(request.url);
        const evaluationMonth = searchParams.get("evaluationMonth");

        const where: Record<string, unknown> = { projectId };
        if (evaluationMonth) {
            where.evaluationMonth = evaluationMonth;
        }

        const scores = await prisma.contractorPerformanceScore.findMany({
            where,
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        contactNumber: true,
                        registrationNumber: true
                    }
                }
            },
            orderBy: [{ evaluationMonth: "desc" }, { score: "desc" }]
        });

        return NextResponse.json(scores);
    } catch (error) {
        console.error("Error fetching contractor performance scores:", error);
        return NextResponse.json({ error: "Failed to fetch contractor performance scores" }, { status: 500 });
    }
}

// POST: Create or update contractor performance score (upsert by contractorId + evaluationMonth)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const {
            contractorId,
            evaluationMonth,
            score,
            productivityScore,
            qualityScore,
            safetyScore,
            slaComplianceScore,
            scheduleScore,
            ncrCount,
            ncrClosedCount,
            hseIncidentCount,
            completedTasksCount,
            delayedTasksCount,
            totalTasksAssigned,
            averageRating,
            inspectionCount,
            inspectionPassCount,
            evaluatedById,
            notes
        } = body;

        if (!contractorId || !evaluationMonth) {
            return NextResponse.json(
                { error: "contractorId and evaluationMonth are required" },
                { status: 400 }
            );
        }

        const data: any = {
            projectId,
            contractorId,
            evaluationMonth,
            score: score !== undefined ? parseFloat(score) : 0,
            productivityScore: productivityScore !== undefined ? parseFloat(productivityScore) : null,
            qualityScore: qualityScore !== undefined ? parseFloat(qualityScore) : null,
            safetyScore: safetyScore !== undefined ? parseFloat(safetyScore) : null,
            slaComplianceScore: slaComplianceScore !== undefined ? parseFloat(slaComplianceScore) : null,
            scheduleScore: scheduleScore !== undefined ? parseFloat(scheduleScore) : null,
            ncrCount: ncrCount !== undefined ? parseInt(ncrCount) : 0,
            ncrClosedCount: ncrClosedCount !== undefined ? parseInt(ncrClosedCount) : 0,
            hseIncidentCount: hseIncidentCount !== undefined ? parseInt(hseIncidentCount) : 0,
            completedTasksCount: completedTasksCount !== undefined ? parseInt(completedTasksCount) : 0,
            delayedTasksCount: delayedTasksCount !== undefined ? parseInt(delayedTasksCount) : 0,
            totalTasksAssigned: totalTasksAssigned !== undefined ? parseInt(totalTasksAssigned) : 0,
            averageRating: averageRating !== undefined ? parseFloat(averageRating) : null,
            inspectionCount: inspectionCount !== undefined ? parseInt(inspectionCount) : 0,
            inspectionPassCount: inspectionPassCount !== undefined ? parseInt(inspectionPassCount) : 0,
            evaluatedById: evaluatedById || null,
            notes: notes || null
        };

        // Upsert: create or update by contractorId + evaluationMonth unique constraint
        const scoreRecord = await prisma.contractorPerformanceScore.upsert({
            where: {
                contractorId_evaluationMonth: {
                    contractorId,
                    evaluationMonth
                }
            },
            create: data,
            update: data,
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        contactNumber: true,
                        registrationNumber: true
                    }
                }
            }
        });

        return NextResponse.json(scoreRecord, { status: 201 });
    } catch (error: any) {
        console.error("Error saving contractor performance score:", error);
        if (error.code === "P2002") {
            return NextResponse.json(
                { error: "Performance score already exists for this contractor and month" },
                { status: 400 }
            );
        }
        return NextResponse.json({ error: "Failed to save contractor performance score" }, { status: 500 });
    }
}
