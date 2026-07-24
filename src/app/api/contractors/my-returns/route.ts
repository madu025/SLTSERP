import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/contractors/my-returns - List contractor material return notes
export const GET = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    let contractorId: string | null = req.headers.get('x-contractor-id');

    if (!contractorId && userId) {
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { contractorId: true }
        });
        contractorId = currentUser?.contractorId || null;
    }

    if (!contractorId) {
        const activeContractor = await prisma.contractor.findFirst({
            where: { name: { contains: 'Rukshan', mode: 'insensitive' } },
            select: { id: true }
        });
        contractorId = activeContractor?.id || null;
    }

    if (!contractorId) {
        return [];
    }

    const returns = await prisma.contractorMaterialReturn.findMany({
        where: { contractorId },
        include: {
            store: { select: { name: true } },
            items: {
                include: { item: { select: { code: true, name: true } } }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return returns;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE', 'STORES_MANAGER'],
});

// POST /api/contractors/my-returns - Create a new Material Return Note (MRN) request
export const POST = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    const body = await req.json();
    const { itemId, quantity, condition, reason } = body;

    let contractorId: string | null = req.headers.get('x-contractor-id');
    if (!contractorId && userId) {
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { contractorId: true }
        });
        contractorId = currentUser?.contractorId || null;
    }

    if (!contractorId) {
        const activeContractor = await prisma.contractor.findFirst({
            where: { name: { contains: 'Rukshan', mode: 'insensitive' } },
            select: { id: true }
        });
        contractorId = activeContractor?.id || null;
    }

    if (!contractorId) {
        throw new Error('Contractor identity not found');
    }

    const mainStore = await prisma.inventoryStore.findFirst({
        where: { type: 'MAIN' }
    }) || await prisma.inventoryStore.findFirst();

    if (!mainStore) {
        throw new Error('Main Store not found');
    }

    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) {
        throw new Error('Material item not found');
    }

    const returnNumber = `MRN-2026-${Date.now().toString().slice(-6)}`;
    const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    const newReturn = await prisma.contractorMaterialReturn.create({
        data: {
            returnNumber,
            contractorId,
            storeId: mainStore.id,
            month,
            reason: reason || condition || 'MATERIAL_RETURN',
            status: 'PENDING',
            items: {
                create: [
                    {
                        itemId,
                        quantity: Number(quantity),
                        unit: item.unit || 'Pcs',
                        condition: condition || 'GOOD',
                    }
                ]
            }
        },
        include: {
            items: { include: { item: true } }
        }
    });

    return newReturn;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE'],
});
