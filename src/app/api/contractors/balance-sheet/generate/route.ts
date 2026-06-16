import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MaterialService } from '@/services/material.service';

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

        // Generate the balance sheet via the MaterialService (which deletes existing, recalculates, and saves)
        const sheet = await MaterialService.generateBalanceSheet(contractorId, storeId, month);

        // Fetch the full balance sheet with details to return to the UI (matching the expected format)
        const balanceSheet = await prisma.contractorMaterialBalanceSheet.findUnique({
            where: { id: sheet.id },
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
