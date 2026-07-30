import { prisma } from './src/lib/prisma';
import { ProcessGateEngine } from './src/services/approval/process-gate-engine';
import { StockRequestService } from './src/services/inventory/stock-request.service';

async function simulate() {
  console.log("=== Starting End-to-End MRN Workflow Simulation ===");

  const subStore = await prisma.inventoryStore.findFirst({ where: { type: 'SUB' } });
  const user = await prisma.user.findFirst({ where: { role: 'AREA_MANAGER' } });
  const item = await prisma.inventoryItem.findFirst();

  if (!subStore || !user || !item) {
    console.log("Missing prerequisites (Sub store, Area Manager, or Item).");
    return;
  }

  // 1. Create the Request
  console.log(`\n1. Creating Material Request for Sub Store: ${subStore.name}...`);
  const req = await StockRequestService.createStockRequest({
    fromStoreId: subStore.id,
    requestedById: user.id,
    items: [{ itemId: item.id, requestedQty: 10, remarks: "Sim test item" }],
    priority: "HIGH",
    purpose: "Simulation Test",
    sourceType: "MAIN_STORE"
  });

  console.log(`Created Request: ${req.requestNr}, Stage: ${req.workflowStage}`);

  // Helper to simulate webhook action
  async function simulateWebhook(instanceId: string, userId: string, remarks: string) {
      const gateResult = await ProcessGateEngine.advanceGate({
        instanceId,
        userId,
        remarks,
        action: "APPROVED"
      });

      if (gateResult.status === 'GATE_PASSED') {
        await StockRequestService.processStockRequestAction({
            action: 'GATE_PASSED',
            requestId: gateResult.entityId,
            userId: userId,
            remarks: remarks
        });
      }
  }

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // 2. ARM Approval
  let instance = await prisma.universalApprovalInstance.findFirst({
    where: { entityId: req.id, status: 'PENDING' }
  });
  console.log(`\n2. Simulating ARM Webhook Approval... (Instance: ${instance?.id})`);
  await simulateWebhook(instance!.id, user.id, "ARM Sim Approval");

  let updatedReq = await prisma.stockRequest.findUnique({ where: { id: req.id } });
  console.log(`=> Stage is now: ${updatedReq?.workflowStage}`);
  
  await delay(2000);

  // 3. Stores Manager Approval
  instance = await prisma.universalApprovalInstance.findFirst({
    where: { entityId: req.id, status: 'PENDING' }
  });
  console.log(`\n3. Simulating STORES MANAGER Webhook Approval... (Instance: ${instance?.id})`);
  await simulateWebhook(instance!.id, user.id, "Stores Sim Approval");

  updatedReq = await prisma.stockRequest.findUnique({ where: { id: req.id } });
  console.log(`=> Stage is now: ${updatedReq?.workflowStage}`);

  // 4. OSP Manager Approval
  instance = await prisma.universalApprovalInstance.findFirst({
    where: { entityId: req.id, status: 'PENDING' }
  });
  console.log(`\n4. Simulating OSP MANAGER Webhook Approval... (Instance: ${instance?.id})`);
  await simulateWebhook(instance!.id, user.id, "OSP Sim Approval");

  updatedReq = await prisma.stockRequest.findUnique({ where: { id: req.id } });
  console.log(`=> Stage is now: ${updatedReq?.workflowStage}`);
  console.log(`\nSimulation Complete.`);
}

simulate().catch(e => console.error(e)).finally(() => prisma.$disconnect());
