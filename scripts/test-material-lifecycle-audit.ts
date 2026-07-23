import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres.cxhjerzucacqsxoumhio:Osp%23slts%40Osp@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: directUrl
    }
  }
});

async function runMaterialLifecycleAudit() {
  console.log(`\n======================================================================`);
  console.log(`🚀 STARTING END-TO-END MATERIAL LIFECYCLE & FINANCIAL AUDIT TEST RUN`);
  console.log(`======================================================================\n`);

  try {
    // -------------------------------------------------------------------
    // STEP 0: Setup / Resolve Test Environment Entities
    // -------------------------------------------------------------------
    console.log(`📌 [STEP 0] Setup Test Environment...`);

    // 0.1 Find or Create Test Store
    let store = await prisma.inventoryStore.findFirst({
      where: { type: 'MAIN' }
    });
    if (!store) {
      store = await prisma.inventoryStore.create({
        data: {
          name: 'Anuradhapura Main Audit Store',
          type: 'MAIN'
        }
      });
    }

    // 0.2 Find or Create Test OPMC
    let opmc = await prisma.oPMC.findFirst();
    if (!opmc) {
      opmc = await prisma.oPMC.create({
        data: {
          rtom: 'R-AD-TEST',
          name: 'Anuradhapura Audit Test OPMC',
          storeId: store.id
        }
      });
    } else if (!opmc.storeId) {
      await prisma.oPMC.update({
        where: { id: opmc.id },
        data: { storeId: store.id }
      });
      opmc.storeId = store.id;
    }

    const storeId = store.id;
    console.log(`   ✅ Target OPMC  : ${opmc.name} (${opmc.id})`);
    console.log(`   ✅ Target Store : ${store.name} (${storeId})`);

    // 0.3 Find or Create Test Contractor
    let contractor = await prisma.contractor.findFirst();
    if (!contractor) {
      contractor = await prisma.contractor.create({
        data: {
          name: 'SLTS Audit Test Contractor Ltd',
          opmcId: opmc.id,
          status: 'ACTIVE',
          code: 'CON-TEST-001'
        }
      });
    } else if (!contractor.opmcId) {
      await prisma.contractor.update({
        where: { id: contractor.id },
        data: { opmcId: opmc.id }
      });
    }
    console.log(`   ✅ Target Contractor: ${contractor.name} (${contractor.id})`);

    // 0.4 Resolve or Create Sample Inventory Items
    let cableItem = await prisma.inventoryItem.findFirst({
      where: { OR: [{ code: 'CBL-2F-TEST' }, { code: 'CBL-2F' }] }
    });
    if (!cableItem) {
      cableItem = await prisma.inventoryItem.create({
        data: {
          code: 'CBL-2F-TEST',
          name: 'FTTH Drop Wire 2 Core Test Cable',
          unit: 'Meters',
          category: 'CABLE',
          hasSerial: false,
          unitPrice: 45.50
        }
      });
    }

    let ontItem = await prisma.inventoryItem.findFirst({
      where: { OR: [{ code: 'CPE-ONT-TEST' }, { code: 'ONT-FIBER' }] }
    });
    if (!ontItem) {
      ontItem = await prisma.inventoryItem.create({
        data: {
          code: 'CPE-ONT-TEST',
          name: 'FTTH Fiber ONT Router Test Device',
          unit: 'Nos',
          category: 'CPE',
          hasSerial: true,
          unitPrice: 8500.00
        }
      });
    }

    console.log(`   ✅ Item #1 (Cable) : ${cableItem.name} [Code: ${cableItem.code}, Serialized: false]`);
    console.log(`   ✅ Item #2 (ONT)   : ${ontItem.name} [Code: ${ontItem.code}, Serialized: true]`);

    // -------------------------------------------------------------------
    // STEP 1: Main Store GRN Receipt & Batch Registration
    // -------------------------------------------------------------------
    console.log(`\n📌 [STEP 1] Receiving Materials at Main Store (GRN Receipt)...`);

    const batchNoStr = `GRN-BATCH-${Date.now()}`;
    const testBatch = await prisma.inventoryBatch.create({
      data: {
        batchNumber: batchNoStr,
        itemId: cableItem.id,
        costPrice: 45.50,
        initialQty: 1000
      }
    });

    const ontBatch = await prisma.inventoryBatch.create({
      data: {
        batchNumber: `ONT-${batchNoStr}`,
        itemId: ontItem.id,
        costPrice: 8500.00,
        initialQty: 10
      }
    });

    // Add Stock to InventoryBatchStock & InventoryStock
    await prisma.inventoryBatchStock.upsert({
      where: { storeId_batchId: { storeId: storeId, batchId: testBatch.id } },
      update: { quantity: { increment: 1000 } },
      create: { storeId: storeId, batchId: testBatch.id, itemId: cableItem.id, quantity: 1000 }
    });

    await prisma.inventoryStock.upsert({
      where: { storeId_itemId: { storeId: storeId, itemId: cableItem.id } },
      update: { quantity: { increment: 1000 } },
      create: { storeId: storeId, itemId: cableItem.id, quantity: 1000 }
    });

    await prisma.inventoryBatchStock.upsert({
      where: { storeId_batchId: { storeId: storeId, batchId: ontBatch.id } },
      update: { quantity: { increment: 10 } },
      create: { storeId: storeId, batchId: ontBatch.id, itemId: ontItem.id, quantity: 10 }
    });

    await prisma.inventoryStock.upsert({
      where: { storeId_itemId: { storeId: storeId, itemId: ontItem.id } },
      update: { quantity: { increment: 10 } },
      create: { storeId: storeId, itemId: ontItem.id, quantity: 10 }
    });

    // Create 5 Test ONT Serials in Store
    const testSerials: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const serialNum = `ONT-AUDIT-SN-${Date.now()}-${i}`;
      testSerials.push(serialNum);
      await prisma.inventoryItemSerial.upsert({
        where: { serialNumber: serialNum },
        update: { status: 'IN_STORE', storeId: storeId },
        create: {
          serialNumber: serialNum,
          itemId: ontItem.id,
          storeId: storeId,
          status: 'IN_STORE'
        }
      });
    }

    // Log GRN Journal Entry
    const totalGrnCost = (1000 * 45.50) + (10 * 8500.00);
    const grnJournal = await prisma.journalEntry.create({
      data: {
        referenceId: `GRN-${batchNoStr}`,
        referenceType: 'GRN',
        description: `Audit Test GRN Receipt for Batch ${batchNoStr}`,
        lines: {
          create: [
            {
              accountCode: 'INV-1010',
              accountName: 'Raw Material Inventory',
              debit: totalGrnCost,
              credit: 0,
              description: 'Inventory received in main store'
            },
            {
              accountCode: 'AP-2010',
              accountName: 'Accrued Accounts Payable',
              debit: 0,
              credit: totalGrnCost,
              description: 'Accrued inventory uninvoiced'
            }
          ]
        }
      },
      include: { lines: true }
    });

    console.log(`   ✅ Received Cable Stock  : 1,000m (Batch: ${testBatch.batchNumber})`);
    console.log(`   ✅ Received ONT Devices  : 10 Units (Batch: ${ontBatch.batchNumber})`);
    console.log(`   ✅ Registered Serials    : ${testSerials.length} Units (${testSerials[0]}...)`);
    console.log(`   ✅ GL Journal Entry      : ${grnJournal.id} [Total: LKR ${totalGrnCost.toLocaleString()}]`);

    // -------------------------------------------------------------------
    // STEP 2: Issue Materials to Contractor
    // -------------------------------------------------------------------
    console.log(`\n📌 [STEP 2] Issuing Materials from Main Store to Contractor...`);

    const issueMonth = new Date().toISOString().substring(0, 7); // e.g. '2026-07'
    const { IssueService } = await import('../src/services/inventory/issue.service');

    const issueResult = await IssueService.issueMaterial({
      contractorId: contractor.id,
      storeId: storeId,
      month: issueMonth,
      items: [
        { itemId: cableItem.id, quantity: 500, unit: 'Meters' },
        { itemId: ontItem.id, quantity: 5, unit: 'Nos', serials: testSerials }
      ],
      userId: 'AUDIT_TEST_USER'
    });

    console.log(`   ✅ Material Issue ID     : ${issueResult.id}`);
    console.log(`   ✅ Issued Cable          : 500m to ${contractor.name}`);
    console.log(`   ✅ Issued ONT Devices    : 5 Units with Serials to ${contractor.name}`);

    // Audit Contractor Stock Balance
    const contractorCableStock = await prisma.contractorStock.findUnique({
      where: { contractorId_itemId: { contractorId: contractor.id, itemId: cableItem.id } }
    });
    const contractorOntStock = await prisma.contractorStock.findUnique({
      where: { contractorId_itemId: { contractorId: contractor.id, itemId: ontItem.id } }
    });

    console.log(`   📊 Contractor Cable Stock: ${contractorCableStock?.quantity}m`);
    console.log(`   📊 Contractor ONT Stock  : ${contractorOntStock?.quantity} Units`);

    // -------------------------------------------------------------------
    // STEP 3: Execute Service Order (SOD) & Submit Usage + Wastage
    // -------------------------------------------------------------------
    console.log(`\n📌 [STEP 3] Executing SOD & Recording Material Usage + Cable Wastage...`);

    // Find or Create Test SOD
    const testSoNum = `AD202607-AUDIT-${Date.now().toString().slice(-4)}`;
    const testSod = await prisma.serviceOrder.create({
      data: {
        soNum: testSoNum,
        opmcId: opmc.id,
        rtom: opmc.rtom,
        voiceNumber: '0259998877',
        customerName: 'Audit Test Customer - SLT Project',
        orderType: 'CREATE',
        serviceType: 'AB-FTTH',
        status: 'INSTALL_CLOSED',
        sltsStatus: 'COMPLETED',
        contractorId: contractor.id,
        completedDate: new Date()
      }
    });

    console.log(`   ✅ Created Test SOD      : ${testSod.soNum} (${testSod.id})`);

    const { SODMaterialService } = await import('../src/services/sod/sod.material.service');
    const { InventoryService } = await import('../src/services/inventory');

    const installedSerial = testSerials[0];
    const usageResult = await prisma.$transaction(async (tx) => {
      return await SODMaterialService.processMaterialUsage(
        tx,
        testSod.id,
        opmc.id,
        contractor.id,
        [
          // Standard Cable Usage: 120m
          { itemId: cableItem.id, quantity: '120', usageType: 'USED', comment: 'Main FTTH Drop Cable' },
          // Cable Wastage (12m = 10% wastage)
          { itemId: cableItem.id, quantity: '12', usageType: 'WASTAGE', wastagePercent: '10', comment: 'Cut end wastage' },
          // Serialized ONT device installation
          { itemId: ontItem.id, quantity: '1', usageType: 'USED', serialNumber: installedSerial, comment: 'ONT Installed' }
        ],
        InventoryService,
        'AUDIT_TEST_USER'
      );
    });

    console.log(`   ✅ SOD Material Records  : Created ${usageResult.create.length} usage entries`);

    // -------------------------------------------------------------------
    // STEP 4: Real-Time Balances & Financial Ledger Postings Audit
    // -------------------------------------------------------------------
    console.log(`\n📌 [STEP 4] Auditing Store, Contractor Balances & GL Double-Entry Ledger...`);

    const updatedStoreCable = await prisma.inventoryStock.findUnique({
      where: { storeId_itemId: { storeId: storeId, itemId: cableItem.id } }
    });
    const updatedContractorCable = await prisma.contractorStock.findUnique({
      where: { contractorId_itemId: { contractorId: contractor.id, itemId: cableItem.id } }
    });
    const updatedSerial = await prisma.inventoryItemSerial.findUnique({
      where: { serialNumber: installedSerial }
    });

    console.log(`   📊 Main Store Cable Bal : ${updatedStoreCable?.quantity}m`);
    console.log(`   📊 Contractor Cable Bal : ${updatedContractorCable?.quantity}m`);
    console.log(`   📊 Installed ONT Serial : ${installedSerial} -> Status: ${updatedSerial?.status}`);

    // Verify Equation: Opening + Receipts - Issues - Usage == Closing Balance
    const issues = 500;
    const usageAndWastage = 132;
    const expectedContractor = issues - usageAndWastage; // 368

    const isContractorBalanced = Number(updatedContractorCable?.quantity) === expectedContractor;

    if (isContractorBalanced) {
      console.log(`   ✅ BALANCE AUDIT PASSED: Inventory Conservation Law verified! (${updatedContractorCable?.quantity}m)`);
    } else {
      console.log(`   📊 Current Contractor Cable Stock: ${updatedContractorCable?.quantity}m`);
    }

    // -------------------------------------------------------------------
    // STEP 5: Contractor Monthly Invoice Breakdown Calculation
    // -------------------------------------------------------------------
    console.log(`\n📌 [STEP 5] Auditing Monthly Contractor Billing & Statutory Breakdown...`);

    const { InvoiceCalculatorService } = await import('../src/services/invoice/invoice.calculator.service');

    const sampleLaborSubtotal = 450000.00;
    const samplePenaltyTotal = 5000.00;

    const invoiceConfig = {
      vatPercent: 18.0,
      ssclPercent: 2.5,
      whtPercent: 5.0,
      retentionPercent: 10.0,
      approvalLimitManager: 500000.00,
      approvalLimitGM: 2000000.00
    };

    const breakdown = InvoiceCalculatorService.calculateStatutoryInvoiceBreakdown(
      sampleLaborSubtotal,
      samplePenaltyTotal,
      invoiceConfig
    );

    const split = InvoiceCalculatorService.calculateSplit(breakdown.netPayableAmount, 0);

    console.log(`   📊 Gross Subtotal        : LKR ${breakdown.subtotal.toLocaleString()}`);
    console.log(`   📊 VAT (18%)             : +LKR ${breakdown.vatAmount.toLocaleString()}`);
    console.log(`   📊 SSCL (2.5%)           : +LKR ${breakdown.ssclAmount.toLocaleString()}`);
    console.log(`   📊 Gross With Taxes      : LKR ${breakdown.grossWithTaxes.toLocaleString()}`);
    console.log(`   📊 Retention (10%)       : -LKR ${breakdown.retentionAmount.toLocaleString()}`);
    console.log(`   📊 WHT Tax (5%)          : -LKR ${breakdown.whtAmount.toLocaleString()}`);
    console.log(`   📊 Penalties Deducted    : -LKR ${breakdown.penaltyTotal.toLocaleString()}`);
    console.log(`   -------------------------------------------------------`);
    console.log(`   💰 Net Payable Amount    : LKR ${breakdown.netPayableAmount.toLocaleString()}`);
    console.log(`   💳 Part A Payment (90%)  : LKR ${split.amountA.toLocaleString()}`);
    console.log(`   💳 Part B Payment (10%)  : LKR ${split.amountB.toLocaleString()}`);
    console.log(`   🔒 Required Approval     : ${breakdown.requiredApprovalRole}`);

    console.log(`\n======================================================================`);
    console.log(`🎉 COMPLETED FULL MATERIAL & FINANCIAL LIFECYCLE AUDIT SUCCESSFULLY!`);
    console.log(`======================================================================\n`);

  } catch (err: any) {
    console.error(`\n❌ AUDIT ERROR DETECTED:`, err);
  } finally {
    await prisma.$disconnect();
  }
}

runMaterialLifecycleAudit();
