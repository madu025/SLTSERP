import { prisma } from '../src/lib/prisma';

async function check() {
    const id = 'cmkba7a9p0001jt04l6spy9b9';
    console.log(`Checking for contractor with ID: ${id}`);

    const contractor = await prisma.contractor.findUnique({
        where: { id }
    });

    if (contractor) {
        console.log('FOUND:', JSON.stringify(contractor, null, 2));
    } else {
        console.log('NOT FOUND in database.');

        // List some contractors to see what we have
        const some = await prisma.contractor.findMany({
            take: 10,
            select: { id: true, name: true }
        });
        console.log('Sample IDs in DB:', some);
    }
}

check().catch(console.error);
