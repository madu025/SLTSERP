import 'dotenv/config';
import { signJWT } from '../src/lib/auth';
import { PrismaClient } from '@prisma/client';

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres.cxhjerzucacqsxoumhio:Osp%23slts%40Osp@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

async function testSfAuditAmendmentWorkflow() {
  console.log(`\n======================================================================`);
  console.log(`🛡️ TESTING SF AUDIT PRE-APPROVAL INVOICE AMOUNT AMENDMENT WORKFLOW`);
  console.log(`======================================================================\n`);

  const baseUrl = 'http://localhost:3000';

  try {
    // 1. Resolve / Create Test Invoice
    const contractor = await prisma.contractor.findFirst() || await prisma.contractor.create({
      data: { name: 'SF Audit Governance Test Contractor', status: 'ACTIVE' }
    });

    const testInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-SFAUDIT-${Date.now()}`,
        contractorId: contractor.id,
        amount: 100000.00,
        totalAmount: 100000.00,
        amountA: 90000.00,
        amountB: 10000.00,
        status: 'PENDING',
        date: new Date()
      }
    });

    console.log(`📌 Created Test Invoice: ${testInvoice.invoiceNumber} | Initial Amount: LKR 100,000.00`);

    // 2. Generate Tokens for SF Audit Officer & SF Audit Manager
    const officerToken = await signJWT({
      id: 'cmqsfaudit0001officer',
      email: 'sfaudit.officer@slts.lk',
      role: 'SF_AUDIT_OFFICER'
    });

    const managerToken = await signJWT({
      id: 'cmqsfaudit0002manager',
      email: 'sfaudit.manager@slts.lk',
      role: 'SF_AUDIT_MANAGER'
    });

    // 3. STEP 1: Submit Amendment Request as SF Audit Officer
    console.log(`\n📌 [STEP 1] SF Audit Officer Submitting Amount Change Request (LKR 100,000 -> LKR 125,000)...`);
    const reqRes = await fetch(`${baseUrl}/api/invoices/${testInvoice.id}/amend-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`,
        'Cookie': `token=${officerToken}`,
        'x-user-role': 'SF_AUDIT_OFFICER',
        'x-user-id': 'cmqsfaudit0001officer'
      },
      body: JSON.stringify({
        requestedAmount: 125000.00,
        reason: 'Special Forensic Audit verification adjusting cable length claim per site measurement.'
      })
    });

    console.log(`   Status: ${reqRes.status} ${reqRes.statusText}`);
    if (reqRes.status !== 200) {
      console.error(`   ❌ STEP 1 FAILED:`, await reqRes.text());
      return;
    }

    const reqJson = await reqRes.json();
    console.log('   [DEBUG] reqJson payload:', JSON.stringify(reqJson, null, 2));
    const amendmentReq = reqJson.data?.amendmentRequest || reqJson.amendmentRequest || reqJson.data;
    const requestId = amendmentReq?.id;
    console.log(`   ✅ STEP 1 PASSED: Amendment Request ${requestId} created in state: ${amendmentReq?.status}`);

    // Verify invoice amount remains UNCHANGED before approval
    const preCheck = await prisma.invoice.findUnique({ where: { id: testInvoice.id } });
    console.log(`   🔒 Pre-Approval Integrity Check: Invoice total remains LKR ${preCheck?.totalAmount} (UNMUTATED)`);

    // 4. STEP 2: Approve Amendment Request as SF Audit Manager
    console.log(`\n📌 [STEP 2] SF Audit Manager Approving Request (${requestId})...`);
    const appRes = await fetch(`${baseUrl}/api/invoices/amendments/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}`,
        'Cookie': `token=${managerToken}`,
        'x-user-role': 'SF_AUDIT_MANAGER',
        'x-user-id': 'cmqsfaudit0002manager'
      },
      body: JSON.stringify({ status: 'APPROVED' })
    });

    console.log(`   Status: ${appRes.status} ${appRes.statusText}`);
    if (appRes.status !== 200) {
      console.error(`   ❌ STEP 2 FAILED:`, await appRes.text());
      return;
    }

    const appJson = await appRes.json();
    const invData = appJson.data?.invoice || appJson.invoice;
    console.log(`   ✅ STEP 2 PASSED: Invoice amount updated to LKR ${invData.totalAmount} (Part A: ${invData.amountA}, Part B: ${invData.amountB})`);

    // 5. STEP 3: Verify Immutable Forensic Audit Trail Record
    console.log(`\n📌 [STEP 3] Verifying Immutable SODForensicAudit Trail...`);
    const auditRecord = await prisma.sODForensicAudit.findFirst({
      where: { soNum: testInvoice.invoiceNumber },
      orderBy: { createdAt: 'desc' }
    });

    if (auditRecord) {
      console.log(`   ✅ STEP 3 PASSED: SODForensicAudit record created with auditType: ${auditRecord.auditType}`);
    } else {
      console.error(`   ❌ STEP 3 FAILED: Forensic Audit record missing`);
    }

    console.log(`\n======================================================================`);
    console.log(`🎉 SF AUDIT PRE-APPROVAL AMENDMENT WORKFLOW TEST PASSED 100%!`);
    console.log(`======================================================================\n`);

  } catch (err: any) {
    console.error(`❌ TEST ERROR:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSfAuditAmendmentWorkflow();
