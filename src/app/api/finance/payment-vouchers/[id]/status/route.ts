import { NextRequest, NextResponse } from "next/server";
import { PaymentVoucherService } from "@/services/finance/payment-voucher.service";

type Params = Promise<{ id: string }>;

// PATCH /api/finance/payment-vouchers/[id]/status - Update payment voucher status
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { status, userId, rejectionReason, cancelledReason } = body;

        if (!status || !userId) {
            return NextResponse.json(
                { error: "status and userId are required" },
                { status: 400 }
            );
        }

        const voucher = await PaymentVoucherService.updatePaymentVoucherStatus(id, status, userId, {
            rejectionReason,
            cancelledReason
        });
        return NextResponse.json(voucher);
    } catch (error: unknown) {
        console.error("Error updating payment voucher status:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to update status";
        if (errorMsg === "INVALID_STATUS") {
            return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
        }
        if (errorMsg === "VOUCHER_NOT_FOUND") {
            return NextResponse.json({ error: "Payment voucher not found" }, { status: 404 });
        }
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
