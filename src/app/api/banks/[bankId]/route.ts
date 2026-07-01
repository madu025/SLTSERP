import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ bankId: string }>;

// PUT /api/banks/[bankId] - Update Bank details
export async function PUT(request: NextRequest, { params }: { params: Params }) {
    try {
        const { bankId } = await params;
        const body = await request.json();
        const { code, name } = body;

        if (!code || !name) {
            return NextResponse.json({ error: "Bank Code and Name are required" }, { status: 400 });
        }

        const bank = await prisma.bank.update({
            where: { id: bankId },
            data: { code, name }
        });

        return NextResponse.json(bank);
    } catch (error: unknown) {
        console.error("Error updating bank:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to update bank";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

// DELETE /api/banks/[bankId] - Delete Bank
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
    try {
        const { bankId } = await params;
        
        // This will cascade delete branches based on onDelete: Cascade setup in prisma
        const bank = await prisma.bank.delete({
            where: { id: bankId }
        });

        return NextResponse.json({ message: "Bank deleted successfully", bank });
    } catch (error: unknown) {
        console.error("Error deleting bank:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to delete bank";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
