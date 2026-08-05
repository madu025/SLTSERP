import { prisma } from '../src/lib/prisma';

async function main() {
    const req = await prisma.stockRequest.findFirst({
        where: { requestNr: { contains: 'PRN-20260805' } },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            requestNr: true,
            status: true,
            workflowStage: true,
            sourceType: true,
            procurementStatus: true,
            requestedById: true,
            toStoreId: true,
            fromStoreId: true,
            createdAt: true,
        }
    });
    console.log('Requisition:', JSON.stringify(req, null, 2));

    const all = await prisma.stockRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
            id: true,
            requestNr: true,
            status: true,
            workflowStage: true,
            sourceType: true,
            procurementStatus: true,
            createdAt: true,
        }
    });
    console.log('All recent:', JSON.stringify(all, null, 2));

    await prisma.$disconnect();
}

main();
