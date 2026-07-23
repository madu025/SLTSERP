import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres.cxhjerzucacqsxoumhio:Osp%23slts%40Osp@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

async function createRealTestInvoice() {
  console.log(`\n======================================================================`);
  console.log(`🚀 CREATING REAL CONTRACTOR INVOICE WITH FULL DATA & BALANCE SHEET`);
  console.log(`======================================================================\n`);

  try {
    // 1. Find or create real contractor profile
    let contractor = await prisma.contractor.findFirst({
      where: { name: { contains: 'Network Communications' } }
    });

    if (!contractor) {
      contractor = await prisma.contractor.create({
        data: {
          name: 'Network Communications & Engineering (Pvt) Ltd',
          registrationNumber: 'SLTS/OSP/2025/2026/000',
          address: 'No. 45/A, Kandy Road, Gampaha',
          contactNumber: '0771234567',
          bankName: 'Commercial Bank PLC',
          bankBranch: 'Gampaha Branch (Code 012)',
          bankAccountNumber: '800123456789',
          status: 'ACTIVE'
        }
      });
    } else {
      // Ensure complete bank & address info is populated
      contractor = await prisma.contractor.update({
        where: { id: contractor.id },
        data: {
          registrationNumber: 'SLTS/OSP/2025/2026/000',
          address: 'No. 45/A, Kandy Road, Gampaha',
          contactNumber: '0771234567',
          bankName: 'Commercial Bank PLC',
          bankBranch: 'Gampaha Branch (Code 012)',
          bankAccountNumber: '800123456789'
        }
      });
    }

    console.log(`📌 Contractor Profile: ${contractor.name} (${contractor.registrationNumber})`);

    // 2. Create Real Inventory Items if not present
    const dropWireItem = await prisma.inventoryItem.upsert({
      where: { code: 'FB-DROP-WIRE-1C' },
      update: {},
      create: { code: 'FB-DROP-WIRE-1C', name: '1-Core FTTH Drop Wire Cable', unit: 'Meters', category: 'CABLE' }
    });

    const ontItem = await prisma.inventoryItem.upsert({
      where: { code: 'CPE-ONT-FTTH' },
      update: {},
      create: { code: 'CPE-ONT-FTTH', name: 'FTTH ONU/ONT Terminal Unit', unit: 'Nos', category: 'CPE' }
    });

    const clampItem = await prisma.inventoryItem.upsert({
      where: { code: 'ACC-POLE-CLAMP-56' },
      update: {},
      create: { code: 'ACC-POLE-CLAMP-56', name: '5.6m Pole Tension Clamp', unit: 'Nos', category: 'ACCESSORY' }
    });

    // Seed Contractor Stock for Material Balance Sheet
    await prisma.contractorStock.upsert({
      where: { contractorId_itemId: { contractorId: contractor.id, itemId: dropWireItem.id } },
      update: { quantity: 450 },
      create: { contractorId: contractor.id, itemId: dropWireItem.id, quantity: 450 }
    });

    await prisma.contractorStock.upsert({
      where: { contractorId_itemId: { contractorId: contractor.id, itemId: ontItem.id } },
      update: { quantity: 25 },
      create: { contractorId: contractor.id, itemId: ontItem.id, quantity: 25 }
    });

    await prisma.contractorStock.upsert({
      where: { contractorId_itemId: { contractorId: contractor.id, itemId: clampItem.id } },
      update: { quantity: 57 },
      create: { contractorId: contractor.id, itemId: clampItem.id, quantity: 57 }
    });

    // 3. Resolve OPMC & Create Real SODs
    let opmc = await prisma.oPMC.findFirst({ where: { rtom: 'GP' } }) || await prisma.oPMC.findFirst();
    if (!opmc) {
      opmc = await prisma.oPMC.create({
        data: { name: 'Gampaha OPMC', rtom: 'GP', region: 'OTHER' }
      });
    }

    const sod1 = await prisma.serviceOrder.upsert({
      where: { soNum: 'GP202607140013' },
      update: { contractorId: contractor.id, status: 'COMPLETED', sltsStatus: 'COMPLETED', rtom: 'R-GP', serviceType: 'FTTH', opmcId: opmc.id },
      create: {
        soNum: 'GP202607140013',
        rtom: 'R-GP',
        serviceType: 'FTTH',
        customerName: 'S. K. Perera',
        status: 'COMPLETED',
        sltsStatus: 'COMPLETED',
        contractorId: contractor.id,
        completedDate: new Date(),
        opmcId: opmc.id
      }
    });

    const sod2 = await prisma.serviceOrder.upsert({
      where: { soNum: 'GP202607140014' },
      update: { contractorId: contractor.id, status: 'COMPLETED', sltsStatus: 'COMPLETED', rtom: 'R-GP', serviceType: 'FTTH', opmcId: opmc.id },
      create: {
        soNum: 'GP202607140014',
        rtom: 'R-GP',
        serviceType: 'FTTH',
        customerName: 'M. T. Fernando',
        status: 'COMPLETED',
        sltsStatus: 'COMPLETED',
        contractorId: contractor.id,
        completedDate: new Date(),
        opmcId: opmc.id
      }
    });

    // Add Material Usage Records to SODs
    await prisma.sODMaterialUsage.deleteMany({ where: { serviceOrderId: { in: [sod1.id, sod2.id] } } });
    
    await prisma.sODMaterialUsage.createMany({
      data: [
        { serviceOrderId: sod1.id, itemId: dropWireItem.id, quantity: 250, unit: 'Meters', usageType: 'USED' },
        { serviceOrderId: sod1.id, itemId: ontItem.id, quantity: 1, unit: 'Nos', usageType: 'USED' },
        { serviceOrderId: sod1.id, itemId: clampItem.id, quantity: 3, unit: 'Nos', usageType: 'USED' },
        { serviceOrderId: sod2.id, itemId: dropWireItem.id, quantity: 750, unit: 'Meters', usageType: 'USED' },
        { serviceOrderId: sod2.id, itemId: dropWireItem.id, quantity: 50, unit: 'Meters', usageType: 'WASTAGE' },
        { serviceOrderId: sod2.id, itemId: ontItem.id, quantity: 3, unit: 'Nos', usageType: 'USED' },
        { serviceOrderId: sod2.id, itemId: clampItem.id, quantity: 9, unit: 'Nos', usageType: 'USED' }
      ]
    });

    // 4. Create Real Invoice Matching User's Image Example (IS/CENTRAL/GP/NC/26/DEC/1)
    const invNumber = 'IS/CENTRAL/GP/NC/26/DEC/1';
    
    // Delete previous test instance if exists
    await prisma.invoice.deleteMany({ where: { invoiceNumber: invNumber } });

    const totalAmount = 31200.00;
    const amountA = 28080.00; // 90%
    const amountB = 3120.00;  // 10%

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: invNumber,
        contractorId: contractor.id,
        amount: totalAmount,
        totalAmount,
        amountA,
        amountB,
        status: 'SF_AUDIT_APPROVED',
        statusA: 'SF_AUDIT_APPROVED',
        statusB: 'HOLD',
        date: new Date(),
        rtomArea: 'GP',
        description: 'Contractor Monthly Invoice for GP Region',
        sods: { connect: [{ id: sod1.id }, { id: sod2.id }] }
      }
    });

    console.log(`\n======================================================================`);
    console.log(`🎉 REAL DATA TEST INVOICE CREATED SUCCESSFULLY!`);
    console.log(`======================================================================`);
    console.log(`   Invoice Number : ${invoice.invoiceNumber}`);
    console.log(`   Contractor     : ${contractor.name}`);
    console.log(`   Grand Total    : LKR ${invoice.totalAmount.toLocaleString()} (90%: LKR ${invoice.amountA.toLocaleString()})`);
    console.log(`   Invoice ID     : ${invoice.id}`);
    console.log(`\n🔗 PUBLIC WHATSAPP / PRINTABLE INVOICE LINK:`);
    console.log(`   http://localhost:3000/public/invoices/${invoice.id}\n`);

  } catch (err: any) {
    console.error(`❌ ERROR CREATING REAL TEST INVOICE:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

createRealTestInvoice();
