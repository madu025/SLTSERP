import { NextRequest, NextResponse } from "next/server";
import { PaymentVoucherService } from "@/services/finance/payment-voucher.service";

type Params = Promise<{ id: string }>;

// GET /api/finance/payment-vouchers/[id] - Get payment voucher by ID
export async function GET(request: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = await params;
        const voucher = await PaymentVoucherService.getPaymentVoucherById(id);
        
        if (!voucher) {
            return NextResponse.json({ error: "Payment voucher not found" }, { status: 404 });
        }
        
        return NextResponse.json(voucher);
    } catch (error: unknown) {
        console.error("Error fetching payment voucher:", error);
        return NextResponse.json({ error: "Failed to fetch payment voucher" }, { status: 500 });
    }
}

// PUT /api/finance/payment-vouchers/[id] - Update payment voucher details (DRAFT only)
export async function PUT(request: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        
        const voucher = await PaymentVoucherService.updatePaymentVoucher(id, body);
        return NextResponse.json(voucher);
    } catch (error: unknown) {
        console.error("Error updating payment voucher:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to update payment voucher";
        if (errorMsg === "ONLY_DRAFT_VOUCHERS_CAN_BE_UPDATED") {
            return NextResponse.json({ error: "Only DRAFT vouchers can be updated" }, { status: 400 });
        }
        if (errorMsg === "VOUCHER_NOT_FOUND") {
            return NextResponse.json({ error: "Payment voucher not found" }, { status: 404 });
        }
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

// DELETE /api/finance/payment-vouchers/[id] - Delete payment voucher (DRAFT only)
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = await params;
        const voucher = await PaymentVoucherService.deletePaymentVoucher(id);
        return NextResponse.json({ message: "Payment voucher deleted successfully", voucher });
    } catch (error: unknown) {
        console.error("Error deleting payment voucher:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to delete payment voucher";
        if (errorMsg === "ONLY_DRAFT_VOUCHERS_CAN_BE_DELETED") {
            return NextResponse.json({ error: "Only DRAFT vouchers can be deleted" }, { status: 400 });
        }
        if (errorMsg === "VOUCHER_NOT_FOUND") {
            return NextResponse.json({ error: "Payment voucher not found" }, { status: 404 });
        }
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
