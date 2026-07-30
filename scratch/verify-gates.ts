import { PrismaClient } from '@prisma/client';
import { ProcessGateAdminService } from '../src/services/admin/process-gate.service';
import { ProcessGateEngine } from '../src/services/ProcessGateEngine';

const prisma = new PrismaClient();

async function run() {
  console.log("=== Verifying Process Gate Admin Service ===");
  try {
    // Cleanup first
    await prisma.processGatePolicy.deleteMany({
      where: { entityType: 'TEST_SOD' }
    });

    // 1. Create a Gate
    console.log("1. Creating Gate Policy...");
    const gate = await ProcessGateAdminService.createGate({
      entityType: 'TEST_SOD',
      fromStatus: 'PENDING',
      toStatus: 'INVOICABLE',
      label: 'Test Invoicable Gate',
      reqOpmcPat: true,
      writeAuditLedger: true
    });
    console.log("Gate created:", gate.id);

    // 2. Add an Approval Level
    console.log("2. Adding Approval Level 1...");
    const level1 = await ProcessGateAdminService.addApprovalLevel(gate.id, {
      requiredRole: 'ENGINEER',
      description: 'First approval by engineer'
    });
    console.log("Level 1 created:", level1.id);

    // 3. Add a second Approval Level
    console.log("3. Adding Approval Level 2...");
    const level2 = await ProcessGateAdminService.addApprovalLevel(gate.id, {
      requiredRole: 'AREA_MANAGER',
      minAmount: 50000
    });
    console.log("Level 2 created:", level2.id);

    // 4. Fetch all gates
    console.log("4. Fetching all gates...");
    const allGates = await ProcessGateAdminService.getAllGates();
    const myGate = allGates.find(g => g.id === gate.id);
    console.log("Found gate with", myGate?.approvalLevels.length, "levels.");

    // 5. Trigger Process Gate Engine to test evaluation
    console.log("5. Testing Process Gate Engine Evaluation...");
    const result = await ProcessGateEngine.evaluateAndTriggerGate(
      'TEST_SOD',
      'sod-123',
      'PENDING',
      'INVOICABLE',
      { userId: 'test-user', amount: 60000, hasOpmcPat: true }
    );
    console.log("Engine Evaluation Result:", result.status);

    // 6. Delete Level
    console.log("6. Deleting Level 1...");
    await ProcessGateAdminService.deleteApprovalLevel(gate.id, level1.id);
    console.log("Level 1 deleted. Testing reorder...");
    const gateAfterDelete = await ProcessGateAdminService.getAllGates();
    const updatedGate = gateAfterDelete.find(g => g.id === gate.id);
    console.log("Remaining levels after delete:");
    updatedGate?.approvalLevels.forEach(l => console.log(`- Level ${l.level}: ${l.requiredRole}`));

    // 7. Cleanup Gate
    console.log("7. Deleting Gate...");
    await ProcessGateAdminService.deleteGate(gate.id);
    console.log("Gate deleted.");

    console.log("✅ Verification Completed Successfully!");

  } catch (error) {
    console.error("❌ Verification Failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
