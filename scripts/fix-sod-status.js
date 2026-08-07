const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    // Fix 9 SODs: set sltsStatus to COMPLETED
    const targetSods = [
      'KDL202503010049975', 'KDL202608050070907', 'HC202608060086476',
      'KX202608040055106', 'KDL202608070013899', 'KDL202608070014181',
      'KDL202608060085990', 'KDL202608070014315', 'KDL202608070014975'
    ];

    const result = await p.serviceOrder.updateMany({
      where: { soNum: { in: targetSods } },
      data: {
        sltsStatus: 'COMPLETED',
        completedDate: new Date(),
      }
    });

    console.log('Updated', result.count, 'SODs to COMPLETED');

    // Verify
    const verify = await p.serviceOrder.findMany({
      where: { soNum: { in: targetSods } },
      select: { soNum: true, sltsStatus: true, isInvoicable: true, invoiced: true, sltsPatStatus: true, opmcPatStatus: true, hoPatStatus: true }
    });
    console.log('\n=== VERIFICATION ===');
    verify.forEach(s => console.log(s.soNum, '| status:', s.sltsStatus, '| inv_flag:', s.isInvoicable, '| invoiced:', s.invoiced, '| PAT:', s.sltsPatStatus, s.opmcPatStatus, s.hoPatStatus));

    // Now count how many are COMPLETED + not invoiced
    const completedUnbilled = await p.serviceOrder.count({
      where: {
        contractorId: '019fdcd7-4325-aa27-9bc3-429ec6d32929',
        sltsStatus: 'COMPLETED',
        invoiceId: null,
        invoiced: false,
      }
    });
    console.log('\nCompleted + unbilled SODs for Sanjewa:', completedUnbilled);

    await p.$disconnect();
  } catch (e) {
    console.error(e);
    await p.$disconnect();
  }
})();
