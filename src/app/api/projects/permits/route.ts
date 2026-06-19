import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get("projectId");

        const where: Record<string, unknown> = {};
        if (projectId) where.projectId = projectId;

        const permits = await prisma.projectPermit.findMany({
            where,
            include: {
                permitType: true,
                _count: { select: { permitDocuments: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json(permits);
    } catch (error) {
        console.error("Error fetching permits:", error);
        return NextResponse.json(
            { error: "Failed to fetch permits" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            projectId,
            permitTypeId,
            permitNumber,
            applicationDate,
            expiryDate,
            status,
            cost
        } = body;

        if (!projectId || !permitTypeId) {
            return NextResponse.json(
                { error: "Missing required fields: projectId, permitTypeId" },
                { status: 400 }
            );
        }

        const permit = await prisma.projectPermit.create({
            data: {
                projectId,
                permitTypeId,
                permitNumber: permitNumber || null,
                applicationDate: applicationDate
                    ? new Date(applicationDate)
                    : null,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                status: status || "DRAFT",
                cost: cost || null
            },
            include: {
                permitType: true,
                _count: { select: { permitDocuments: true } }
            }
        });

        return NextResponse.json(permit, { status: 201 });
    } catch (error) {
        console.error("Error creating permit:", error);
        return NextResponse.json(
            { error: "Failed to create permit" },
            { status: 500 }
        );
    }
}