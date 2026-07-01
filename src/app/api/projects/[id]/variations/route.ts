import { NextResponse } from "next/server";
import { ProjectChangeOrderService } from "@/services/project-change-order.service";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const changeOrders = await ProjectChangeOrderService.getChangeOrders(projectId);
        return NextResponse.json(changeOrders);
    } catch (error) {
        console.error("Error fetching change orders:", error);
        return NextResponse.json(
            { error: "Failed to fetch change orders" },
            { status: 500 }
        );
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const {
            title,
            description,
            type,
            reason,
            costImpact,
            timeImpact,
            requestedById,
            notes
        } = body;
        if (!title || !type || !requestedById) {
            return NextResponse.json(
                { error: "Missing required fields: title, type, requestedById" },
                { status: 400 }
            );
        }

        const co = await ProjectChangeOrderService.createChangeOrder({
            projectId,
            title,
            description,
            type,
            reason,
            costImpact,
            timeImpact,
            requestedById,
            notes
        });
        return NextResponse.json(co, { status: 201 });
    } catch (error: any) {
        console.error("Error creating change order:", error);
        const message = error.message;
        if (message === 'PROJECT_NOT_FOUND') {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }
        return NextResponse.json(
            { error: message || "Failed to create change order" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const body = await request.json();
        const { coId, status, approvedById, rejectionReason } = body;
        if (!coId) {
            return NextResponse.json(
                { error: "Change order ID is required" },
                { status: 400 }
            );
        }

        // Map status update to service action
        let action = "UPDATE";
        if (status === "APPROVED") {
            action = "APPROVE";
        } else if (status === "REJECTED") {
            action = "REJECT";
        } else if (status === "PENDING_APPROVAL") {
            action = "SUBMIT";
        } else if (status === "IMPLEMENTED") {
            action = "IMPLEMENT";
        } else if (status === "CANCELLED") {
            action = "CANCEL";
        }

        const updated = await ProjectChangeOrderService.updateChangeOrder(coId, action, {
            approvedById,
            rejectionReason
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("Error updating change order:", error);
        const message = error.message;
        if (message === 'CHANGE_ORDER_NOT_FOUND') {
            return NextResponse.json({ error: "Change order not found" }, { status: 404 });
        }
        if (
            message === 'INVALID_STATUS_DRAFT_ONLY' ||
            message === 'INVALID_STATUS_PENDING_ONLY' ||
            message === 'INVALID_STATUS_APPROVED_ONLY' ||
            message === 'CANNOT_CANCEL_COMPLETED' ||
            message === 'CAN_ONLY_UPDATE_DRAFT_PENDING' ||
            message === 'INVALID_ACTION'
        ) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        return NextResponse.json(
            { error: message || "Failed to update change order" },
            { status: 500 }
        );
    }
}