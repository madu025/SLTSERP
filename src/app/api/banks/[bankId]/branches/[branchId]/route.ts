import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ bankId: string; branchId: string }>;

// PUT /api/banks/[bankId]/branches/[branchId] - Update branch details
export async function PUT(request: NextRequest, { params }: { params: Params }) {
    try {
        const { branchId } = await params;
        const body = await request.json();
        const { code, name } = body;

        if (!code || !name) {
            return NextResponse.json({ error: "Branch Code and Name are required" }, { status: 400 });
        }

        const branch = await prisma.bankBranch.update({
            where: { id: branchId },
            data: { code, name }
        });

        return NextResponse.json(branch);
    } catch (error: unknown) {
        console.error("Error updating branch:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to update branch";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

// DELETE /api/banks/[bankId]/branches/[branchId] - Delete branch
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
    try {
        const { branchId } = await params;
        const branch = await prisma.bankBranch.delete({
            where: { id: branchId }
        });
        return NextResponse.json({ message: "Branch deleted successfully", branch });
    } catch (error: unknown) {
        console.error("Error deleting branch:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to delete branch";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
