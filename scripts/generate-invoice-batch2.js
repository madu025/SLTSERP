const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const contractorId = '019fdcd7-4325-aa27-9bc3-429ec6d32929';
    const retentionPercent = 5;
    const whtPercent = 5;
    const advanceDeduction = 0;

    // Use a new idempotency key for this batch
    const idempotencyKey = `INV_GEN_${contractorId}_2026-08_BATCH2`;
    console.log('Idempotency key:', idempotencyKey);

    // Check if already exists
    const existing = await p.invoice.findUnique({ where: { idempotencyKey } });
    if (existing) {
      console.log('Invoice already exists:', existing.invoiceNumber);
      await p.$disconnect();
      return;
    }

    // 1. Fetch unbilled completed SODs
    const unbilledSods = await p.serviceOrder.findMany({
      where: {
        contractorId,
        sltsStatus: 'COMPLETED',
        invoiceId: null,
        invoiced: false,
      }
    });
    console.log('Unbilled SODs found:', unbilledSods.length);

    if (unbilledSods.length === 0) {
      console.log('No unbilled completed SODs found.');
      await p.$disconnect();
      return;
    }

    // 2. Aggregate amounts
    let totalContractorAmount = 0;
    for (const sod of unbilledSods) {
      totalContractorAmount += parseFloat(sod.contractorAmount || 0);
    }
    console.log('Total contractor amount:', totalContractorAmount);

    // 3. Calculate splits
    const retentionAmount = (totalContractorAmount * retentionPercent) / 100;
    const whtAmount = (totalContractorAmount * whtPercent) / 100;
    const netAmountToPay = totalContractorAmount - retentionAmount - whtAmount - advanceDeduction;

    console.log('Retention (5%):', retentionAmount);
    console.log('WHT (5%):', whtAmount);
    console.log('Net to pay:', netAmountToPay);

    // 4. Generate invoice number
    const count = await p.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    console.log('Invoice number:', invoiceNumber);

    // 5. Create invoice in transaction
    const result = await p.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          contractorId,
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          amount: totalContractorAmount,
          totalAmount: netAmountToPay,
          status: 'PENDING',
          approvalStatus: 'DRAFT',
          description: 'QA Test Invoice Batch 2 - Sanjewa FTTH Contractor (9 SODs)',
          retentionAmount,
          whtAmount,
          whtPercent,
          advanceDeduction,
          idempotencyKey,
          sods: {
            connect: unbilledSods.map(s => ({ id: s.id }))
          }
        }
      });

      // 6. Mark SODs as invoiced
      await tx.serviceOrder.updateMany({
        where: { id: { in: unbilledSods.map(s => s.id) } },
        data: { invoiced: true }
      });

      return invoice;
    });

    console.log('\n=== INVOICE CREATED ===');
    console.log('ID:', result.id);
    console.log('Number:', result.invoiceNumber);
    console.log('Status:', result.status);
    console.log('Approval:', result.approvalStatus);
    console.log('Amount:', result.amount?.toString());
    console.log('Net Amount:', result.totalAmount?.toString());
    console.log('Retention:', result.retentionAmount?.toString());
    console.log('WHT:', result.whtAmount?.toString());

    // 7. Verify SODs are now invoiced
    const verifySods = await p.serviceOrder.findMany({
      where: { id: { in: unbilledSods.map(s => s.id) } },
      select: { soNum: true, invoiced: true, invoiceId: true }
    });
    console.log('\n=== SOD INVOICE STATUS ===');
    verifySods.forEach(s => console.log(s.soNum, '| invoiced:', s.invoiced, '| invoiceId:', s.invoiceId?.slice(0, 8)));

    // 8. Final summary
    const allInvoices = await p.invoice.findMany({ select: { invoiceNumber: true, amount: true, totalAmount: true, status: true, approvalStatus: true } });
    console.log('\n=== ALL INVOICES ===');
    allInvoices.forEach(i => console.log(i.invoiceNumber, '| amount:', i.amount?.toString(), '| net:', i.totalAmount?.toString(), '| status:', i.status, '| approval:', i.approvalStatus));

    await p.$disconnect();
  } catch (e) {
    console.error('ERROR:', e.message || e);
    await p.$disconnect();
  }
})();
