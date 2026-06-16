import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const opmcData = [
    { region: 'METRO', province: 'METRO 01', rtom: 'R-HK', name: '' },
    { region: 'METRO', province: 'METRO 01', rtom: 'R-KX', name: '' },
    { region: 'METRO', province: 'METRO 01', rtom: 'R-MD', name: '' },
    { region: 'METRO', province: 'METRO 02', rtom: 'R-HO', name: '' },
    { region: 'METRO', province: 'METRO 02', rtom: 'R-ND', name: '' },
    { region: 'METRO', province: 'METRO 02', rtom: 'R-RM', name: '' },
    { region: 'REGION 01', province: 'CP', rtom: 'R-GP', name: '' },
    { region: 'REGION 01', province: 'CP', rtom: 'R-HT', name: '' },
    { region: 'REGION 01', province: 'CP', rtom: 'R-KY', name: '' },
    { region: 'REGION 01', province: 'CP', rtom: 'R-MT', name: '' },
    { region: 'REGION 01', province: 'CP', rtom: 'R-NW', name: '' },
    { region: 'REGION 01', province: 'NWP', rtom: 'R-CW', name: '' },
    { region: 'REGION 01', province: 'NWP', rtom: 'R-KG', name: '' },
    { region: 'REGION 01', province: 'NWP', rtom: 'R-KLY', name: '' },
    { region: 'REGION 01', province: 'WPN', rtom: 'R-GQ', name: '' },
    { region: 'REGION 01', province: 'WPN', rtom: 'R-KI', name: '' },
    { region: 'REGION 01', province: 'WPN', rtom: 'R-NG', name: '' },
    { region: 'REGION 01', province: 'WPN', rtom: 'R-NTB', name: '' },
    { region: 'REGION 01', province: 'WPN', rtom: 'R-WT', name: '' },
    { region: 'REGION 02', province: 'UVA', rtom: 'R-BD', name: '' },
    { region: 'REGION 02', province: 'UVA', rtom: 'R-BW', name: '' },
    { region: 'REGION 02', province: 'UVA', rtom: 'R-KE', name: '' },
    { region: 'REGION 02', province: 'SAB', rtom: 'R-MRG', name: '' },
    { region: 'REGION 02', province: 'SAB', rtom: 'R-RN', name: '' },
    { region: 'REGION 02', province: 'SP', rtom: 'R-GL', name: '' },
    { region: 'REGION 02', province: 'SP', rtom: 'R-HB', name: '' },
    { region: 'REGION 02', province: 'SP', rtom: 'R-EMB', name: '' },
    { region: 'REGION 02', province: 'SP', rtom: 'R-MH', name: '' },
    { region: 'REGION 02', province: 'WPS', rtom: 'R-AG', name: '' },
    { region: 'REGION 02', province: 'WPS', rtom: 'R-HR', name: '' },
    { region: 'REGION 02', province: 'WPS', rtom: 'R-KT', name: '' },
    { region: 'REGION 02', province: 'WPS', rtom: 'R-PH', name: '' },
    { region: 'REGION 03', province: 'EP', rtom: 'R-AP', name: '' },
    { region: 'REGION 03', province: 'EP', rtom: 'R-BC', name: '' },
    { region: 'REGION 03', province: 'EP', rtom: 'R-KL', name: '' },
    { region: 'REGION 03', province: 'EP', rtom: 'R-PR', name: '' },
    { region: 'REGION 03', province: 'EP', rtom: 'R-TC', name: '' },
    { region: 'REGION 03', province: 'NP', rtom: 'R-AD', name: '' },
    { region: 'REGION 03', province: 'NP', rtom: 'R-JA', name: '' },
    { region: 'REGION 03', province: 'NP', rtom: 'R-KO', name: '' },
    { region: 'REGION 03', province: 'NP', rtom: 'R-MB', name: '' },
    { region: 'REGION 03', province: 'NP', rtom: 'R-VA', name: '' },
    { region: 'REGION 03', province: 'NP', rtom: 'R-MLT', name: '' },
];

async function main() {
    console.log('Clearing OPMC table...');
    await prisma.oPMC.deleteMany({});
    console.log('✅ Table cleared\n');

    console.log('Seeding OPMC data...');
    let created = 0;

    for (const opmc of opmcData) {
        try {
            await prisma.oPMC.create({ data: opmc });
            console.log(`✅ Created ${opmc.rtom}`);
            created++;
        } catch (error) {
            console.error(`❌ Error creating ${opmc.rtom}:`, error);
        }
    }

    console.log(`\n📊 Summary: Created ${created}/${opmcData.length} OPMCs`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
