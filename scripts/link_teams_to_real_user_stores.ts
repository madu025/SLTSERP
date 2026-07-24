import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function linkTeamsToRealUserStores() {
    console.log('🚀 === LINKING OPMCs & TEAMS TO USER REAL REGISTERED STORES ===\n');

    // 1. Fetch all REAL user stores (excluding any auto-generated "OPMC R-" stores)
    const realStores = await prisma.inventoryStore.findMany({
        where: {
            NOT: { name: { startsWith: 'OPMC R-' } }
        }
    });

    console.log(`Found ${realStores.length} Real Registered User Stores in database:\n`);
    realStores.forEach(s => console.log(`• Store ID: ${s.id} | Name: "${s.name}" | Type: ${s.type}`));

    // 2. Fetch all OPMCs and ContractorTeams
    const opmcs = await prisma.oPMC.findMany();
    const teams = await prisma.contractorTeam.findMany({
        include: { opmc: true }
    });

    // Known City/Region name mappings from OPMC/RTOM code to Real Store names
    const rtomToRealStoreMap: Record<string, string> = {
        'R-AD': 'Anuradhapura Store',
        'R-BD': 'Bandarawela Store',
        'R-BW': 'Bandarawela Store',
        'R-BC': 'Baticaloa Store',
        'R-CW': 'Chilaw Store',
        'R-GL': 'Galle Store',
        'R-HB': 'Hambantota Store',
        'R-HO': 'Homagama Store',
        'R-JA': 'Jaffna Store',
        'R-KT': 'Kalutara Store',
        'R-KE': 'Kegalle Store',
        'R-KG': 'Kurunegala Store',
        'R-MT': 'Matale Store',
        'R-MH': 'Matara Store',
        'R-NG': 'Negombo Store',
        'R-NTB': 'Nittambuwa Store',
        'R-NW': 'Nuwaraeliya Store',
        'R-KX': 'Colombo Central Main Store',
        'R-RM': 'Colombo Central Main Store',
        'R-ND': 'Colombo Central Main Store',
        'R-MD': 'Colombo Central Main Store',
        'R-HK': 'Colombo Central Main Store',
    };

    let opmcLinkedCount = 0;
    let teamAssignedCount = 0;

    // 3. Link OPMC to Real Store
    for (const opmc of opmcs) {
        // Try exact map first, or substring match
        let targetStore = realStores.find(s => 
            rtomToRealStoreMap[opmc.rtom] === s.name ||
            s.name.toLowerCase().includes(opmc.rtom.replace(/^R-/, '').toLowerCase())
        );

        if (!targetStore) {
            // Find by name substring match
            const opmcNameClean = opmc.name.replace(/^OPMC R-/, '').trim();
            targetStore = realStores.find(s => s.name.toLowerCase().includes(opmcNameClean.toLowerCase()));
        }

        if (targetStore) {
            await prisma.oPMC.update({
                where: { id: opmc.id },
                data: { storeId: targetStore.id }
            });
            opmcLinkedCount++;
        }
    }

    // 4. Delete all auto-generated "OPMC R-" stores and their assignments
    console.log('\n🧹 Deleting auto-generated "OPMC R-" temporary stores...');
    const autoStores = await prisma.inventoryStore.findMany({
        where: { name: { startsWith: 'OPMC R-' } }
    });

    const autoStoreIds = autoStores.map(s => s.id);
    if (autoStoreIds.length > 0) {
        await prisma.oPMC.updateMany({ where: { storeId: { in: autoStoreIds } }, data: { storeId: null } });
        await prisma.teamStoreAssignment.deleteMany({ where: { storeId: { in: autoStoreIds } } });
        await prisma.inventoryStore.deleteMany({ where: { id: { in: autoStoreIds } } });
        console.log(`✅ Deleted ${autoStores.length} auto-generated temporary stores.`);
    }

    // 5. Re-link ContractorTeams to Real User Stores
    console.log('\n🔗 Re-assigning all ContractorTeams to Real Registered Stores...');
    const mainStore = realStores.find(s => s.type === 'MAIN') || realStores[0];

    for (const team of teams) {
        let matchedStoreId: string | null = null;

        if (team.opmc) {
            const updatedOpmc = await prisma.oPMC.findUnique({ where: { id: team.opmc.id } });
            matchedStoreId = updatedOpmc?.storeId || null;
        }

        if (!matchedStoreId && mainStore) {
            matchedStoreId = mainStore.id;
        }

        if (matchedStoreId) {
            await prisma.teamStoreAssignment.upsert({
                where: {
                    teamId_storeId: {
                        teamId: team.id,
                        storeId: matchedStoreId
                    }
                },
                update: { isPrimary: true },
                create: {
                    teamId: team.id,
                    storeId: matchedStoreId,
                    isPrimary: true
                }
            });
            teamAssignedCount++;
        }
    }

    const finalStores = await prisma.inventoryStore.findMany();

    console.log(`\n🎉 === REAL STORES LINKING COMPLETED 100% === 🎉`);
    console.log(`   - Total Clean Real Registered Stores in System: ${finalStores.length}`);
    console.log(`   - OPMCs Linked to Real Stores: ${opmcLinkedCount}`);
    console.log(`   - ContractorTeams Assigned to Real Stores: ${teamAssignedCount}\n`);

    // Verify Balapitiya
    const balapitiyaTeam = await prisma.contractorTeam.findFirst({
        where: { name: 'SLTSHO_T46' },
        include: {
            opmc: { include: { store: true } },
            storeAssignments: { include: { store: true } }
        }
    });

    if (balapitiyaTeam) {
        console.log(`📌 Y D Balapitiya Real Store Verification:`);
        console.log(`   - Team: ${balapitiyaTeam.name}`);
        console.log(`   - OPMC RTOM Real Store: "${balapitiyaTeam.opmc?.store?.name}"`);
        balapitiyaTeam.storeAssignments.forEach(sa => {
            console.log(`     • Assigned Store: "${sa.store.name}" (${sa.store.type})`);
        });
    }
}

linkTeamsToRealUserStores()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
