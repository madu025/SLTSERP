import { prisma } from './src/lib/prisma';

async function checkContractor() {
    const contractor = await prisma.contractor.findFirst({
        where: { status: 'ARM_PENDING' },
        orderBy: { updatedAt: 'desc' },
        include: { teams: true }
    });
    
    if (contractor) {
        console.log('--- ARM_PENDING Contractor Details ---');
        console.log(`ID: ${contractor.id}`);
        console.log(`Name: ${contractor.name}`);
        console.log(`Status: ${contractor.status}`);
        console.log(`Updated: ${contractor.updatedAt}`);
        console.log(`Teams Count: ${contractor?.teams?.length}`);
    } else {
        console.log('--- No ARM_PENDING contractors found ---');
        const last = await prisma.contractor.findFirst({
            orderBy: { updatedAt: 'desc' }
        });
        console.log('--- Last Modified Contractor Overall ---');
        console.log(JSON.stringify(last, null, 2));
    }
}

checkContractor()
    .catch(console.error)
    .finally(() => process.exit());
