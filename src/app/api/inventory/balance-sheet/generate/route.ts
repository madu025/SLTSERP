import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { contractorId, storeId, month } = body; // month in "YYYY-MM" format

        if (!contractorId || !storeId || !month) {
            return NextResponse.json({ message: 'Missing required parameters' }, { status: 400 });
        }

        // Date Ranges
        const startDate = new Date(`${month}-01`);
        const endDate = endOfMonth(startDate);

        // 1. Get List of ALL Active Items 
        // (We need to report on items even if they had 0 movement but have an opening balance)
        const items = await prisma.inventoryItem.findMany({
            select: { id: true, name: true, code: true, unit: true }
        });

        // 2. Fetch Opening Balances (From Previous Month's Closed Balance Sheet)
        const prevMonthDate = subMonths(startDate, 1);
        const prevMonthStr = format(prevMonthDate, 'yyyy-MM');

        const prevSheet = await prisma.contractorMaterialBalanceSheet.findUnique({
            where: {
                contractorId_storeId_month: {
                    contractorId,
                    storeId,
                    month: prevMonthStr
                }
            },
            include: { items: true }
        });

        const openingMap = new Map<string, number>();
        if (prevSheet) {
            prevSheet.items.forEach(item => {
                openingMap.set(item.itemId, item.closingBalance);
            });
        }

        // 3. Fetch Issues (Received)
        const issues = await prisma.contractorMaterialIssue.findMany({
            where: {
                contractorId,
                storeId,
                month: month // Matches the string format stored
            },
            include: { items: true }
        });

        const receivedMap = new Map<string, number>();
        issues.forEach(issue => {
            issue.items.forEach(item => {
                const current = receivedMap.get(item.itemId) || 0;
                receivedMap.set(item.itemId, current + item.quantity);
            });
        });

        // 4. Fetch Returns (Returned)
        // Only ACCEPTED returns
        const returns = await prisma.contractorMaterialReturn.findMany({
            where: {
                contractorId,
                storeId,
                month: month,
                status: 'ACCEPTED'
            },
            include: { items: true }
        });

        const returnedMap = new Map<string, number>();
        returns.forEach(ret => {
            ret.items.forEach(item => {
                const current = returnedMap.get(item.itemId) || 0;
                returnedMap.set(item.itemId, current + item.quantity);
            });
        });

        // 5. Fetch Usage (Used in SODs)
        // Find SODs completed by this contractor in this month
        // NOTE: We need to filter by Store as well. 
        // Assuming Contractor Teams work in OPMCs belonging to the Store.
        // Or broadly, usage by contractor is deducted from their stock regardless of location?
        // Let's rely on ContractorId + CompletionDate for now.
        // Ideally filter by OPMCs linked to this Store if precise split is needed.

        // Find OPMCs linked to this store to filter SODs?
        // For simplicity: We fetch ALL usage by contractor in this period.
        // TODO: Refine this if a contractor works for multiple stores simultaneously and stock needs separation.

        const usageStart = startOfMonth(startDate);
        const usageEnd = endOfMonth(startDate);

        const sods = await prisma.serviceOrder.findMany({
            where: {
                contractorId,
                sltsStatus: { in: ['COMPLETED', 'RETURN'] }, // Assuming return status might imply usage/return actions
                completedDate: {
                    gte: usageStart,
                    lte: usageEnd
                }
            },
            include: { materialUsage: true }
        });

        const usedMap = new Map<string, number>();
        const wastageMap = new Map<string, number>();

        sods.forEach(sod => {
            sod.materialUsage.forEach(mu => {
                if (mu.usageType === 'USED') {
                    const current = usedMap.get(mu.itemId) || 0;
                    usedMap.set(mu.itemId, current + mu.quantity);
                } else if (mu.usageType === 'WASTAGE') {
                    const current = wastageMap.get(mu.itemId) || 0;
                    wastageMap.set(mu.itemId, current + mu.quantity);
                }
            });
        });

        // NEW: Fetch Direct Wastage (Reported)
        // If we implemented ContractorWastage model
        const directWastage = await (prisma as any).contractorWastage.findMany({
            where: {
                contractorId,
                storeId,
                month: month
            },
            include: { items: true }
        });

        directWastage.forEach((dw: any) => {
            dw.items.forEach((item: any) => {
                const current = wastageMap.get(item.itemId) || 0;
                wastageMap.set(item.itemId, current + item.quantity);
            });
        });

        // 6. Compile Report Data
        const reportData = items.map(item => {
            const opening = openingMap.get(item.id) || 0;
            const received = receivedMap.get(item.id) || 0;
            const returned = returnedMap.get(item.id) || 0;
            const used = usedMap.get(item.id) || 0;
            const wastage = wastageMap.get(item.id) || 0;

            const closing = opening + received - returned - used - wastage;

            // Filter out items with absolutely zero activity
            if (opening === 0 && received === 0 && returned === 0 && used === 0 && wastage === 0) {
                return null;
            }

            return {
                itemId: item.id,
                itemCode: item.code,
                itemName: item.name,
                unit: item.unit,
                opening,
                received,
                returned,
                used,
                wastage,
                closing
            };
        }).filter(Boolean); // Remove nulls

        return NextResponse.json({
            month,
            contractorId,
            storeId,
            items: reportData
        });

    } catch (error) {
        console.error('Error generating balance sheet:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
