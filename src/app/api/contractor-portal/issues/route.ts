import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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

    if (!contractorId) return [];

    return prisma.contractorMaterialIssue.findMany({
        where: { contractorId },
        include: {
            store: { select: { id: true, name: true } },
            items: {
                include: {
                    item: { select: { id: true, code: true, name: true } }
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'STORES_MANAGER'],
});
