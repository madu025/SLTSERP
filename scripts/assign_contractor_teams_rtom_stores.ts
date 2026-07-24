import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignContractorTeamsRtomStores() {
    console.log('🚀 === LINKING CONTRACTOR TEAMS TO RTOM STORES ===\n');

    // 1. Fetch all OPMCs with their linked store
    const opmcs = await prisma.oPMC.findMany({
        include: { store: true }
    });

    // 2. Fetch all ContractorTeams
    const teams = await prisma.contractorTeam.findMany({
        include: { opmc: { include: { store: true } }, contractor: true }
    });

    console.log(`Processing ${teams.length} ContractorTeams across ${opmcs.length} OPMC/RTOMs...\n`);

    let assignedCount = 0;
    let fallbackStoreCount = 0;

    // Default Main Store fallback if OPMC has no store
    let mainStore = await prisma.inventoryStore.findFirst({
        where: { type: 'MAIN' }
    });

    if (!mainStore) {
        mainStore = await prisma.inventoryStore.create({
            data: {
                name: 'SLTS Central Main Store',
                type: 'MAIN',
                location: 'Colombo Central'
            }
        });
    }

    for (const team of teams) {
        let storeIdToAssign: string | null = null;

        // Check if team has an OPMC with a store
        if (team.opmc?.store) {
            storeIdToAssign = team.opmc.store.id;
        } else if (team.opmcId) {
            // Find or create store for this OPMC
            const opmc = opmcs.find(o => o.id === team.opmcId);
            if (opmc) {
                let opmcStore = opmc.store;
                if (!opmcStore) {
                    opmcStore = await prisma.inventoryStore.create({
                        data: {
                            name: `${opmc.name} (${opmc.rtom}) Store`,
                            type: 'SUB',
                            location: opmc.name
                        }
                    });
                    // Link to OPMC
                    await prisma.oPMC.update({
                        where: { id: opmc.id },
                        data: { storeId: opmcStore.id }
                    });
                }
                storeIdToAssign = opmcStore.id;
            }
        }

        // Fallback to Central Main Store if still null
        if (!storeIdToAssign) {
            storeIdToAssign = mainStore.id;
            fallbackStoreCount++;
        }

        // Upsert TeamStoreAssignment
        await prisma.teamStoreAssignment.upsert({
            where: {
                teamId_storeId: {
                    teamId: team.id,
                    storeId: storeIdToAssign
                }
            },
            update: {
                isPrimary: true
            },
            create: {
                teamId: team.id,
                storeId: storeIdToAssign,
                isPrimary: true
            }
        });
        assignedCount++;
    }

    console.log(`\n🎉 === RTOM STORE ASSIGNMENT COMPLETED 100% === 🎉`);
    console.log(`   - Total ContractorTeams Linked: ${assignedCount}`);
    console.log(`   - Teams Linked to Specific RTOM Stores: ${assignedCount - fallbackStoreCount}`);
    console.log(`   - Teams Linked to Main Store Fallback: ${fallbackStoreCount}\n`);

    // Verify Balapitiya's Team Store Assignment
    const balapitiyaTeam = await prisma.contractorTeam.findFirst({
        where: { name: 'SLTSHO_T46' },
        include: {
            contractor: true,
            opmc: true,
            storeAssignments: { include: { store: true } }
        }
    });

    if (balapitiyaTeam) {
        console.log(`📌 Y D Balapitiya (SLTSHO_T46) Store Assignment Verification:`);
        console.log(`   - Contractor: ${balapitiyaTeam.contractor.name}`);
        console.log(`   - Team: ${balapitiyaTeam.name}`);
        console.log(`   - RTOM OPMC: ${balapitiyaTeam.opmc?.name || 'N/A'} (${balapitiyaTeam.opmc?.rtom || 'N/A'})`);
        balapitiyaTeam.storeAssignments.forEach(sa => {
            console.log(`     • Assigned Store: "${sa.store.name}" (Type: ${sa.store.type} | Primary: ${sa.isPrimary})`);
        });
    }
}

assignContractorTeamsRtomStores()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
