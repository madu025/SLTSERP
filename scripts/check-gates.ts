import { prisma } from '../src/lib/prisma';

async function main() {
    const gates = await prisma.processGatePolicy.findMany({
        where: { entityType: 'MATERIAL_REQUEST', isEnabled: true },
        orderBy: { fromStatus: 'asc' },
        select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            domainAction: true,
            rolesToNotify: true,
            approvalLevels: { select: { requiredRole: true, level: true } }
        }
    });
    console.log('Process Gate Policies:', JSON.stringify(gates, null, 2));
    await prisma.$disconnect();
}

main();
