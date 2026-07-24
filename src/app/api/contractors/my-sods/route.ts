import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req, { user }) => {
    const contractorId = user.contractorId || (await prisma.contractor.findFirst({ where: { status: 'ACTIVE' } }))?.id;

    if (!contractorId) return [];

    return prisma.serviceOrder.findMany({
        where: { contractorId },
        select: {
            id: true,
            soNum: true,
            customerName: true,
            address: true,
            voiceNumber: true,
            sltsStatus: true,
            dropWireDistance: true,
            ontSerialNumber: true,
            receivedDate: true,
        },
        orderBy: { receivedDate: 'desc' },
        take: 50,
    });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN'],
});
