import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const banksData = await request.json();

        if (!Array.isArray(banksData) || banksData.length === 0) {
            return NextResponse.json({ error: "Invalid data format or empty array" }, { status: 400 });
        }

        let successCount = 0;
        let failedCount = 0;
        const errors: { row: number; error: string }[] = [];

        // We process banks row by row. If a bank exists, we just add the branch to it.
        for (let i = 0; i < banksData.length; i++) {
            const data = banksData[i];
            try {
                // Find or Create the Bank
                let bank = await prisma.bank.findFirst({
                    where: { code: data.bankCode }
                });

                if (!bank) {
                    bank = await prisma.bank.create({
                        data: {
                            code: data.bankCode,
                            name: data.bankName
                        }
                    });
                }

                // If branch data is provided, add it to the bank
                if (data.branchCode && data.branchName) {
                    const existingBranch = await prisma.bankBranch.findFirst({
                        where: { bankId: bank.id, code: data.branchCode }
                    });

                    if (!existingBranch) {
                        await prisma.bankBranch.create({
                            data: {
                                bankId: bank.id,
                                code: data.branchCode,
                                name: data.branchName
                            }
                        });
                    }
                }
                
                successCount++;
            } catch (err: unknown) {
                failedCount++;
                const errorMsg = err instanceof Error ? err.message : "Failed to process bank/branch";
                errors.push({ row: i + 1, error: errorMsg });
            }
        }

        return NextResponse.json({
            message: "Import complete",
            successCount,
            failedCount,
            errors
        }, { status: 200 });

    } catch (error: unknown) {
        console.error("Bulk bank import error:", error);
        return NextResponse.json(
            { error: "Failed to process bulk import" },
            { status: 500 }
        );
    }
}
