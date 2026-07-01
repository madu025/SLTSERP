import { NextResponse } from "next/server";
import { ProjectPermitService } from "@/services/project-permit.service";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get("projectId");

        const permits = await ProjectPermitService.getPermits(projectId);
        return NextResponse.json(permits);
    } catch (error: unknown) {
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
        const { projectId, permitTypeId } = body;

        if (!projectId || !permitTypeId) {
            return NextResponse.json(
                { error: "Missing required fields: projectId, permitTypeId" },
                { status: 400 }
            );
        }

        const permit = await ProjectPermitService.createPermit(body);
        return NextResponse.json(permit, { status: 201 });
    } catch (error: unknown) {
        console.error("Error creating permit:", error);
        return NextResponse.json(
            { error: "Failed to create permit" },
            { status: 500 }
        );
    }
}