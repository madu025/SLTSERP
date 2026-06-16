import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch a single permit with documents, approvalSteps, permitType, authority
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; permitId: string }> }
) {
    try {
        const { id: projectId, permitId } = await params;

        const permit = await prisma.projectPermit.findFirst({
            where: {
                id: permitId,
                projectId
            },
            include: {
                permitType: {
                    include: {
                        authority: {
                            select: {
                                id: true,
                                name: true,
                                shortName: true,
                                contactPerson: true,
                                contactNumber: true,
                                email: true,
                                address: true
                            }
                        }
                    }
                },
                permitDocuments: {
                    orderBy: { uploadedAt: "desc" }
                },
                approvalSteps: {
                    orderBy: { stepNumber: "asc" }
                }
            }
        });

        if (!permit) {
            return NextResponse.json({ error: "Permit not found" }, { status: 404 });
        }

        return NextResponse.json(permit);
    } catch (error) {
        console.error("Error fetching permit:", error);
        return NextResponse.json({ error: "Failed to fetch permit" }, { status: 500 });
    }
}

// PATCH: Update permit status, permitNumber, expiryDate, etc.
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; permitId: string }> }
) {
    try {
        const { id: projectId, permitId } = await params;
        const body = await request.json();

        const existing = await prisma.projectPermit.findFirst({
            where: { id: permitId, projectId }
        });

        if (!existing) {
            return NextResponse.json({ error: "Permit not found" }, { status: 404 });
        }
        const updateData: Record<string, unknown> = {};
        if (body.status) updateData.status = body.status;
        if (body.permitNumber) updateData.permitNumber = body.permitNumber;
        if (body.submittedDate) updateData.submittedDate = new Date(body.submittedDate);
        if (body.approvedDate) updateData.approvedDate = new Date(body.approvedDate);
        if (body.expiryDate) updateData.expiryDate = new Date(body.expiryDate);
        if (body.rejectionReason !== undefined) updateData.rejectionReason = body.rejectionReason;
        if (body.approvalDocument) updateData.approvalDocument = body.approvalDocument;
        if (body.approvedById) updateData.approvedById = body.approvedById;
        if (body.cost) updateData.cost = parseFloat(body.cost);
        if (body.remarks !== undefined) updateData.remarks = body.remarks;

        const permit = await prisma.projectPermit.update({
            where: { id: permitId },
            data: updateData,
            include: {
                permitType: { include: { authority: { select: { id: true, name: true, shortName: true } } } },
                permitDocuments: { orderBy: { uploadedAt: "desc" } },
                approvalSteps: { orderBy: { stepNumber: "asc" } }
            }
        });
        return NextResponse.json(permit);
    } catch (error) {
        console.error("Error updating permit:", error);
        return NextResponse.json({ error: "Failed to update permit" }, { status: 500 });
    }
}

// DELETE: Remove a permit
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; permitId: string }> }
) {
    try {
        const { id: projectId, permitId } = await params;

        const existing = await prisma.projectPermit.findFirst({
            where: { id: permitId, projectId }
        });

        if (!existing) {
            return NextResponse.json({ error: "Permit not found" }, { status: 404 });
        }

        await prisma.projectPermit.delete({ where: { id: permitId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting permit:", error);
        return NextResponse.json({ error: "Failed to delete permit" }, { status: 500 });
    }
}
