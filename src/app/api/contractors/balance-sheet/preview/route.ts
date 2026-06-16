import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Preview balance sheet data before generation
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractorId = searchParams.get('contractorId');
        const storeId = searchParams.get('storeId');
        const month = searchParams.get('month');

        if (!contractorId || !storeId || !month) {
            return NextResponse.json(
                { error: 'contractorId, storeId, and month are required' },
                { status: 400 }
            );
        }

        const [year, monthNum] = month.split('-').map(Number);
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0, 23, 59, 59);

        // Get material issues count
        const issuesCount = await prisma.contractorMaterialIssue.count({
            where: {
                contractorId,
                storeId,
                issueDate: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });

        // Get material returns count
        const returnsCount = await prisma.contractorMaterialReturn.count({
            where: {
                contractorId,
                storeId,
                status: 'ACCEPTED',
                acceptedAt: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });

        // Get SOD material usage count
        const usageCount = await prisma.sODMaterialUsage.count({
            where: {
                serviceOrder: {
                    contractorId,
                    completedDate: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            }
        });

        // Get contractor and store info
        const contractor = await prisma.contractor.findUnique({
            where: { id: contractorId },
            select: { id: true, name: true, registrationNumber: true }
        });

        const store = await prisma.inventoryStore.findUnique({
            where: { id: storeId },
            select: { id: true, name: true }
        });

        return NextResponse.json({
            contractor,
            store,
            month,
            summary: {
                materialIssues: issuesCount,
                materialReturns: returnsCount,
                sodUsage: usageCount,
                hasData: issuesCount > 0 || returnsCount > 0 || usageCount > 0
            }
        });
    } catch (error) {
        console.error('Error fetching preview:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
