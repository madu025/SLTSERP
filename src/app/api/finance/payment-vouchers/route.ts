import { NextRequest, NextResponse } from "next/server";
import { PaymentVoucherService } from "@/services/finance/payment-voucher.service";

// GET /api/finance/payment-vouchers - List payment vouchers with optional filters
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") || undefined;
        const projectId = searchParams.get("projectId") || undefined;
        const type = searchParams.get("type") || undefined;

        const vouchers = await PaymentVoucherService.getPaymentVouchers({ status, projectId, type });
        return NextResponse.json(vouchers);
    } catch (error: unknown) {
        console.error("Error fetching payment vouchers:", error);
        return NextResponse.json({ error: "Failed to fetch payment vouchers" }, { status: 500 });
    }
}

// POST /api/finance/payment-vouchers - Create a new payment voucher
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, title, payeeName, amount } = body;

        if (!projectId || !title || !payeeName || amount === undefined) {
            return NextResponse.json(
                { error: "projectId, title, payeeName, and amount are required fields" },
                { status: 400 }
            );
        }

        const voucher = await PaymentVoucherService.createPaymentVoucher(body);
        return NextResponse.json(voucher, { status: 201 });
    } catch (error: unknown) {
        console.error("Error creating payment voucher:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to create payment voucher";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
