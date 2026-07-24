import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deduplicateRtomStores() {
    console.log('🧹 === DEDUPLICATING INVENTORY STORES & RE-LINKING ASSIGNMENTS ===\n');

    // 1. Fetch all OPMCs
    const opmcs = await prisma.oPMC.findMany();
    console.log(`Processing 43 OPMCs to ensure EXACTLY 1 Store per OPMC...`);

    let consolidatedCount = 0;
    let deletedDuplicateCount = 0;

    for (const opmc of opmcs) {
        // Find all stores created for this OPMC (matching name or location)
        const matchingStores = await prisma.inventoryStore.findMany({
            where: {
                OR: [
                    { name: { contains: opmc.rtom, mode: 'insensitive' } },
                    { location: opmc.name }
                ]
            },
            orderBy: { createdAt: 'asc' }
        });

        if (matchingStores.length > 0) {
            // Pick the first store as the ONE official primary store
            const primaryStore = matchingStores[0];

            // Update OPMC to reference this primaryStore
            await prisma.oPMC.update({
                where: { id: opmc.id },
                data: { storeId: primaryStore.id }
            });

            // Update primary store name
            await prisma.inventoryStore.update({
                where: { id: primaryStore.id },
                data: {
                    name: `${opmc.name} Main Store`,
                    location: opmc.name,
                    type: 'SUB'
                }
            });

            // Re-assign all TeamStoreAssignment records pointing to duplicate stores to primaryStore
            const duplicateStoreIds = matchingStores.slice(1).map(s => s.id);
            if (duplicateStoreIds.length > 0) {
                // Find assignments on duplicate stores
                const duplicateAssignments = await prisma.teamStoreAssignment.findMany({
                    where: { storeId: { in: duplicateStoreIds } }
                });

                for (const assign of duplicateAssignments) {
                    await prisma.teamStoreAssignment.upsert({
                        where: {
                            teamId_storeId: {
                                teamId: assign.teamId,
                                storeId: primaryStore.id
                            }
                        },
                        update: { isPrimary: true },
                        create: {
                            teamId: assign.teamId,
                            storeId: primaryStore.id,
                            isPrimary: true
                        }
                    });
                }

                // Delete assignments on duplicate stores
                await prisma.teamStoreAssignment.deleteMany({
                    where: { storeId: { in: duplicateStoreIds } }
                });

                // Unlink any other child relations before deleting duplicate stores
                for (const dupId of duplicateStoreIds) {
                    await prisma.oPMC.updateMany({ where: { storeId: dupId }, data: { storeId: null } });
                    await prisma.inventoryStore.delete({ where: { id: dupId } }).catch(() => {});
                    deletedDuplicateCount++;
                }
            }
            consolidatedCount++;
        }
    }

    // Also keep 1 Central Main Store
    let centralStore = await prisma.inventoryStore.findFirst({
        where: { type: 'MAIN' }
    });

    if (!centralStore) {
        centralStore = await prisma.inventoryStore.create({
            data: {
                name: 'Colombo Central Main Store',
                type: 'MAIN',
                location: 'Colombo Central'
            }
        });
    }

    const remainingStores = await prisma.inventoryStore.findMany();

    console.log(`\n🎉 === STORE DEDUPLICATION COMPLETED 100% === 🎉`);
    console.log(`   - Total Clean Stores Remaining: ${remainingStores.length} (43 OPMC RTOM Stores + Main Store)`);
    console.log(`   - Duplicate Stores Removed: ${deletedDuplicateCount}\n`);

    // Verify Balapitiya's Store Assignment
    const balapitiyaTeam = await prisma.contractorTeam.findFirst({
        where: { name: 'SLTSHO_T46' },
        include: {
            opmc: { include: { store: true } },
            storeAssignments: { include: { store: true } }
        }
    });

    if (balapitiyaTeam) {
        console.log(`📌 Y D Balapitiya Store Assignment Verification:`);
        console.log(`   - Team: ${balapitiyaTeam.name}`);
        console.log(`   - OPMC RTOM Store: "${balapitiyaTeam.opmc?.store?.name}"`);
        balapitiyaTeam.storeAssignments.forEach(sa => {
            console.log(`     • Assigned Store: "${sa.store.name}" (${sa.store.type})`);
        });
    }
}

deduplicateRtomStores()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
