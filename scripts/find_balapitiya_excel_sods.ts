import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findBalapitiyaExcelData() {
    console.log('🔍 === SEARCHING FOR Y D BALAPITIYA EXCEL SYNCED SODs & CONTRACTOR DATA ===\n');

    // 1. Search Contractors matching Balapitiya or 398
    const contractors = await prisma.contractor.findMany({
        where: {
            OR: [
                { name: { contains: 'Balapitiya', mode: 'insensitive' } },
                { registrationNumber: { contains: '398', mode: 'insensitive' } },
                { contactNumber: { contains: '781148142' } }
            ]
        },
        include: { serviceOrders: true }
    });

    console.log(`Found ${contractors.length} Contractor records matching Balapitiya / 398 / 781148142:`);
    for (const c of contractors) {
        console.log(`   - ID: ${c.id} | Name: ${c.name} | Reg: ${c.registrationNumber} | Phone: ${c.contactNumber} | Linked SODs: ${c.serviceOrders.length}`);
    }
    console.log('\n');

    // 2. Search SODs matching Balapitiya, R-KX, contractor, comments, or directTeam
    const sods = await prisma.serviceOrder.findMany({
        where: {
            OR: [
                { comments: { contains: 'Balapitiya', mode: 'insensitive' } },
                { comments: { contains: '398', mode: 'insensitive' } },
                { directTeam: { contains: 'Balapitiya', mode: 'insensitive' } },
                { customerName: { contains: 'Balapitiya', mode: 'insensitive' } },
                { address: { contains: 'Balapitiya', mode: 'insensitive' } },
            ]
        },
        take: 50
    });

    console.log(`Found ${sods.length} ServiceOrder records containing Balapitiya / 398:`);
    for (const s of sods) {
        console.log(`   - SO: ${s.soNum} | Customer: ${s.customerName} | Status: ${s.sltsStatus} | ContractorId: ${s.contractorId} | DirectTeam: ${s.directTeam}`);
    }
    console.log('\n');

    // 3. Search SODs where contractorId is null or SODs from R-KX OPMC
    const unassignedRKXSODs = await prisma.serviceOrder.findMany({
        where: {
            contractorId: null
        },
        take: 20
    });

    console.log(`Found ${unassignedRKXSODs.length} Unassigned SODs in Database:`);
    for (const s of unassignedRKXSODs.slice(0, 10)) {
        console.log(`   - SO: ${s.soNum} | Customer: ${s.customerName} | ServiceType: ${s.serviceType}`);
    }
}

findBalapitiyaExcelData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
