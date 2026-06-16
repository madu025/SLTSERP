
import { prisma } from '../src/lib/prisma';
import { InventoryService } from '../src/services/inventory.service';

const testFlow = async () => {
    console.log("🚀 Starting Inventory Workflow Automation Test...");

    try {
        // 1. SETUP: Find required resources
        console.log("Step 1: finding resources...");

        const mainStore = await prisma.inventoryStore.findFirst({ where: { type: 'MAIN' } });
        if (!mainStore) throw new Error("No MAIN store found");
        console.log(`✅ Main Store: ${mainStore.name}`);

        const subStore = await prisma.inventoryStore.findFirst({ where: { type: 'SUB' } });
        if (!subStore) throw new Error("No SUB store found");
        console.log(`✅ Sub Store: ${subStore.name}`);

        const item = await prisma.inventoryItem.findFirst();
        if (!item) throw new Error("No Item found");
        console.log(`✅ Item: ${item.name}`);

        // Get or Create Users for roles
        const getOrCreateUser = async (role: string, name: string) => {
            let user = await prisma.user.findFirst({ where: { role: role as any } });
            if (!user) {
                console.log(`Creating temp user for role ${role}...`);
                try {
                    user = await prisma.user.create({
                        data: {
                            username: `test_${role.toLowerCase()}`,
                            email: `test_${role.toLowerCase()}@example.com`,
                            password: 'password',
                            role: role as any,
                            name: name
                        }
                    });
                } catch (e) {
                    // fallback if constraint fail
                    user = await prisma.user.findFirst({ where: { username: `test_${role.toLowerCase()}` } });
                }
            }
            return user!;
        };

        const requester = await prisma.user.findFirst() || await getOrCreateUser('ENGINEER', 'Test Engineer');
        const armUser = await getOrCreateUser('AREA_MANAGER', 'Test ARM');
        const storesMgr = await getOrCreateUser('STORES_MANAGER', 'Test Stores Mgr');
        const ospMgr = await getOrCreateUser('OSP_MANAGER', 'Test OSP Mgr');
        const assistant = await getOrCreateUser('STORES_ASSISTANT', 'Test Assistant');

        console.log("✅ Users identified/created.");

        // 2. CREATE REQUEST (Sub Store -> Main Store)
        console.log("\nStep 2: Creating Request (Sub -> Main)...");
        const requestData = {
            fromStoreId: subStore.id,
            toStoreId: null, // Should auto-set to Main Store or we pass it if UI does?
            // Service logic: if (sourceType !== 'LOCAL' && !toStoreId) -> Find Main Store.
            // Wait, UI passes 'MAIN_STORE' as sourceType? 
            // Let's pass 'MAIN_STORE' as sourceType.
            requestedById: requester.id,
            priority: 'MEDIUM',
            requiredDate: new Date(),
            purpose: 'Automation Test',
            sourceType: 'MAIN_STORE',
            items: [{
                itemId: item.id,
                requestedQty: 10,
                remarks: 'Test Item'
            }]
        };

        const request = await InventoryService.createStockRequest(requestData);
        console.log(`✅ Request Created: ${request.requestNr}`);
        console.log(`   Stage: ${request.workflowStage}`);

        if (request.workflowStage !== 'ARM_APPROVAL') throw new Error(`Expected ARM_APPROVAL, got ${request.workflowStage}`);

        // 3. ARM APPROVAL
        console.log("\nStep 3: ARM Approval...");
        const afterArm = await InventoryService.processStockRequestAction({
            requestId: request.id,
            action: 'ARM_APPROVE',
            approvedById: armUser.id,
            remarks: 'ARM Approved via Script'
        });
        console.log(`✅ ARM Approved. New Stage: ${afterArm.workflowStage}`);
        if (afterArm.workflowStage !== 'STORES_MANAGER_APPROVAL') throw new Error(`Expected STORES_MANAGER_APPROVAL, got ${afterArm.workflowStage}`);

        // 4. STORES MANAGER APPROVAL
        console.log("\nStep 4: Stores Manager Approval...");
        const afterStores = await InventoryService.processStockRequestAction({
            requestId: request.id,
            action: 'STORES_MANAGER_APPROVE',
            approvedById: storesMgr.id,
            remarks: 'Stores Manager Approved via Script'
        });
        console.log(`✅ Stores Manager Approved. New Stage: ${afterStores.workflowStage}`);
        if (afterStores.workflowStage !== 'OSP_MANAGER_APPROVAL') throw new Error(`Expected OSP_MANAGER_APPROVAL, got ${afterStores.workflowStage}`);

        // 5. OSP MANAGER APPROVAL
        console.log("\nStep 5: OSP Manager Approval...");
        const afterOsp = await InventoryService.processStockRequestAction({
            requestId: request.id,
            action: 'OSP_MANAGER_APPROVE',
            approvedById: ospMgr.id,
            remarks: 'OSP Manager Approved via Script',
            allocation: [{ itemId: item.id, approvedQty: 10 }]
        });
        console.log(`✅ OSP Manager Approved. New Stage: ${afterOsp.workflowStage}`);
        if (afterOsp.workflowStage !== 'MAIN_STORE_RELEASE') throw new Error(`Expected MAIN_STORE_RELEASE, got ${afterOsp.workflowStage}`);

        // 6. MAIN STORE RELEASE
        console.log("\nStep 6: Main Store Release...");
        // Need to ensure Main Store has stock! 
        // Let's add mock stock first to avoid insufficient stock error
        await prisma.inventoryStock.upsert({
            where: { storeId_itemId: { storeId: mainStore.id, itemId: item.id } },
            update: { quantity: { increment: 100 } },
            create: { storeId: mainStore.id, itemId: item.id, quantity: 100 }
        });

        const afterRelease = await InventoryService.processStockRequestAction({
            requestId: request.id,
            action: 'MAIN_STORE_RELEASE',
            approvedById: assistant.id,
            remarks: 'Released via Script',
            allocation: [{ itemId: item.id, issuedQty: 10 }]
        });
        console.log(`✅ Materials Released. New Stage: ${afterRelease.workflowStage}`);
        if (afterRelease.workflowStage !== 'SUB_STORE_RECEIVE') throw new Error(`Expected SUB_STORE_RECEIVE, got ${afterRelease.workflowStage}`);

        // 7. SUB STORE RECEIVE
        console.log("\nStep 7: Sub Store Receive...");
        const afterReceive = await InventoryService.processStockRequestAction({
            requestId: request.id,
            action: 'SUB_STORE_RECEIVE',
            approvedById: requester.id, // Assuming requester receives
            remarks: 'Received via Script',
            allocation: [{ itemId: item.id, receivedQty: 10 }]
        });
        console.log(`✅ Materials Received. New Stage: ${afterReceive.workflowStage}`);
        console.log(`   Final Status: ${afterReceive.status}`);
        if (afterReceive.status !== 'COMPLETED') throw new Error(`Expected COMPLETED, got ${afterReceive.status}`);

        console.log("\n🎉 TEST PASSED SUCCESSFULLY!");

    } catch (error) {
        console.error("\n❌ TEST FAILED:", error);
    } finally {
        await prisma.$disconnect();
    }
};

testFlow();
