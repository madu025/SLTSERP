import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: List permits for a project with relations to permitType and authority
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");

        const where: Record<string, unknown> = { projectId };
        if (status) {
            where.status = status;
        }

        const permits = await prisma.projectPermit.findMany({
            where,
            include: {
                permitType: {
                    include: {
                        authority: {
                            select: {
                                id: true,
                                name: true,
                                shortName: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        permitDocuments: true,
                        approvalSteps: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json(permits);
    } catch (error) {
        console.error("Error fetching permits:", error);
        return NextResponse.json({ error: "Failed to fetch permits" }, { status: 500 });
    }
}

// POST: Create a new permit for the project
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { permitTypeId, applicationDate, cost, remarks, appliedById } = body;

        if (!permitTypeId) {
            return NextResponse.json({ error: "permitTypeId is required" }, { status: 400 });
        }

        const permit = await prisma.projectPermit.create({
            data: {
                projectId,
                permitTypeId,
                status: "DRAFT",
                applicationDate: applicationDate ? new Date(applicationDate) : null,
                cost: cost ? parseFloat(cost) : null,
                remarks: remarks || null,
                appliedById: appliedById || null
            },
            include: {
                permitType: {
                    include: {
                        authority: {
                            select: {
                                id: true,
                                name: true,
                                shortName: true
                            }
                        }
                    }
                }
            }
        });

        return NextResponse.json(permit, { status: 201 });
    } catch (error) {
        console.error("Error creating permit:", error);
        return NextResponse.json({ error: "Failed to create permit" }, { status: 500 });
    }
}
