import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req, { user }) => {
    const contractorId = user.contractorId || (await prisma.contractor.findFirst({ where: { status: 'ACTIVE' } }))?.id;

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
