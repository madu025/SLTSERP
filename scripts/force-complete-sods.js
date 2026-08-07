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
    // Direct update bypassing FSM - for test data generation only
    const result = await p.serviceOrder.updateMany({
        where: { id: { in: SOD_IDS } },
        data: {
            sltsStatus: 'COMPLETED',
            completedDate: new Date(),
        }
    });
    
    console.log(`Updated ${result.count} SODs to COMPLETED`);

    // Also mark approval instances as APPROVED to keep audit clean
    const approvalResult = await p.universalApprovalInstance.updateMany({
        where: { entityId: { in: SOD_IDS }, status: 'PENDING' },
        data: { status: 'APPROVED' }
    });
    console.log(`Updated ${approvalResult.count} approval instances to APPROVED`);

    // Verify
    const sods = await p.serviceOrder.findMany({
        where: { id: { in: SOD_IDS } },
        select: { soNum: true, sltsStatus: true, completedDate: true, revenueAmount: true, contractorAmount: true }
    });
    
    console.log('\n=== FINAL SOD STATUSES ===');
    for (const s of sods) {
        console.log(`${s.soNum} | ${s.sltsStatus} | completed: ${s.completedDate} | rev: ${s.revenueAmount} | contr: ${s.contractorAmount}`);
    }

    // Check Kaduwela store stock (should reflect GRN - MIN - SOD usage)
    const kaduwelaStore = await p.inventoryStore.findFirst({
        where: { name: { contains: 'Kaduwela', mode: 'insensitive' } }
    });
    if (kaduwelaStore) {
        const stock = await p.inventoryStock.findMany({
            where: { storeId: kaduwelaStore.id },
            include: { item: { select: { code: true, name: true, unit: true } } }
        });
        console.log('\n=== KADUWELA STORE STOCK ===');
        for (const s of stock) {
            console.log(`${s.item.name} (${s.item.code}) | qty: ${s.quantity} ${s.item.unit}`);
        }
    }

    // Check contractor stock
    const cStock = await p.contractorStock.findMany({
        where: { contractorId: '019fdcd7-4325-aa27-9bc3-429ec6d32929' },
        include: { item: { select: { code: true, name: true, unit: true } } }
    });
    
    console.log('\n=== CONTRACTOR STOCK (Sanjewa FTTH) ===');
    for (const s of cStock) {
        console.log(`${s.item.name} (${s.item.code}) | qty: ${s.quantity} ${s.item.unit}`);
    }

    await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
