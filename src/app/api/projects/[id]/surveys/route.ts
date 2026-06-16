import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: List survey requests with checkins, photos, findings count
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const surveyType = searchParams.get("surveyType");

        const where: Record<string, unknown> = { projectId };
        if (status) where.status = status;
        if (surveyType) where.surveyType = surveyType;

        const surveys = await prisma.surveyRequest.findMany({
            where,
            include: {
                _count: {
                    select: {
                        checkins: true,
                        photos: true,
                        findings: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json(surveys);
    } catch (error) {
        console.error("Error fetching surveys:", error);
        return NextResponse.json({ error: "Failed to fetch surveys" }, { status: 500 });
    }
}

// POST: Create survey request with auto-generated requestNumber (SRV-{year}-{sequential})
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { title, description, surveyType, priority, assignedTeamId, assignedToId, scheduledDate, estimatedBOQ, createdById } = body;

        if (!title || !surveyType || !createdById) {
            return NextResponse.json({ error: "title, surveyType, and createdById are required" }, { status: 400 });
        }

        // Auto-generate requestNumber: SRV-{year}-{sequential}
        const year = new Date().getFullYear().toString();
        const lastSurvey = await prisma.surveyRequest.findFirst({
            where: {
                requestNumber: { startsWith: `SRV-${year}-` }
            },
            orderBy: { requestNumber: "desc" },
            select: { requestNumber: true }
        });

        let nextSeq = 1;
        if (lastSurvey) {
            const parts = lastSurvey.requestNumber.split("-");
            const lastSeq = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastSeq)) {
                nextSeq = lastSeq + 1;
            }
        }

        const requestNumber = `SRV-${year}-${String(nextSeq).padStart(4, "0")}`;

        const survey = await prisma.surveyRequest.create({
            data: {
                projectId,
                requestNumber,
                title,
                description: description || null,
                surveyType,
                priority: priority || "MEDIUM",
                status: "PENDING",
                assignedTeamId: assignedTeamId || null,
                assignedToId: assignedToId || null,
                scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
                estimatedBOQ: estimatedBOQ ? parseFloat(estimatedBOQ) : null,
                createdById
            },
            include: {
                _count: {
                    select: {
                        checkins: true,
                        photos: true,
                        findings: true
                    }
                }
            }
        });

        return NextResponse.json(survey, { status: 201 });
    } catch (error) {
        console.error("Error creating survey request:", error);
        return NextResponse.json({ error: "Failed to create survey request" }, { status: 500 });
    }
}
