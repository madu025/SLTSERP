import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectOpmcRegions() {
    console.log('🔍 === INSPECTING ALL OPMC RECORDS & THEIR REGIONS / PROVINCES ===\n');

    const opmcs = await prisma.oPMC.findMany({
        select: {
            id: true,
            name: true,
            rtom: true,
            region: true,
            province: true,
        },
        orderBy: { rtom: 'asc' }
    });

    console.log(`Total OPMCs in database: ${opmcs.length}\n`);
    opmcs.forEach(o => {
        console.log(`• RTOM Code: "${o.rtom}" | Name: "${o.name}" | Region: "${o.region}" | Province: "${o.province}"`);
    });
}

inspectOpmcRegions()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
