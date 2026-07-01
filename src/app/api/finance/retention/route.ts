import { NextRequest, NextResponse } from "next/server";
import { RetentionService } from "@/services/finance/retention.service";

// GET /api/finance/retention - List all project retentions with optional status or project filters
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") || undefined;
        const projectId = searchParams.get("projectId") || undefined;

        const retentions = await RetentionService.getRetentions({ status, projectId });
        return NextResponse.json(retentions);
    } catch (error: unknown) {
        console.error("Error fetching retentions:", error);
        return NextResponse.json({ error: "Failed to fetch retentions" }, { status: 500 });
    }
}

// POST /api/finance/retention - Release an amount from a project's retention balance
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { retentionId, releaseAmount, approvedById, remarks } = body;

        if (!retentionId || releaseAmount === undefined) {
            return NextResponse.json(
                { error: "retentionId and releaseAmount are required fields" },
                { status: 400 }
            );
        }

        const release = await RetentionService.releaseRetention({
            retentionId,
            releaseAmount: Number(releaseAmount),
            approvedById,
            remarks
        });
        return NextResponse.json(release, { status: 201 });
    } catch (error: unknown) {
        console.error("Error releasing retention:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to release retention";
        if (errorMsg === "RELEASE_AMOUNT_EXCEEDS_BALANCE") {
            return NextResponse.json({ error: "Release amount exceeds remaining retention balance" }, { status: 400 });
        }
        if (errorMsg === "RETENTION_RECORD_NOT_FOUND") {
            return NextResponse.json({ error: "Retention record not found" }, { status: 404 });
        }
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
