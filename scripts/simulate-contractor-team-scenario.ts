import { prisma } from '../src/lib/prisma';
import { eventBus } from '../src/lib/events/event-bus';
import { ServiceOrderService } from '../src/services/sod.service';

async function main() {
    console.log('=== Simulation: Contractor Team with Multiple Members Scenario ===\n');

    // Mock eventBus.publish to avoid hanging on Redis
    eventBus.publish = async (channel: string, data: any) => {
        return Promise.resolve();
    };

    const soNum = 'TBT202606090010543';

    // 1. Get the Service Order
    const order = await prisma.serviceOrder.findUnique({
        where: { soNum },
        include: { opmc: true }
    });

    if (!order) {
        console.error(`❌ Service order ${soNum} not found in database.`);
        return;
    }

    console.log(`Found Service Order: ${order.soNum}`);
    console.log(`OPMC: ${order.opmc.name} (ID: ${order.opmcId})`);

    // Reset order status to INPROGRESS for re-runnable simulation
    console.log('Resetting order status to INPROGRESS...');
    await prisma.serviceOrder.update({
        where: { id: order.id },
        data: {
            status: 'INPROGRESS',
            sltsStatus: 'INPROGRESS',
            completedDate: null,
            contractorId: null,
            teamId: null,
            ontSerialNumber: null,
            dropWireDistance: null,
            completionMode: null,
            revenueAmount: null,
            contractorAmount: null
        }
    });

    // 2. Find or create a Contractor
    console.log('\nStep 1: Finding/Creating Contractor...');
    let contractor = await prisma.contractor.findFirst({
        where: { opmcId: order.opmcId, name: 'Testing Contractor - R-AD' }
    });

    if (!contractor) {
        contractor = await prisma.contractor.create({
            data: {
                name: 'Testing Contractor - R-AD',
                opmcId: order.opmcId,
                status: 'ACTIVE',
                registrationNumber: 'SLTS/SOD/26/001',
                email: 'test.contractor.r-ad@sltserp.lk',
                contactNumber: '+94771234000'
            }
        });
        console.log(`✅ Created Contractor: ${contractor.name}`);
    } else {
        console.log(`✅ Using Contractor: ${contractor.name} (ID: ${contractor.id})`);
    }

    // 3. Create a Team with TWO Members under this Contractor
    console.log('\nStep 2: Adding a Team with TWO Members...');
    
    // Cleanup any existing team with this name for a clean run
    const teamName = 'Testing Team Scenario';
    const existingTeam = await prisma.contractorTeam.findFirst({
        where: { contractorId: contractor.id, name: teamName }
    });
    if (existingTeam) {
        await prisma.teamMember.deleteMany({ where: { teamId: existingTeam.id } });
        await prisma.teamStoreAssignment.deleteMany({ where: { teamId: existingTeam.id } });
        await prisma.contractorTeam.delete({ where: { id: existingTeam.id } });
    }

    const storeId = 'cmq7nqot4001isihsjp5nybdo'; // Anuradhapura Store
    const team = await prisma.contractorTeam.create({
        data: {
            name: teamName,
            contractorId: contractor.id,
            opmcId: order.opmcId,
            sltCode: 'T-SCENARIO-01',
            storeAssignments: {
                create: {
                    storeId,
                    isPrimary: true
                }
            },
            members: {
                create: [
                    {
                        name: 'Samantha Perera',
                        nic: '199011111111',
                        contactNumber: '+94771112222',
                        address: 'Colombo Road, Anuradhapura',
                        designation: 'FIELD_ENGINEER', // Lead Tech
                        contractorId: contractor.id
                    },
                    {
                        name: 'Nimal Silva',
                        nic: '199522222222',
                        contactNumber: '+94773334444',
                        address: 'Kurunegala Road, Anuradhapura',
                        designation: 'ASSISTANT', // Assistant
                        contractorId: contractor.id
                    }
                ]
            }
        },
        include: {
            members: true
        }
    });

    console.log(`✅ Added Contractor Team: "${team.name}" (SLT Code: ${team.sltCode})`);
    console.log(`   Members registered:`);
    team.members.forEach(m => {
        console.log(`   - Name: ${m.name} | NIC: ${m.nic} | Designation: ${m.designation}`);
    });

    // 4. Seed stock
    console.log('\nStep 3: Seeding stock for simulation...');
    const item = await prisma.inventoryItem.findFirst();
    if (!item) {
        console.error('❌ No inventory items found.');
        return;
    }

    await prisma.inventoryStock.upsert({
        where: { storeId_itemId: { storeId, itemId: item.id } },
        update: { quantity: { increment: 100 } },
        create: { storeId, itemId: item.id, quantity: 100 }
    });

    const batch = await prisma.inventoryBatch.create({
        data: {
            itemId: item.id,
            batchNumber: `BATCH-SCENARIO-${Date.now()}`,
            initialQty: 100,
            costPrice: 120.0,
            unitPrice: 150.0,
            storeStocks: {
                create: { storeId, itemId: item.id, quantity: 100 }
            }
        }
    });

    await prisma.contractorStock.upsert({
        where: { contractorId_itemId: { contractorId: contractor.id, itemId: item.id } },
        update: { quantity: 100 },
        create: { contractorId: contractor.id, itemId: item.id, quantity: 100 }
    });

    await prisma.contractorBatchStock.upsert({
        where: { contractorId_batchId: { contractorId: contractor.id, batchId: batch.id } },
        update: { quantity: 100 },
        create: { contractorId: contractor.id, itemId: item.id, batchId: batch.id, quantity: 100 }
    });

    // Seed configurations
    let revConfig = await prisma.sODRevenueConfig.findFirst({
        where: { rtomId: order.opmcId }
    });
    if (revConfig) {
        await prisma.sODRevenueConfig.update({
            where: { id: revConfig.id },
            data: { revenuePerSOD: 12500.0, isActive: true }
        });
    } else {
        await prisma.sODRevenueConfig.create({
            data: { rtomId: order.opmcId, revenuePerSOD: 12500.0, isActive: true }
        });
    }

    let payConfig = await prisma.contractorPaymentConfig.findFirst({
        where: { rtomId: order.opmcId }
    });
    if (payConfig) {
        await prisma.contractorPaymentConfig.update({
            where: { id: payConfig.id },
            data: { isActive: true }
        });
    } else {
        await prisma.contractorPaymentConfig.create({
            data: {
                rtomId: order.opmcId,
                isActive: true,
                tiers: {
                    create: [
                        { minDistance: 0, maxDistance: 50, amount: 8000.0 },
                        { minDistance: 51, maxDistance: 150, amount: 12000.0 },
                        { minDistance: 151, maxDistance: 9999, amount: 16000.0 }
                    ]
                }
            }
        });
    }

    // 5. Complete Service Order using the Team
    console.log('\nStep 4: Completing Service Order using the specific Team...');
    
    const adminUser = await prisma.user.findFirst();
    const activeUserId = adminUser ? adminUser.id : undefined;

    const completionData = {
        status: 'COMPLETED',
        sltsStatus: 'COMPLETED',
        completedDate: new Date(),
        contractorId: contractor.id,
        teamId: team.id,
        ontSerialNumber: 'ONT-TEAM-SCENARIO-999',
        dropWireDistance: 25,
        completionMode: 'ONLINE',
        materialUsage: [
            {
                itemId: item.id,
                quantity: '3',
                usageType: 'USED',
                remarks: 'Scenario team test usage'
            }
        ]
    };

    const updatedOrder = await ServiceOrderService.patchServiceOrder(
        order.id,
        completionData as any,
        activeUserId
    );

    console.log('\n🎉 Simulation Completed successfully!');

    // 6. Fetch and print the final relation details
    console.log('\nStep 5: Verifying relation mappings for completed Service Order:');
    
    const finalizedOrder = await prisma.serviceOrder.findUnique({
        where: { id: updatedOrder.id },
        include: {
            contractor: true,
            team: {
                include: {
                    members: true
                }
            }
        }
    });

    if (finalizedOrder) {
        console.log(`Service Order: ${finalizedOrder.soNum}`);
        console.log(`Status: ${finalizedOrder.status}`);
        console.log(`Assigned Contractor: ${finalizedOrder.contractor?.name}`);
        console.log(`Performing Team: ${finalizedOrder.team?.name} (SLT Code: ${finalizedOrder.team?.sltCode})`);
        console.log('Performing Team Members:');
        finalizedOrder.team?.members.forEach((m, idx) => {
            console.log(`  [Member ${idx + 1}] Name: ${m.name} | Designation: ${m.designation} | Contact: ${m.contactNumber}`);
        });
    }
}

main()
    .catch((e) => {
        console.error('Fatal Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
