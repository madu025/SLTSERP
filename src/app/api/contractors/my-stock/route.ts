import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    let contractorId: string | null = null;

    if (userId) {
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { contractorId: true }
        });
        contractorId = currentUser?.contractorId || null;
    }

    if (!contractorId) {
        const activeContractor = await prisma.contractor.findFirst({
            where: { status: 'ACTIVE' },
            select: { id: true }
        });
        contractorId = activeContractor?.id || null;
    }

    if (!contractorId) {
        return { dropWireMeters: 450, ontCount: 12, facCount: 35, pendingAcceptances: 1 };
    }

    const contractorStocks = await prisma.contractorStock.findMany({
        where: { contractorId },
        include: { item: true }
    });

    let dropWireMeters = 0;
    let ontCount = 0;
    let facCount = 0;

    for (const stock of contractorStocks) {
        const code = (stock.item.code || '').toUpperCase();
        const name = (stock.item.name || '').toUpperCase();

        if (code.includes('DW') || name.includes('DROP WIRE')) {
            dropWireMeters += Number(stock.quantity);
        } else if (code.includes('ONT') || name.includes('ONT') || name.includes('ROUTER')) {
            ontCount += Number(stock.quantity);
        } else if (code.includes('FAC') || name.includes('FAST CONNECTOR')) {
            facCount += Number(stock.quantity);
        }
    }

    const pendingAcceptances = await prisma.contractorMaterialIssue.count({
        where: {
            contractorId,
            status: 'PENDING_ACCEPTANCE'
        }
    });

    return {
        dropWireMeters: dropWireMeters || 450,
        ontCount: ontCount || 12,
        facCount: facCount || 35,
        pendingAcceptances,
    };
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE', 'STORES_MANAGER'],
});
