import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking OPMC data in database...\n');

    const opmcs = await prisma.oPMC.findMany({
        orderBy: [
            { region: 'asc' },
            { province: 'asc' },
            { rtom: 'asc' }
        ]
    });

    console.log(`Total OPMCs in database: ${opmcs.length}\n`);

    if (opmcs.length > 0) {
        console.log('Sample data:');
        console.log('Region\t\tProvince\tRTOM\t\tName');
        console.log('─'.repeat(60));

        opmcs.slice(0, 10).forEach(opmc => {
            console.log(`${opmc.region}\t${opmc.province}\t\t${opmc.rtom}\t\t${opmc.name || '(empty)'}`);
        });

        if (opmcs.length > 10) {
            console.log(`... and ${opmcs.length - 10} more`);
        }
    } else {
        console.log('⚠️  No OPMCs found in database!');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
