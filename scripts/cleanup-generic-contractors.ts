import { prisma } from '../src/lib/prisma';

async function cleanup() {
    const genericNames = [
        'RECONSTRUCT_OSP', 'CONSTRUCT_OSP', 'MODIFY-LOCATION', 'MODIFY_LOCATION',
        'SERVICE_MODIFY', 'SERVICE-MODIFY', 'CONSTRUCT', 'RECONSTRUCT', 'OSP'
    ];

    // 1. Find contractors with generic names
    const contractors = await prisma.contractor.findMany({
        where: {
            name: { in: genericNames }
        }
    });

    const contractorIds = contractors.map(c => c.id);

    console.log(`Found ${contractors.length} generic contractors to clean up:`, contractors.map(c => c.name));

    // 2. Unlink those contractors from service orders
    if (contractorIds.length > 0) {
        const updateOrders = await prisma.serviceOrder.updateMany({
            where: {
                contractorId: { in: contractorIds }
            },
            data: {
                contractorId: null
            }
        });
        console.log(`Unlinked contractorId from ${updateOrders.count} service orders.`);

        // Delete the auto-created fake generic contractors
        const deletedContractors = await prisma.contractor.deleteMany({
            where: {
                id: { in: contractorIds }
            }
        });
        console.log(`Deleted ${deletedContractors.count} fake generic contractors.`);
    }

    // 3. Clear directTeam on orders where directTeam is a generic task name
    const updateDirectTeam = await prisma.serviceOrder.updateMany({
        where: {
            directTeam: { in: genericNames }
        },
        data: {
            directTeam: null
        }
    });
    console.log(`Cleared generic directTeam from ${updateDirectTeam.count} service orders.`);
}

cleanup();
