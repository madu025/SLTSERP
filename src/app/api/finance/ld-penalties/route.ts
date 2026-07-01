import { NextRequest, NextResponse } from "next/server";
import { LDPenaltyService } from "@/services/finance/ld-penalty.service";

// GET /api/finance/ld-penalties - List all penalties
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") || undefined;
        const projectId = searchParams.get("projectId") || undefined;

        const penalties = await LDPenaltyService.getPenalties({ status, projectId });
        return NextResponse.json(penalties);
    } catch (error: unknown) {
        console.error("Error fetching penalties:", error);
        return NextResponse.json({ error: "Failed to fetch penalties" }, { status: 500 });
    }
}

// POST /api/finance/ld-penalties - Propose a new LD / Penalty
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, title, amount } = body;

        if (!projectId || !title || amount === undefined) {
            return NextResponse.json(
                { error: "projectId, title, and amount are required fields" },
                { status: 400 }
            );
        }

        const penalty = await LDPenaltyService.proposePenalty(body);
        return NextResponse.json(penalty, { status: 201 });
    } catch (error: unknown) {
        console.error("Error proposing penalty:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to propose penalty";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

// PATCH /api/finance/ld-penalties - Approve or Waive a penalty
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, status, userId, waivedAmount, remarks } = body;

        if (!id || !status || !userId) {
            return NextResponse.json(
                { error: "id, status, and userId are required fields" },
                { status: 400 }
            );
        }

        const penalty = await LDPenaltyService.updatePenaltyStatus(id, status, userId, {
            waivedAmount: waivedAmount !== undefined ? Number(waivedAmount) : undefined,
            remarks
        });
        return NextResponse.json(penalty);
    } catch (error: unknown) {
        console.error("Error updating penalty status:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to update penalty status";
        if (errorMsg === "PENALTY_NOT_FOUND") {
            return NextResponse.json({ error: "Penalty record not found" }, { status: 404 });
        }
        if (errorMsg === "INVALID_STATUS") {
            return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
        }
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

// DELETE /api/finance/ld-penalties - Delete a proposed penalty
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "id is required" }, { status: 400 });
        }

        const penalty = await LDPenaltyService.deletePenalty(id);
        return NextResponse.json({ message: "Penalty deleted successfully", penalty });
    } catch (error: unknown) {
        console.error("Error deleting penalty:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to delete penalty";
        if (errorMsg === "PENALTY_NOT_FOUND") {
            return NextResponse.json({ error: "Penalty record not found" }, { status: 404 });
        }
        if (errorMsg === "ONLY_PROPOSED_PENALTIES_CAN_BE_DELETED") {
            return NextResponse.json({ error: "Only PROPOSED penalties can be deleted" }, { status: 400 });
        }
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
