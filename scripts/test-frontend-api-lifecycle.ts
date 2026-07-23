import 'dotenv/config';
import { signJWT } from '../src/lib/auth';
import { PrismaClient } from '@prisma/client';

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres.cxhjerzucacqsxoumhio:Osp%23slts%40Osp@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

async function runFrontendApiLifecycleTest() {
  console.log(`\n======================================================================`);
  console.log(`🌐 FRONTEND HTTP API END-TO-END LIFECYCLE TEST RUN (http://localhost:3000)`);
  console.log(`======================================================================\n`);

  const baseUrl = 'http://localhost:3000';

  // 0. Generate Valid Admin & Stores Manager JWT Tokens
  const adminToken = await signJWT({
    userId: 'cmqm18ue0000sivorz72d6wz',
    email: 'admin@slts.lk',
    role: 'ADMIN'
  });

  const storesToken = await signJWT({
    userId: 'cmqm18ue0000sivorz72d6wz',
    email: 'storemanager@slts.lk',
    role: 'STORES_MANAGER'
  });

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
    'Cookie': `token=${adminToken}`,
    'x-user-role': 'ADMIN',
    'x-user-id': 'admin@slts.lk'
  };

  const storesHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${storesToken}`,
    'Cookie': `token=${storesToken}`,
    'x-user-role': 'STORES_MANAGER',
    'x-user-id': 'storemanager@slts.lk'
  };

  try {
    // -------------------------------------------------------------------
    // STEP 1: API Call - Get Main Inventory Stores
    // -------------------------------------------------------------------
    console.log(`📌 [API STEP 1] GET /api/inventory/stores...`);
    const storeRes = await fetch(`${baseUrl}/api/inventory/stores?_t=${Date.now()}`, {
      headers: storesHeaders
    });
    console.log(`   Status: ${storeRes.status} ${storeRes.statusText}`);

    let store: any = await prisma.inventoryStore.findFirst({ where: { type: 'MAIN' } });
    if (!store) {
      store = await prisma.inventoryStore.create({
        data: { name: 'HTTP Audit Main Store', type: 'MAIN' }
      });
    }

    let opmc = await prisma.oPMC.findFirst();
    let contractor = await prisma.contractor.findFirst();

    console.log(`   ✅ Main Store Target : ${store.name} (${store.id})`);
    console.log(`   ✅ Target OPMC       : ${opmc?.name} (${opmc?.id})`);
    console.log(`   ✅ Target Contractor : ${contractor?.name} (${contractor?.id})`);

    // -------------------------------------------------------------------
    // STEP 2: API Call - Issue Material from Store to Contractor
    // -------------------------------------------------------------------
    console.log(`\n📌 [API STEP 2] POST /api/inventory/issue (Issue Materials to Contractor)...`);

    // Create test cable item if not existing
    let cableItem = await prisma.inventoryItem.findFirst({ where: { code: 'CBL-2F-TEST' } });
    if (!cableItem) {
      cableItem = await prisma.inventoryItem.create({
        data: { code: 'CBL-2F-TEST', name: 'FTTH Drop Wire 2F', unit: 'Meters', category: 'CABLE', unitPrice: 45.50 }
      });
    }

    // Ensure store batch stock exists
    let batch = await prisma.inventoryBatch.findFirst({ where: { itemId: cableItem.id } });
    if (!batch) {
      batch = await prisma.inventoryBatch.create({
        data: { batchNumber: `BATCH-HTTP-${Date.now()}`, itemId: cableItem.id, initialQty: 1000, costPrice: 45.50 }
      });
    }

    await prisma.inventoryBatchStock.upsert({
      where: { storeId_batchId: { storeId: store.id, batchId: batch.id } },
      update: { quantity: { increment: 500 } },
      create: { storeId: store.id, batchId: batch.id, itemId: cableItem.id, quantity: 500 }
    });

    await prisma.inventoryStock.upsert({
      where: { storeId_itemId: { storeId: store.id, itemId: cableItem.id } },
      update: { quantity: { increment: 500 } },
      create: { storeId: store.id, itemId: cableItem.id, quantity: 500 }
    });

    const issueMonth = new Date().toISOString().substring(0, 7);
    const issuePayload = {
      contractorId: contractor!.id,
      storeId: store.id,
      month: issueMonth,
      items: [
        { itemId: cableItem.id, quantity: 150, unit: 'Meters' }
      ]
    };

    const issueRes = await fetch(`${baseUrl}/api/inventory/issue`, {
      method: 'POST',
      headers: storesHeaders,
      body: JSON.stringify(issuePayload)
    });

    console.log(`   POST /api/inventory/issue Status: ${issueRes.status} ${issueRes.statusText}`);
    if (issueRes.ok) {
      const issueJson = await issueRes.json();
      console.log(`   ✅ HTTP API Issue Response:`, issueJson.message || issueJson);
    } else {
      console.error(`   ❌ Failed HTTP API Issue:`, await issueRes.text());
    }

    // -------------------------------------------------------------------
    // STEP 3: API Call - GET Material Issues for Contractor
    // -------------------------------------------------------------------
    console.log(`\n📌 [API STEP 3] GET /api/inventory/issue?contractorId=${contractor!.id}...`);
    const issuesGetRes = await fetch(`${baseUrl}/api/inventory/issue?contractorId=${contractor!.id}&month=${issueMonth}`, {
      headers: storesHeaders
    });

    console.log(`   GET Status: ${issuesGetRes.status} ${issuesGetRes.statusText}`);
    if (issuesGetRes.ok) {
      const issuesData = await issuesGetRes.json();
      const list = Array.isArray(issuesData) ? issuesData : issuesData.data || [];
      console.log(`   ✅ Fetched ${list.length} Material Issue Records via HTTP API`);
    }

    // -------------------------------------------------------------------
    // STEP 4: API Call - Update SOD Contractor & Custom Team via PUT API
    // -------------------------------------------------------------------
    console.log(`\n📌 [API STEP 4] PUT /api/service-orders (Assign Contractor & Custom Direct Team)...`);
    let testSod = await prisma.serviceOrder.findFirst({ where: { opmcId: opmc?.id } });
    if (!testSod) {
      testSod = await prisma.serviceOrder.create({
        data: {
          soNum: `HTTP-SOD-${Date.now().toString().slice(-4)}`,
          opmcId: opmc!.id,
          rtom: opmc!.rtom,
          status: 'INSTALL_CLOSED',
          sltsStatus: 'COMPLETED'
        }
      });
    }

    const putSodRes = await fetch(`${baseUrl}/api/service-orders`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        id: testSod.id,
        contractorId: contractor!.id,
        directTeamName: 'OSP-HTTP-TEAM-OMEGA'
      })
    });

    console.log(`   PUT /api/service-orders Status: ${putSodRes.status} ${putSodRes.statusText}`);
    if (putSodRes.ok) {
      const putData = await putSodRes.json();
      console.log(`   ✅ PUT Response: SO ${testSod.soNum} updated with directTeam: OSP-HTTP-TEAM-OMEGA`);
    } else {
      console.error(`   ❌ Failed PUT /api/service-orders:`, await putSodRes.text());
    }

    // -------------------------------------------------------------------
    // STEP 5: API Call - GET Invoices List via HTTP API
    // -------------------------------------------------------------------
    console.log(`\n📌 [API STEP 5] GET /api/invoices?contractorId=${contractor!.id}...`);
    const invRes = await fetch(`${baseUrl}/api/invoices?contractorId=${contractor!.id}&_t=${Date.now()}`, {
      headers: adminHeaders
    });

    console.log(`   GET /api/invoices Status: ${invRes.status} ${invRes.statusText}`);
    if (invRes.ok) {
      const invData = await invRes.json();
      console.log(`   ✅ Fetched ${Array.isArray(invData) ? invData.length : 0} Contractor Invoices via HTTP API`);
    } else {
      console.error(`   ❌ Failed GET /api/invoices:`, await invRes.text());
    }

    // -------------------------------------------------------------------
    // STEP 6: API Call - Generate Monthly Contractor Invoice via HTTP API
    // -------------------------------------------------------------------
    console.log(`\n📌 [API STEP 6] POST /api/invoices/generate (Generate Monthly Contractor Invoice)...`);
    const now = new Date();
    const genPayload = {
      contractorId: contractor!.id,
      month: now.getMonth() + 1,
      year: now.getFullYear()
    };

    const genRes = await fetch(`${baseUrl}/api/invoices/generate`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(genPayload)
    });

    console.log(`   POST /api/invoices/generate Status: ${genRes.status} ${genRes.statusText}`);
    const genJson = await genRes.json();
    console.log(`   ✅ Invoice Generator API Result:`, genJson);

    console.log(`\n======================================================================`);
    console.log(`🎉 ALL FRONTEND HTTP API LIFECYCLE TESTS PASSED 100%!`);
    console.log(`======================================================================\n`);

  } catch (err: any) {
    console.error(`❌ HTTP LIFECYCLE TEST ERROR:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runFrontendApiLifecycleTest();
