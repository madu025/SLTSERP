import { prisma } from '../src/lib/prisma';
import { ServiceOrderService } from '../src/services/sod.service';

async function main() {
    const soNum = 'TBT202606090010543';
    console.log(`\n=== Starting Real Completion Simulation for Service Order: ${soNum} ===\n`);

    // 0. Reset the order state to ensure simulation starts clean
    console.log(`Resetting order to PENDING/INPROGRESS state...`);
    await prisma.serviceOrder.update({
        where: { soNum },
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
    console.log(`✅ Order reset.`);

    // 1. Find the service order
    const order = await prisma.serviceOrder.findUnique({
        where: { soNum },
        include: { opmc: true }
    });

    if (!order) {
        console.error(`❌ Service order ${soNum} not found in database.`);
        return;
    }

    console.log(`Found Service Order:`);
    console.log(`- ID: ${order.id}`);
    console.log(`- OPMC: ${order.opmc.name} (ID: ${order.opmcId})`);
    console.log(`- Status: ${order.status} / sltsStatus: ${order.sltsStatus}`);

    // 2. Ensure R-AD OPMC is linked to Anuradhapura Store (id: cmq7nqot4001isihsjp5nybdo)
    const storeId = 'cmq7nqot4001isihsjp5nybdo';
    if (order.opmc.storeId !== storeId) {
        console.log(`Linking OPMC R-AD to Anuradhapura Store...`);
        await prisma.oPMC.update({
            where: { id: order.opmcId },
            data: { storeId }
        });
        console.log(`✅ OPMC R-AD linked to Anuradhapura Store.`);
    }

    // 3. Create or find a Contractor
    console.log(`Checking for contractor...`);
    let contractor = await prisma.contractor.findFirst({
        where: { opmcId: order.opmcId }
    });

    if (!contractor) {
        console.log(`Creating dummy contractor for R-AD...`);
        contractor = await prisma.contractor.create({
            data: {
                name: 'R-AD Contractor (Simulation)',
                opmcId: order.opmcId,
                status: 'ACTIVE',
                registrationNumber: 'CON-RAD-SIM-01',
                email: 'rad.contractor@simulation.com'
            }
        });
        console.log(`✅ Contractor created: ${contractor.name} (ID: ${contractor.id})`);
    } else {
        console.log(`✅ Using existing contractor: ${contractor.name} (ID: ${contractor.id})`);
    }

    // 4. Create or find a Contractor Team
    console.log(`Checking for contractor team...`);
    let team = await prisma.contractorTeam.findFirst({
        where: { contractorId: contractor.id }
    });

    if (!team) {
        console.log(`Creating dummy team for contractor...`);
        team = await prisma.contractorTeam.create({
            data: {
                name: 'R-AD Team 1',
                contractorId: contractor.id,
                opmcId: order.opmcId,
                sltCode: 'T-RAD-01'
            }
        });
        console.log(`✅ Team created: ${team.name} (ID: ${team.id})`);
    } else {
        console.log(`✅ Using existing team: ${team.name} (ID: ${team.id})`);
    }

    // 5. Create Store Assignment for the team
    console.log(`Checking for team store assignment...`);
    const assignment = await prisma.teamStoreAssignment.findFirst({
        where: { teamId: team.id, storeId }
    });

    if (!assignment) {
        console.log(`Assigning Anuradhapura Store to Team...`);
        await prisma.teamStoreAssignment.create({
            data: {
                teamId: team.id,
                storeId,
                isPrimary: true
            }
        });
        console.log(`✅ Assigned store to team.`);
    } else {
        console.log(`✅ Team store assignment already exists.`);
    }

    // 6. Find an inventory item to seed
    const item = await prisma.inventoryItem.findFirst();
    if (!item) {
        console.error(`❌ No inventory items found in database.`);
        return;
    }
    console.log(`Selected item for material usage simulation: ${item.name} (Code: ${item.code}, ID: ${item.id})`);

    // Ensure item stock is seeded in store
    console.log(`Ensuring stock in Anuradhapura Store for ${item.name}...`);
    await prisma.inventoryStock.upsert({
        where: { storeId_itemId: { storeId, itemId: item.id } },
        update: { quantity: { increment: 100 } },
        create: { storeId, itemId: item.id, quantity: 100 }
    });

    // Create a batch for FIFO picking
    const batchNumber = `BATCH-RAD-${Date.now()}`;
    const batch = await prisma.inventoryBatch.create({
        data: {
            itemId: item.id,
            batchNumber,
            initialQty: 100,
            costPrice: 120.0,
            unitPrice: 150.0,
            storeStocks: {
                create: { storeId, itemId: item.id, quantity: 100 }
            }
        }
    });
    console.log(`✅ Created Batch ${batchNumber} with 100 units of stock.`);

    // Ensure stock exists for the contractor too
    console.log(`Ensuring contractor stock for ${contractor.name}...`);
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
    console.log(`✅ Seeded 100 units in Contractor Batch Stock.`);

    // 7. Seed dummy Revenue Config and Contractor Payment Config if not present
    console.log(`Checking SOD Revenue and Contractor Payment Configs...`);
    let revConfig = await prisma.sODRevenueConfig.findFirst({
        where: { OR: [{ rtomId: order.opmcId }, { rtomId: null }] }
    });
    if (!revConfig) {
        console.log(`Creating dummy SOD Revenue Config...`);
        revConfig = await prisma.sODRevenueConfig.create({
            data: {
                rtomId: order.opmcId,
                revenuePerSOD: 12500.0,
                isActive: true
            }
        });
        console.log(`✅ Revenue Config created: ${revConfig.revenuePerSOD} LKR per SOD`);
    }

    let payConfig = await prisma.contractorPaymentConfig.findFirst({
        where: { OR: [{ rtomId: order.opmcId }, { rtomId: null }] }
    });
    if (!payConfig) {
        console.log(`Creating dummy Contractor Payment Config with tiers...`);
        payConfig = await prisma.contractorPaymentConfig.create({
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
        console.log(`✅ Contractor Payment Config created.`);
    }

    // 8. SIMULATE COMPLETION
    console.log(`\nExecuting ServiceOrderService.patchServiceOrder to complete the order...`);
    
    const completionData = {
        status: 'COMPLETED',
        sltsStatus: 'COMPLETED',
        completedDate: new Date(),
        contractorId: contractor.id,
        teamId: team.id,
        ontSerialNumber: 'ONT-RAD-SIM-998877',
        dropWireDistance: 45,
        completionMode: 'ONLINE',
        materialUsage: [
            {
                itemId: item.id,
                quantity: '5',
                usageType: 'USED',
                remarks: 'Simulation use',
                serialNumber: item.hasSerial ? 'SN-RAD-SIM-112233' : undefined
            }
        ]
    };

    // Find real user to avoid Audit Log foreign key constraint failure
    const testUser = await prisma.user.findFirst();
    const activeUserId = testUser ? testUser.id : undefined;
    console.log(`Using user ID for audit log: ${testUser ? testUser.username : 'SYSTEM'}`);

    const updatedOrder = await ServiceOrderService.patchServiceOrder(
        order.id,
        completionData as any,
        activeUserId
    );

    console.log(`\n🎉 Completion simulation successful!`);
    console.log(`Updated Order details:`);
    console.log(`- ID: ${updatedOrder.id}`);
    console.log(`- Status: ${updatedOrder.status} / sltsStatus: ${updatedOrder.sltsStatus}`);
    console.log(`- Completed Date: ${updatedOrder.completedDate}`);
    console.log(`- Assigned Contractor: ${updatedOrder.contractorId}`);
    console.log(`- Assigned Team: ${updatedOrder.teamId}`);
    console.log(`- ONT Serial: ${updatedOrder.ontSerialNumber}`);
    console.log(`- Wire Distance: ${updatedOrder.dropWireDistance} M`);
    console.log(`- Calculated Revenue Amount: ${updatedOrder.revenueAmount} LKR`);
    console.log(`- Calculated Contractor Amount: ${updatedOrder.contractorAmount} LKR`);

    // Verify stock deduction from Contractor Batch Stock
    const remainingStock = await prisma.contractorBatchStock.findUnique({
        where: { contractorId_batchId: { contractorId: contractor.id, batchId: batch.id } }
    });
    console.log(`- Remaining Stock of ${item.name} in Contractor's Batch: ${remainingStock?.quantity} (Deducted 5 from 100)`);

    // Verify transaction log
    const txLog = await prisma.inventoryTransaction.findFirst({
        where: { referenceId: order.id }
    });
    if (txLog) {
        console.log(`- Inventory Transaction Logged: ID: ${txLog.id}, Type: ${txLog.type}, Notes: "${txLog.notes}"`);
    } else {
        console.warn(`⚠️ Warning: No inventory transaction logged.`);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
