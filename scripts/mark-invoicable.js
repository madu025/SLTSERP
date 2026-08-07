const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const SOD_IDS = [
    '019fdbd5-8802-ee1c-d314-7b9f9c7cc64d',
    '019fdbd5-8802-a2dd-5a1d-ac211e82fccf',
    '019fc81c-4365-b237-4f8c-6adb37bac269',
    '019fd633-7f3f-e626-b185-060b2906e204',
    '019fd6e6-1520-0efb-ad5e-a2adee0cd60e',
    '019fd685-ef10-5276-1712-69711ff837ed',
    '019fdbd5-8802-0a52-683f-040e6e7a5472',
    '019fdbd5-8802-520a-e4a5-5fd06e6c60a3',
    '019fc81c-4361-1a09-e165-45865876483e',
    '019fcb33-5ec8-c24e-68a2-61d5823cc888',
];

async function main() {
    // Mark all 10 SODs as invoicable with all PAT passed
    const result = await p.serviceOrder.updateMany({
        where: { id: { in: SOD_IDS } },
        data: {
            isInvoicable: true,
            sltsPatStatus: 'PAT_PASSED',
            opmcPatStatus: 'PAT_PASSED',
            hoPatStatus: 'PAT_PASSED',
            sltsPatDate: new Date(),
            opmcPatDate: new Date(),
            hoPatDate: new Date(),
        }
    });
    console.log(`Marked ${result.count} SODs as invoicable (all 3 PAT stages PASSED)`);

    // Verify
    const sods = await p.serviceOrder.findMany({
        where: { id: { in: SOD_IDS } },
        select: { 
            soNum: true, sltsStatus: true, isInvoicable: true, invoiced: true,
            sltsPatStatus: true, opmcPatStatus: true, hoPatStatus: true,
            revenueAmount: true, contractorAmount: true, completedDate: true
        }
    });
    
    console.log('\n=== SOD FINAL STATE ===');
    for (const s of sods) {
        console.log(`${s.soNum} | ${s.sltsStatus} | PAT: ${s.sltsPatStatus}/${s.opmcPatStatus}/${s.hoPatStatus} | invoicable: ${s.isInvoicable} | invoiced: ${s.invoiced} | rev: ${s.revenueAmount} | contr: ${s.contractorAmount}`);
    }

    // Summary
    const totalRevenue = sods.reduce((sum, s) => sum + (Number(s.revenueAmount) || 0), 0);
    const totalContractor = sods.reduce((sum, s) => sum + (Number(s.contractorAmount) || 0), 0);
    console.log(`\nTotal Revenue: ${totalRevenue} | Total Contractor Cost: ${totalContractor}`);

    await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
