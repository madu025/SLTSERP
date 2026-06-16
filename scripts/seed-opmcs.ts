import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const opmcData = [
    // METRO - METRO 01
    { region: 'METRO', province: 'METRO 01', code: 'R-HK', name: 'R-HK OPMC', area: '' },
    { region: 'METRO', province: 'METRO 01', code: 'R-KX', name: 'R-KX OPMC', area: '' },
    { region: 'METRO', province: 'METRO 01', code: 'R-MD', name: 'R-MD OPMC', area: '' },

    // METRO - METRO 02
    { region: 'METRO', province: 'METRO 02', code: 'R-HO', name: 'R-HO OPMC', area: '' },
    { region: 'METRO', province: 'METRO 02', code: 'R-ND', name: 'R-ND OPMC', area: '' },
    { region: 'METRO', province: 'METRO 02', code: 'R-RM', name: 'R-RM OPMC', area: '' },

    // REGION 01 - CP
    { region: 'REGION 01', province: 'CP', code: 'R-GP', name: 'R-GP OPMC', area: '' },
    { region: 'REGION 01', province: 'CP', code: 'R-HT', name: 'R-HT OPMC', area: '' },
    { region: 'REGION 01', province: 'CP', code: 'R-KY', name: 'R-KY OPMC', area: '' },
    { region: 'REGION 01', province: 'CP', code: 'R-MT', name: 'R-MT OPMC', area: '' },
    { region: 'REGION 01', province: 'CP', code: 'R-NW', name: 'R-NW OPMC', area: '' },

    // REGION 01 - NWP
    { region: 'REGION 01', province: 'NWP', code: 'R-CW', name: 'R-CW OPMC', area: '' },
    { region: 'REGION 01', province: 'NWP', code: 'R-KG', name: 'R-KG OPMC', area: '' },
    { region: 'REGION 01', province: 'NWP', code: 'R-KLY', name: 'R-KLY OPMC', area: '' },

    // REGION 01 - WPN
    { region: 'REGION 01', province: 'WPN', code: 'R-GQ', name: 'R-GQ OPMC', area: '' },
    { region: 'REGION 01', province: 'WPN', code: 'R-KI', name: 'R-KI OPMC', area: '' },
    { region: 'REGION 01', province: 'WPN', code: 'R-NG', name: 'R-NG OPMC', area: '' },
    { region: 'REGION 01', province: 'WPN', code: 'R-NTB', name: 'R-NTB OPMC', area: '' },
    { region: 'REGION 01', province: 'WPN', code: 'R-WT', name: 'R-WT OPMC', area: '' },

    // REGION 02 - UVA
    { region: 'REGION 02', province: 'UVA', code: 'R-BD', name: 'R-BD OPMC', area: '' },
    { region: 'REGION 02', province: 'UVA', code: 'R-BW', name: 'R-BW OPMC', area: '' },
    { region: 'REGION 02', province: 'UVA', code: 'R-KE', name: 'R-KE OPMC', area: '' },

    // REGION 02 - SAB
    { region: 'REGION 02', province: 'SAB', code: 'R-MRG', name: 'R-MRG OPMC', area: '' },
    { region: 'REGION 02', province: 'SAB', code: 'R-RN', name: 'R-RN OPMC', area: '' },

    // REGION 02 - SP
    { region: 'REGION 02', province: 'SP', code: 'R-GL', name: 'R-GL OPMC', area: '' },
    { region: 'REGION 02', province: 'SP', code: 'R-HB', name: 'R-HB OPMC', area: '' },
    { region: 'REGION 02', province: 'SP', code: 'R-EMB', name: 'R-EMB OPMC', area: '' },
    { region: 'REGION 02', province: 'SP', code: 'R-MH', name: 'R-MH OPMC', area: '' },

    // REGION 02 - WPS
    { region: 'REGION 02', province: 'WPS', code: 'R-AG', name: 'R-AG OPMC', area: '' },
    { region: 'REGION 02', province: 'WPS', code: 'R-HR', name: 'R-HR OPMC', area: '' },
    { region: 'REGION 02', province: 'WPS', code: 'R-KT', name: 'R-KT OPMC', area: '' },
    { region: 'REGION 02', province: 'WPS', code: 'R-PH', name: 'R-PH OPMC', area: '' },

    // REGION 03 - EP
    { region: 'REGION 03', province: 'EP', code: 'R-AP', name: 'R-AP OPMC', area: '' },
    { region: 'REGION 03', province: 'EP', code: 'R-BC', name: 'R-BC OPMC', area: '' },
    { region: 'REGION 03', province: 'EP', code: 'R-KL', name: 'R-KL OPMC', area: '' },
    { region: 'REGION 03', province: 'EP', code: 'R-PR', name: 'R-PR OPMC', area: '' },
    { region: 'REGION 03', province: 'EP', code: 'R-TC', name: 'R-TC OPMC', area: '' },

    // REGION 03 - NP
    { region: 'REGION 03', province: 'NP', code: 'R-AD', name: 'R-AD OPMC', area: '' },
    { region: 'REGION 03', province: 'NP', code: 'R-JA', name: 'R-JA OPMC', area: '' },
    { region: 'REGION 03', province: 'NP', code: 'R-KO', name: 'R-KO OPMC', area: '' },
    { region: 'REGION 03', province: 'NP', code: 'R-MB', name: 'R-MB OPMC', area: '' },
    { region: 'REGION 03', province: 'NP', code: 'R-VA', name: 'R-VA OPMC', area: '' },
    { region: 'REGION 03', province: 'NP', code: 'R-MLT', name: 'R-MLT OPMC', area: '' },
];

async function main() {
    console.log('Starting OPMC data seeding...');

    let created = 0;
    let skipped = 0;

    for (const opmc of opmcData) {
        try {
            // Check if OPMC code already exists
            const existing = await prisma.oPMC.findUnique({
                where: { code: opmc.code }
            });

            if (existing) {
                console.log(`⏭️  Skipped ${opmc.code} - already exists`);
                skipped++;
            } else {
                await prisma.oPMC.create({
                    data: opmc
                });
                console.log(`✅ Created ${opmc.code}`);
                created++;
            }
        } catch (error) {
            console.error(`❌ Error creating ${opmc.code}:`, error);
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${opmcData.length}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
