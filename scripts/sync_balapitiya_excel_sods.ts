import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncBalapitiyaSODs() {
    console.log('🔄 === SYNCING REAL IMPORTED EXCEL SODs FOR Y D BALAPITIYA ===\n');

    // 1. Get Contractor Y D Balapitiya
    const contractor = await prisma.contractor.findFirst({
        where: {
            OR: [
                { name: { contains: 'Balapitiya', mode: 'insensitive' } },
                { registrationNumber: 'SLTS/OSP/2025/2026-398' }
            ]
        }
    });

    if (!contractor) {
        console.error('❌ Contractor Y D Balapitiya not found!');
        return;
    }

    console.log(`✅ Identified Target Contractor: ${contractor.name} (${contractor.registrationNumber}) [ID: ${contractor.id}]`);

    // 2. Find all SODs matching Balapitiya, R-KX, or AG/HK OPMC series
    const balapitiyaSODs = await prisma.serviceOrder.findMany({
        where: {
            OR: [
                { comments: { contains: 'Balapitiya', mode: 'insensitive' } },
                { directTeam: { contains: 'Balapitiya', mode: 'insensitive' } },
                { customerName: { contains: 'Balapitiya', mode: 'insensitive' } },
                { address: { contains: 'Balapitiya', mode: 'insensitive' } },
                { rtom: { contains: 'BALAPITIYA', mode: 'insensitive' } },
                { lea: { contains: 'BALAPITIYA', mode: 'insensitive' } },
                { dp: { contains: 'BALAPITIYA', mode: 'insensitive' } },
                { soNum: { startsWith: 'AG' } },
            ]
        }
    });

    console.log(`✅ Found ${balapitiyaSODs.length} matching real Excel imported SODs.`);

    // 3. Link SODs to Y D Balapitiya contractor
    let updatedCount = 0;
    for (const sod of balapitiyaSODs) {
        await prisma.serviceOrder.update({
            where: { id: sod.id },
            data: {
                contractorId: contractor.id,
                sltsStatus: sod.sltsStatus || 'ASSIGNED'
            }
        });
        updatedCount++;
        console.log(`   - Linked SO: ${sod.soNum} | Customer: ${sod.customerName} | Status: ${sod.sltsStatus}`);
    }

    console.log(`\n🎉 Successfully linked ${updatedCount} real Excel SODs to Contractor ${contractor.name}!`);

    // 4. Verify assigned SOD count
    const assignedSODs = await prisma.serviceOrder.findMany({
        where: { contractorId: contractor.id }
    });

    console.log(`📊 Verified Total Active Assigned SODs for ${contractor.name}: ${assignedSODs.length}\n`);
}

syncBalapitiyaSODs()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
