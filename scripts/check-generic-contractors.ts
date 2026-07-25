import { prisma } from '../src/lib/prisma';

async function checkGenericContractors() {
    const genericNames = [
        'RECONSTRUCT_OSP', 'CONSTRUCT_OSP', 'MODIFY-LOCATION', 'MODIFY_LOCATION',
        'SERVICE_MODIFY', 'SERVICE-MODIFY', 'CONSTRUCT', 'RECONSTRUCT', 'OSP'
    ];

    const contractors = await prisma.contractor.findMany({
        where: {
            name: { in: genericNames }
        },
        include: {
            _count: {
                select: { serviceOrders: true }
            }
        }
    });

    console.log("Generic Contractors found in DB:", contractors);

    const ordersWithGenericDirectTeam = await prisma.serviceOrder.findMany({
        where: {
            directTeam: { in: genericNames }
        },
        select: {
            id: true,
            soNum: true,
            voiceNumber: true,
            directTeam: true,
            contractorId: true
        }
    });

    console.log(`Found ${ordersWithGenericDirectTeam.length} orders with generic directTeam.`);
}

checkGenericContractors();
