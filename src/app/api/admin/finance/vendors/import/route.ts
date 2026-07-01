import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const vendorsData = await request.json();

        if (!Array.isArray(vendorsData) || vendorsData.length === 0) {
            return NextResponse.json({ error: "Invalid data format or empty array" }, { status: 400 });
        }

        let successCount = 0;
        let failedCount = 0;
        const errors: { row: number; error: string }[] = [];

        // Simple loop to insert vendors. Using a transaction might fail the whole batch if one fails,
        // so we process one by one to allow partial successes during bulk imports.
        for (let i = 0; i < vendorsData.length; i++) {
            const data = vendorsData[i];
            
            if (!data.code || !data.name) {
                failedCount++;
                errors.push({ row: i + 1, error: "Vendor code and name are required." });
                continue;
            }

            try {
                // Ensure unique code
                const existing = await prisma.vendor.findFirst({
                    where: { OR: [{ code: data.code }, { name: data.name }] }
                });

                if (existing) {
                    failedCount++;
                    errors.push({ row: i + 1, error: `Vendor with code '${data.code}' or name '${data.name}' already exists.` });
                    continue;
                }

                await prisma.vendor.create({
                    data: {
                        code: data.code,
                        name: data.name,
                        contactPerson: data.contactPerson || null,
                        email: data.email || null,
                        phone: data.phone || null,
                        address: data.address || null,
                        registrationNo: data.registrationNo || null,
                        brNumber: data.brNumber || null,
                        bankName: data.bankName || null,
                        bankBranch: data.bankBranch || null,
                        bankAccountNo: data.bankAccountNo || null,
                        status: data.status || "ACTIVE",
                        type: data.type || "SUPPLIER",
                    }
                });
                successCount++;
            } catch (err: unknown) {
                failedCount++;
                const errorMsg = err instanceof Error ? err.message : "Failed to insert";
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
        console.error("Bulk vendor import error:", error);
        return NextResponse.json(
            { error: "Failed to process bulk import" },
            { status: 500 }
        );
    }
}
