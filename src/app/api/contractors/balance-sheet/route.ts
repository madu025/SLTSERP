import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Retrieve contractor balance sheet
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractorId = searchParams.get('contractorId');
        const storeId = searchParams.get('storeId');
        const month = searchParams.get('month'); // Format: "2025-01"

        if (!contractorId || !storeId || !month) {
            return NextResponse.json(
                { error: 'contractorId, storeId, and month are required' },
                { status: 400 }
            );
        }

        // Try to find existing balance sheet
        let balanceSheet = await prisma.contractorMaterialBalanceSheet.findUnique({
            where: {
                contractorId_storeId_month: {
                    contractorId,
                    storeId,
                    month
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
                    },
                    orderBy: {
                        item: {
                            name: 'asc'
                        }
                    }
                }
            }
        });

        return NextResponse.json(balanceSheet);
    } catch (error) {
        console.error('Error fetching balance sheet:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
