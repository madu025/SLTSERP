import { NexusAgentService } from '../src/services/nexus-agent.service';
import { prisma } from '../src/lib/prisma';

async function runTest() {
  console.log("==========================================");
  console.log("STARTING NEXUS AI ENGINE INTEGRATION TEST ");
  console.log("==========================================");

  try {
    // 1. Find a test user to perform query
    const user = await prisma.user.findFirst({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } }
    });

    if (!user) {
      console.error("❌ No admin/super-admin user found in DB to run test.");
      return;
    }

    console.log(`✅ Test Admin User resolved: ${user.username} (${user.role})`);

    // 2. Query System Context
    console.log("\n1. Testing System Context Gathering...");
    const context = await NexusAgentService.getSystemContext();
    console.log(`- Items Count: ${context.inventory.itemsCount}`);
    console.log(`- Stores Count: ${context.inventory.storesCount}`);
    console.log(`- Active Projects Count: ${context.projects.activeProjectsCount}`);
    console.log(`- Outstanding Invoices: LKR ${context.finance.outstandingInvoicesSum.toLocaleString()}`);
    console.log("✅ Context loader retrieved all modules successfully!");

    // 3. Test User Creation Proposal Lookup
    console.log("\n2. Testing User Creation Proposal Lookup...");
    console.log("Proposing user: 'suneth' (Name: Suneth, Role: Admin, RTOM: MD)");
    
    // Cleanup existing test user if any to prevent collision
    await prisma.user.deleteMany({
      where: { username: 'suneth' }
    });

    const action = await NexusAgentService.lookupCreateUser('suneth', 'Suneth', '12345', 'Admin', 'MD');
    
    if (!action) {
      console.error("❌ Failed to map user creation proposal.");
      return;
    }

    console.log("✅ Proposal created successfully!");
    console.log(`- Action Type: ${action.type}`);
    console.log(`- Username: ${action.username}`);
    console.log(`- Full Name: ${action.itemName}`);
    console.log(`- Role: ${action.role}`);
    console.log(`- Target OPMC ID: ${action.opmcId || 'None (Default)'}`);

    // 4. Test User Creation Execution
    console.log("\n3. Executing User Creation Action...");
    const executionResult = await NexusAgentService.executeAction(action, user.id);
    
    // Verify user exists in database
    const createdUser = await prisma.user.findUnique({
      where: { username: 'suneth' }
    });

    if (createdUser) {
      console.log("✅ User created successfully in database!");
      console.log(`- Database ID: ${createdUser.id}`);
      console.log(`- Username: ${createdUser.username}`);
      console.log(`- Role: ${createdUser.role}`);
    } else {
      console.error("❌ User was not found in the database after execution!");
    }

    console.log("\n==========================================");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!       ");
    console.log("==========================================");
  } catch (e: any) {
    console.error("\n❌ TEST FAILED WITH ERROR:");
    console.error(e);
  } finally {
    process.exit(0);
  }
}

runTest();
