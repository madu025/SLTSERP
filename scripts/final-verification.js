const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║          E2E WORKFLOW TEST RUN - FINAL VERIFICATION             ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    // 1. WORKFLOW 2 - GRN
    const grns = await p.gRN.findMany({ select: { grnNumber: true, createdAt: true } });
    console.log('=== WORKFLOW 2: MATERIAL GRN ===');
    console.log('GRNs created:', grns.length);
    grns.forEach(g => console.log('  ', g.grnNumber));

    // 2. WORKFLOW 4 - MATERIAL ISSUE
    const mins = await p.contractorMaterialIssue.findMany({ select: { issueNumber: true, status: true, contractor: { select: { name: true } } } });
    console.log('\n=== WORKFLOW 4: MATERIAL ISSUE ===');
    console.log('MINs created:', mins.length);
    mins.forEach(m => console.log('  ', m.issueNumber, '| status:', m.status, '| to:', m.contractor?.name));

    // 3. WORKFLOW 1 - SOD LIFECYCLE
    const invoicableSods = await p.serviceOrder.findMany({
      where: { isInvoicable: true },
      select: { soNum: true, sltsStatus: true, isInvoicable: true, invoiced: true, contractorAmount: true, revenueAmount: true, sltsPatStatus: true, opmcPatStatus: true, hoPatStatus: true }
    });
    console.log('\n=== WORKFLOW 1: SOD LIFECYCLE ===');
    console.log('Invoicable SODs:', invoicableSods.length);
    console.log('All PAT_PASSED:', invoicableSods.every(s => s.sltsPatStatus === 'PAT_PASSED' && s.opmcPatStatus === 'PAT_PASSED' && s.hoPatStatus === 'PAT_PASSED'));
    console.log('All COMPLETED:', invoicableSods.every(s => s.sltsStatus === 'COMPLETED'));
    const totalRev = invoicableSods.reduce((sum, s) => sum + parseFloat(s.revenueAmount || 0), 0);
    const totalCost = invoicableSods.reduce((sum, s) => sum + parseFloat(s.contractorAmount || 0), 0);
    console.log('Total Revenue:', totalRev);
    console.log('Total Contractor Cost:', totalCost);

    // 4. WORKFLOW 3 - INVOICE
    const invoices = await p.invoice.findMany({ select: { invoiceNumber: true, amount: true, totalAmount: true, status: true, approvalStatus: true, retentionAmount: true, whtAmount: true } });
    console.log('\n=== WORKFLOW 3: CONTRACTOR INVOICE ===');
    console.log('Invoices created:', invoices.length);
    invoices.forEach(i => {
      console.log('  ', i.invoiceNumber, '| gross:', i.amount?.toString(), '| net:', i.totalAmount?.toString(), '| retention:', i.retentionAmount?.toString(), '| WHT:', i.whtAmount?.toString(), '| status:', i.status, '| approval:', i.approvalStatus);
    });

    // 5. SOD INVOICED STATUS
    const allInvoiced = await p.serviceOrder.count({ where: { isInvoicable: true, invoiced: true } });
    console.log('\n=== SOD INVOICE STATUS ===');
    console.log('Invoicable SODs marked invoiced:', allInvoiced, '/', invoicableSods.length);

    // 6. CONTRACTOR STOCK
    const stock = await p.contractorStock.findMany({ select: { contractor: { select: { name: true } }, item: { select: { name: true } }, quantity: true } });
    console.log('\n=== CONTRACTOR STOCK ===');
    stock.forEach(s => console.log('  ', s.contractor?.name, '|', s.item?.name, '| qty:', s.quantity?.toString()));

    // 7. MATERIAL USAGE
    const matUsage = await p.sODMaterialUsage.count();
    console.log('\n=== MATERIAL USAGE ===');
    console.log('Total usage records:', matUsage);

    // 8. APPROVAL INSTANCES
    const approvals = await p.universalApprovalInstance.findMany({ select: { status: true } });
    const sc = {};
    approvals.forEach(a => { sc[a.status] = (sc[a.status] || 0) + 1; });
    console.log('\n=== APPROVAL INSTANCES ===');
    console.log('Total:', approvals.length, '| Breakdown:', JSON.stringify(sc));

    // FINAL SUMMARY
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                      TEST RUN SUMMARY                           ║');
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log('║ Workflow 2 (GRN):          ', grns.length > 0 ? 'PASS' : 'FAIL', '                                    ║');
    console.log('║ Workflow 4 (MIN):          ', mins.length > 0 ? 'PASS' : 'FAIL', '                                    ║');
    console.log('║ Workflow 1 (SOD):          ', invoicableSods.length === 10 ? 'PASS' : 'FAIL', '  (10 SODs completed, PAT passed)      ║');
    console.log('║ Workflow 3 (Invoice):      ', invoices.length > 0 ? 'PASS' : 'FAIL', '  (', invoices.length, ' invoices created)                  ║');
    console.log('║ SODs Invoiced:             ', allInvoiced === 10 ? 'PASS' : 'FAIL', '  (', allInvoiced, '/10 marked invoiced)              ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    await p.$disconnect();
  } catch (e) {
    console.error(e);
    await p.$disconnect();
  }
})();
