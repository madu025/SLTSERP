import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// POST: Create Material Return
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { contractorId, storeId, month, reason, items } = body;

        // Validation
        if (!contractorId || !storeId || !month || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Return Record
            const returnRecord = await tx.contractorMaterialReturn.create({
                data: {
                    contractorId,
                    storeId,
                    month,
                    reason,
                    status: 'ACCEPTED', // Auto-accept for now as entered by Admin
                    acceptedBy: session.user?.email || 'System',
                    acceptedAt: new Date(),
                    items: {
                        create: items.map((item: any) => ({
                            itemId: item.itemId,
                            quantity: parseFloat(item.quantity),
                            unit: item.unit || 'Nos',
                            condition: item.condition || 'GOOD'
                        }))
                    }
                }
            });

            // 2. Create Transaction Log
            const invTx = await tx.inventoryTransaction.create({
                data: {
                    type: 'RETURN', // Contractor Return
                    storeId,
                    referenceId: returnRecord.id,
                    notes: `Return from contractor: ${reason || 'N/A'}`,
                    items: {
                        create: items.map((item: any) => ({
                            itemId: item.itemId,
                            quantity: parseFloat(item.quantity), // Positive for IN
                            beforeQty: 0, // Not fetching current stock for performance, can be improved
                            afterQty: 0
                        }))
                    }
                }
            });

            // 3. Update Inventory Stock (Only for GOOD items)
            for (const item of items) {
                const qty = parseFloat(item.quantity);
                if (item.condition === 'GOOD' && qty > 0) {
                    // Update Stock
                    // Upsert: Create if not exists, increment if exists
                    const existingStock = await tx.inventoryStock.findUnique({
                        where: {
                            storeId_itemId: {
                                storeId,
                                itemId: item.itemId
                            }
                        }
                    });

                    if (existingStock) {
                        await tx.inventoryStock.update({
                            where: { id: existingStock.id },
                            data: { quantity: { increment: qty } }
                        });
                    } else {
                        await tx.inventoryStock.create({
                            data: {
                                storeId,
                                itemId: item.itemId,
                                quantity: qty,
                                minLevel: 0
                            }
                        });
                    }
                }
            }

            return returnRecord;
        });

        return NextResponse.json({ message: 'Return processed successfully', id: result.id });

    } catch (error) {
        console.error('Error processing return:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// GET: Fetch Returns History
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractorId = searchParams.get('contractorId');
        const storeId = searchParams.get('storeId');
        const month = searchParams.get('month');

        const whereClause: any = {};
        if (contractorId) whereClause.contractorId = contractorId;
        if (storeId) whereClause.storeId = storeId;
        if (month) whereClause.month = month;

        const returns = await prisma.contractorMaterialReturn.findMany({
            where: whereClause,
            include: {
                store: { select: { name: true } },
                contractor: { select: { name: true } },
                items: {
                    include: {
                        item: { select: { name: true, code: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(returns);
    } catch (error) {
        return NextResponse.json({ message: 'Error fetching returns' }, { status: 500 });
    }
}
