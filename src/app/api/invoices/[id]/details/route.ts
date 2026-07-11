import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Query contractor Invoice (SOD claims submitted to SLT)
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        contactNumber: true,
                        registrationNumber: true,
                        bankName: true,
                        bankBranch: true,
                        bankAccountNumber: true,
                    }
                },
                sods: {
                    include: {
                        materialUsage: {
                            include: {
                                item: true
                            }
                        }
                    },
                    orderBy: { completedDate: 'asc' }
                },
                penalties: true,
            }
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        const sodsWithReconciliation = invoice.sods.map(sod => {
            const usages = sod.materialUsage;
            
            // Group by item
            const itemMap: Record<string, {
                itemCode: string;
                itemName: string;
                localQty: number;
                bomQty: number;
                unit: string;
            }> = {};

            usages.forEach(u => {
                const itemCode = u.item.code;
                if (!itemMap[itemCode]) {
                    itemMap[itemCode] = {
                        itemCode,
                        itemName: u.item.name,
                        localQty: 0,
                        bomQty: 0,
                        unit: u.unit || 'Nos'
                    };
                }

                if (u.usageType === 'BOM_CLAIM') {
                    itemMap[itemCode].bomQty += u.quantity;
                } else {
                    itemMap[itemCode].localQty += u.quantity;
                }
            });

            const discrepancies = Object.values(itemMap).filter(item => 
                Math.abs(item.localQty - item.bomQty) > 0.001
            );

            const isMismatched = discrepancies.length > 0;

            return {
                ...sod,
                isMismatched,
                reconciliation: Object.values(itemMap),
                discrepancies
            };
        });

        const totalSodsCount = invoice.sods.length;
        const mismatchedSodsCount = sodsWithReconciliation.filter(s => s.isMismatched).length;

        const response = {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            title: invoice.description || `Invoice ${invoice.invoiceNumber}`,
            description: invoice.description,
            status: invoice.status,
            totalAmount: invoice.totalAmount,
            paidAmount: invoice.amountA,
            balanceAmount: invoice.amountB,
            invoiceDate: invoice.date,
            createdAt: invoice.createdAt,
            referenceNumber: invoice.agreementNumber,
            year: invoice.year,
            month: invoice.month,
            items: [],
            contractor: invoice.contractor,
            sods: sodsWithReconciliation,
            penalties: invoice.penalties,
            connectionTitle: invoice.connectionTitle,
            agreementNumber: invoice.agreementNumber,
            projectNumber: invoice.projectNumber,
            bomNumber: invoice.bomNumber,
            rtomArea: invoice.rtomArea,
            totalSodsCount,
            mismatchedSodsCount,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching invoice details:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
