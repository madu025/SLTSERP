import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Generate contractor balance sheet for a month
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { contractorId, storeId, month } = body;

        if (!contractorId || !storeId || !month) {
            return NextResponse.json(
                { error: 'contractorId, storeId, and month are required' },
                { status: 400 }
            );
        }

        // Check if balance sheet already exists
        // Check if balance sheet already exists - if so, delete it to allow regeneration
        const existing = await prisma.contractorMaterialBalanceSheet.findUnique({
            where: {
                contractorId_storeId_month: {
                    contractorId,
                    storeId,
                    month
                }
            }
        });

        if (existing) {
            await prisma.contractorMaterialBalanceSheet.delete({
                where: { id: existing.id }
            });
        }

        // Get previous month's closing balances
        const [year, monthNum] = month.split('-').map(Number);
        const prevDate = new Date(year, monthNum - 2, 1); // monthNum is 1-indexed
        const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

        const previousBalanceSheet = await prisma.contractorMaterialBalanceSheet.findUnique({
            where: {
                contractorId_storeId_month: {
                    contractorId,
                    storeId,
                    month: prevMonth
                }
            },
            include: {
                items: true
            }
        });

        // Get all material issues for this contractor/store/month
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0, 23, 59, 59);

        const materialIssues = await prisma.contractorMaterialIssue.findMany({
            where: {
                contractorId,
                storeId,
                issueDate: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                items: true
            }
        });

        // Get all material returns for this contractor/store/month
        const materialReturns = await prisma.contractorMaterialReturn.findMany({
            where: {
                contractorId,
                storeId,
                status: 'ACCEPTED',
                acceptedAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                items: true
            }
        });

        // Get all SOD material usage for this contractor/month
        const sodUsage = await prisma.sODMaterialUsage.findMany({
            where: {
                serviceOrder: {
                    contractorId,
                    completedDate: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            },
            include: {
                item: true
            }
        });

        // Calculate balances for each item
        const itemBalances = new Map<string, {
            itemId: string;
            openingBalance: number;
            received: number;
            returned: number;
            used: number;
            wastage: number;
            closingBalance: number;
        }>();

        // Initialize with previous month's closing balances
        if (previousBalanceSheet) {
            for (const prevItem of previousBalanceSheet.items) {
                itemBalances.set(prevItem.itemId, {
                    itemId: prevItem.itemId,
                    openingBalance: prevItem.closingBalance,
                    received: 0,
                    returned: 0,
                    used: 0,
                    wastage: 0,
                    closingBalance: prevItem.closingBalance
                });
            }
        }

        // Add received materials (issues)
        for (const issue of materialIssues) {
            for (const item of issue.items) {
                const current = itemBalances.get(item.itemId) || {
                    itemId: item.itemId,
                    openingBalance: 0,
                    received: 0,
                    returned: 0,
                    used: 0,
                    wastage: 0,
                    closingBalance: 0
                };
                current.received += item.quantity;
                current.closingBalance += item.quantity;
                itemBalances.set(item.itemId, current);
            }
        }

        // Subtract returned materials
        for (const returnDoc of materialReturns) {
            for (const item of returnDoc.items) {
                const current = itemBalances.get(item.itemId) || {
                    itemId: item.itemId,
                    openingBalance: 0,
                    received: 0,
                    returned: 0,
                    used: 0,
                    wastage: 0,
                    closingBalance: 0
                };
                current.returned += item.quantity;
                current.closingBalance -= item.quantity;
                itemBalances.set(item.itemId, current);
            }
        }

        // Subtract used and wastage from SODs
        for (const usage of sodUsage) {
            const current = itemBalances.get(usage.itemId) || {
                itemId: usage.itemId,
                openingBalance: 0,
                received: 0,
                returned: 0,
                used: 0,
                wastage: 0,
                closingBalance: 0
            };

            if (usage.usageType === 'USED') {
                current.used += usage.quantity;
                current.closingBalance -= usage.quantity;
            } else if (usage.usageType === 'WASTAGE') {
                current.wastage += usage.quantity;
                current.closingBalance -= usage.quantity;
            }
            itemBalances.set(usage.itemId, current);
        }

        // Create balance sheet with items
        const balanceSheet = await prisma.contractorMaterialBalanceSheet.create({
            data: {
                contractorId,
                storeId,
                month,
                items: {
                    create: Array.from(itemBalances.values()).map(item => ({
                        itemId: item.itemId,
                        openingBalance: item.openingBalance,
                        received: item.received,
                        returned: item.returned,
                        used: item.used,
                        wastage: item.wastage,
                        closingBalance: item.closingBalance
                    }))
                }
            },
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        registrationNumber: true
                    }
                },
                store: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                items: {
                    include: {
                        item: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                unit: true,
                                category: true
                            }
                        }
                    }
                }
            }
        });

        return NextResponse.json({
            message: 'Balance sheet generated successfully',
            balanceSheet
        });
    } catch (error) {
        console.error('Error generating balance sheet:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
