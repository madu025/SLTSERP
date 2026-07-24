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

    const contractorTeams = await prisma.contractorTeam.findMany({
        where: { contractorId },
        select: { id: true, name: true }
    });

    const teamIds = contractorTeams.map(t => t.id);
    const teamCodes = contractorTeams.map(t => t.name);

    return prisma.serviceOrder.findMany({
        where: {
            OR: [
                { contractorId },
                { teamId: { in: teamIds } },
                { directTeam: { in: teamCodes } },
                { woroTaskName: { in: teamCodes } }
            ]
        },
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
