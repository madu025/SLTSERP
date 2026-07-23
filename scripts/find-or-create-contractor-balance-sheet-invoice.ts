import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres.cxhjerzucacqsxoumhio:Osp%23slts%40Osp@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

async function main() {
  console.log(`\n======================================================================`);
  console.log(`🔍 SEARCHING FOR PREVIOUSLY TESTED CONTRACTOR & GENERATING LINKED INVOICE`);
  console.log(`======================================================================\n`);

  try {
    // 1. Search for existing contractors in database
    const contractors = await prisma.contractor.findMany({
      take: 10,
      include: {
        stock: { include: { item: true } },
        invoices: { take: 1, orderBy: { createdAt: 'desc' } }
      }
    });

    console.log(`📌 Found ${contractors.length} Contractors in Database.`);

    let targetContractor = contractors.find(c => c.stock.length > 0) || contractors[0];

    if (!targetContractor) {
      targetContractor = await prisma.contractor.create({
        data: {
          name: 'OSP Engineering & Telecom Solutions (Pvt) Ltd',
          registrationNumber: 'SLTS/OSP/2024/2025/108',
          address: 'No. 128, Kandy Road, Kiribathgoda',
          contactNumber: '0112912345',
          bankName: 'Hatton National Bank PLC',
          bankBranch: 'Kiribathgoda Branch (Code 034)',
          bankAccountNumber: '0340108998877',
          status: 'ACTIVE'
        },
        include: { stock: { include: { item: true } }, invoices: true }
      });
    } else {
      // Ensure contractor details are completely filled
      targetContractor = await prisma.contractor.update({
        where: { id: targetContractor.id },
        data: {
          registrationNumber: targetContractor.registrationNumber || 'SLTS/OSP/2024/2025/108',
          address: targetContractor.address || 'No. 128, Kandy Road, Kiribathgoda',
          contactNumber: targetContractor.contactNumber || '0112912345',
          bankName: targetContractor.bankName || 'Hatton National Bank PLC',
          bankBranch: targetContractor.bankBranch || 'Kiribathgoda Branch (Code 034)',
          bankAccountNumber: targetContractor.bankAccountNumber || '0340108998877'
        },
        include: { stock: { include: { item: true } }, invoices: true }
      });
    }

    console.log(`\n🎯 TARGET CONTRACTOR SELECTED:`);
    console.log(`   Name        : ${targetContractor.name}`);
    console.log(`   Reg Number  : ${targetContractor.registrationNumber}`);
    console.log(`   Bank Account: ${targetContractor.bankName} - ${targetContractor.bankAccountNumber}`);

    // 2. Ensure Inventory Items & Stock exist for this contractor
    const dropWire = await prisma.inventoryItem.upsert({
      where: { code: 'FB-DROP-WIRE-1C' },
      update: {},
      create: { code: 'FB-DROP-WIRE-1C', name: '1-Core FTTH Drop Wire Cable', unit: 'Meters', category: 'CABLE' }
    });

    const ontUnit = await prisma.inventoryItem.upsert({
      where: { code: 'CPE-ONT-FTTH' },
      update: {},
      create: { code: 'CPE-ONT-FTTH', name: 'FTTH ONU/ONT Terminal Unit', unit: 'Nos', category: 'CPE' }
    });

    const poleClamp = await prisma.inventoryItem.upsert({
      where: { code: 'ACC-POLE-CLAMP-56' },
      update: {},
      create: { code: 'ACC-POLE-CLAMP-56', name: '5.6m Pole Tension Clamp', unit: 'Nos', category: 'ACCESSORY' }
    });

    // Populate Stock for Material Balance Sheet
    await prisma.contractorStock.upsert({
      where: { contractorId_itemId: { contractorId: targetContractor.id, itemId: dropWire.id } },
      update: { quantity: 1250 },
      create: { contractorId: targetContractor.id, itemId: dropWire.id, quantity: 1250 }
    });

    await prisma.contractorStock.upsert({
      where: { contractorId_itemId: { contractorId: targetContractor.id, itemId: ontUnit.id } },
      update: { quantity: 42 },
      create: { contractorId: targetContractor.id, itemId: ontUnit.id, quantity: 42 }
    });

    await prisma.contractorStock.upsert({
      where: { contractorId_itemId: { contractorId: targetContractor.id, itemId: poleClamp.id } },
      update: { quantity: 110 },
      create: { contractorId: targetContractor.id, itemId: poleClamp.id, quantity: 110 }
    });

    // 3. Resolve OPMC & Create Completed Service Orders for this Contractor
    let opmc = await prisma.oPMC.findFirst({ where: { rtom: 'R-GP' } }) || await prisma.oPMC.findFirst();
    if (!opmc) {
      opmc = await prisma.oPMC.create({ data: { name: 'Gampaha OPMC', rtom: 'R-GP', region: 'OTHER' } });
    }

    const sod1 = await prisma.serviceOrder.upsert({
      where: { soNum: 'GP202607220091' },
      update: { contractorId: targetContractor.id, status: 'COMPLETED', sltsStatus: 'COMPLETED', rtom: 'R-GP', serviceType: 'FTTH', voiceNumber: '0332212345', opmcId: opmc.id },
      create: {
        soNum: 'GP202607220091',
        voiceNumber: '0332212345',
        rtom: 'R-GP',
        serviceType: 'FTTH',
        customerName: 'A. B. Silva',
        status: 'COMPLETED',
        sltsStatus: 'COMPLETED',
        contractorId: targetContractor.id,
        completedDate: new Date(),
        opmcId: opmc.id
      }
    });

    const sod2 = await prisma.serviceOrder.upsert({
      where: { soNum: 'GP202607220092' },
      update: { contractorId: targetContractor.id, status: 'COMPLETED', sltsStatus: 'COMPLETED', rtom: 'R-GP', serviceType: 'FTTH', voiceNumber: '0332287654', opmcId: opmc.id },
      create: {
        soNum: 'GP202607220092',
        voiceNumber: '0332287654',
        rtom: 'R-GP',
        serviceType: 'FTTH',
        customerName: 'K. L. Jayasinghe',
        status: 'COMPLETED',
        sltsStatus: 'COMPLETED',
        contractorId: targetContractor.id,
        completedDate: new Date(),
        opmcId: opmc.id
      }
    });

    // Add Material Usage Records
    await prisma.sODMaterialUsage.deleteMany({ where: { serviceOrderId: { in: [sod1.id, sod2.id] } } });
    
    await prisma.sODMaterialUsage.createMany({
      data: [
        { serviceOrderId: sod1.id, itemId: dropWire.id, quantity: 200, unit: 'Meters', usageType: 'USED' },
        { serviceOrderId: sod1.id, itemId: ontUnit.id, quantity: 1, unit: 'Nos', usageType: 'USED' },
        { serviceOrderId: sod1.id, itemId: poleClamp.id, quantity: 4, unit: 'Nos', usageType: 'USED' },
        { serviceOrderId: sod2.id, itemId: dropWire.id, quantity: 600, unit: 'Meters', usageType: 'USED' },
        { serviceOrderId: sod2.id, itemId: dropWire.id, quantity: 25, unit: 'Meters', usageType: 'WASTAGE' },
        { serviceOrderId: sod2.id, itemId: ontUnit.id, quantity: 2, unit: 'Nos', usageType: 'USED' },
        { serviceOrderId: sod2.id, itemId: poleClamp.id, quantity: 6, unit: 'Nos', usageType: 'USED' }
      ]
    });

    // 4. Create Linked Official Invoice
    const invoiceNumber = `INV/${targetContractor.name.substring(0, 3).toUpperCase()}/R-GP/26/DEC-008`;
    
    await prisma.invoice.deleteMany({ where: { invoiceNumber } });

    const totalAmount = 45000.00;
    const amountA = 40500.00; // 90%
    const amountB = 4500.00;   // 10%

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        contractorId: targetContractor.id,
        amount: totalAmount,
        totalAmount,
        amountA,
        amountB,
        status: 'SF_AUDIT_APPROVED',
        statusA: 'SF_AUDIT_APPROVED',
        statusB: 'HOLD',
        date: new Date(),
        rtomArea: 'R-GP',
        description: `Monthly Invoice for ${targetContractor.name} - R-GP Region`,
        sods: { connect: [{ id: sod1.id }, { id: sod2.id }] }
      }
    });

    console.log(`\n======================================================================`);
    console.log(`🎉 CONTRACTOR LINKED INVOICE CREATED SUCCESSFULLY!`);
    console.log(`======================================================================`);
    console.log(`   Contractor Name : ${targetContractor.name}`);
    console.log(`   Invoice Number  : ${invoice.invoiceNumber}`);
    console.log(`   Grand Total     : LKR ${invoice.totalAmount.toLocaleString()} (90%: LKR ${invoice.amountA.toLocaleString()})`);
    console.log(`\n🔗 LIVE LINKED INVOICE & BALANCE SHEET URL:`);
    console.log(`   http://localhost:3000/public/invoices/${invoice.id}\n`);

  } catch (err: any) {
    console.error(`❌ ERROR:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
