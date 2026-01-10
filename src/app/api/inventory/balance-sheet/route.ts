import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST: Save/Freeze Balance Sheet
export async function POST(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { contractorId, storeId, month, items } = body;

        if (!contractorId || !storeId || !month || !items) {
            return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
        }

        // Use transaction to cleanup old items and create new ones (Full Overwrite for that month)
        const result = await prisma.$transaction(async (tx) => {
            // Check if exists
            const existing = await tx.contractorMaterialBalanceSheet.findUnique({
                where: {
                    contractorId_storeId_month: {
                        contractorId,
                        storeId,
                        month
                    }
                }
            });

            if (existing) {
                // Delete old items
                await tx.contractorBalanceSheetItem.deleteMany({
                    where: { balanceSheetId: existing.id }
                });

                // Update Header
                return await tx.contractorMaterialBalanceSheet.update({
                    where: { id: existing.id },
                    data: {
                        generatedAt: new Date(),
                        generatedBy: userId, // Using User ID
                        items: {
                            create: items.map((item: any) => ({
                                itemId: item.itemId,
                                openingBalance: item.opening,
                                received: item.received,
                                returned: item.returned,
                                used: item.used,
                                wastage: item.wastage,
                                closingBalance: item.closing
                            }))
                        }
                    }
                });
            } else {
                // Create New
                return await tx.contractorMaterialBalanceSheet.create({
                    data: {
                        contractorId,
                        storeId,
                        month,
                        generatedBy: userId, // Using User ID
                        items: {
                            create: items.map((item: any) => ({
                                itemId: item.itemId,
                                openingBalance: item.opening,
                                received: item.received,
                                returned: item.returned,
                                used: item.used,
                                wastage: item.wastage,
                                closingBalance: item.closing
                            }))
                        }
                    }
                });
            }
        });

        return NextResponse.json({ message: 'Balance sheet saved successfully', id: result.id });

    } catch (error) {
        console.error('Error saving balance sheet:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
