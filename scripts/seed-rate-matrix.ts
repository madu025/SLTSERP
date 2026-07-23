import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres.cxhjerzucacqsxoumhio:Osp%23slts%40Osp@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const rateRulesData = [
  // FTTH Drop Wire Lengths
  { workType: 'FTTH', workDescription: 'FTTH - DW length- (0-100)', minDistance: 0, maxDistance: 100, cen: 6750.00, hk: 6750.00, other: 6650.00 },
  { workType: 'FTTH', workDescription: 'FTTH - DW length- (101-200)', minDistance: 101, maxDistance: 200, cen: 6750.00, hk: 6750.00, other: 7000.00 },
  { workType: 'FTTH', workDescription: 'FTTH - DW length- (201-300)', minDistance: 201, maxDistance: 300, cen: 6750.00, hk: 6750.00, other: 7800.00 },
  { workType: 'FTTH', workDescription: 'FTTH - DW length- (301-400)', minDistance: 301, maxDistance: 400, cen: 6750.00, hk: 6750.00, other: 8400.00 },
  { workType: 'FTTH', workDescription: 'FTTH - DW length- (401-500)', minDistance: 401, maxDistance: 500, cen: 6750.00, hk: 6750.00, other: 8800.00 },
  { workType: 'FTTH', workDescription: 'FTTH - DW length- (500 ++)', minDistance: 501, maxDistance: 9999, cen: 6750.00, hk: 6750.00, other: 9000.00 },

  // FTTH High Rise & Configuration Only
  { workType: 'FTTH', workDescription: 'FTTH -High Rise Building (Configuration only)', minDistance: 0, maxDistance: 9999, cen: 3800.00, hk: 3800.00, other: 3800.00 },
  { workType: 'FTTH', workDescription: 'FTTH Configuration only', minDistance: 0, maxDistance: 9999, cen: 1000.00, hk: 1000.00, other: 1000.00 },

  // DATA Drop Wire Lengths
  { workType: 'DATA', workDescription: 'DATA - DW length- (0-100)', minDistance: 0, maxDistance: 100, cen: 5500.00, hk: 5500.00, other: 5000.00 },
  { workType: 'DATA', workDescription: 'DATA - DW length- (101-200)', minDistance: 101, maxDistance: 200, cen: 5500.00, hk: 5500.00, other: 5500.00 },
  { workType: 'DATA', workDescription: 'DATA - DW length- (201-300)', minDistance: 201, maxDistance: 300, cen: 5500.00, hk: 5500.00, other: 6200.00 },
  { workType: 'DATA', workDescription: 'DATA - DW length- (301-400)', minDistance: 301, maxDistance: 400, cen: 5500.00, hk: 5500.00, other: 6800.00 },
  { workType: 'DATA', workDescription: 'DATA - DW length- (401-500)', minDistance: 401, maxDistance: 500, cen: 5500.00, hk: 5500.00, other: 7200.00 },
  { workType: 'DATA', workDescription: 'DATA - DW length- (500 ++)', minDistance: 501, maxDistance: 9999, cen: 5500.00, hk: 5500.00, other: 7400.00 },

  // PSTN Connections
  { workType: 'PSTN', workDescription: 'PSTN- CP/NWP - 1st Con', minDistance: 0, maxDistance: 9999, cen: 2900.00, hk: 2900.00, other: 2900.00 },
  { workType: 'PSTN', workDescription: 'PSTN- CP/NWP - 2nd Con', minDistance: 0, maxDistance: 9999, cen: 3000.00, hk: 3000.00, other: 3000.00 },
  { workType: 'PSTN', workDescription: 'PSTN- CP/NWP - 3rd Con', minDistance: 0, maxDistance: 9999, cen: 3100.00, hk: 3100.00, other: 3100.00 },
  { workType: 'PSTN', workDescription: 'PSTN- CP/NWP - 4th Con', minDistance: 0, maxDistance: 9999, cen: 3200.00, hk: 3200.00, other: 3200.00 },
  { workType: 'PSTN', workDescription: 'PSTN - NP/EP - 1st Con', minDistance: 0, maxDistance: 9999, cen: 3000.00, hk: 3000.00, other: 3000.00 },
  { workType: 'PSTN', workDescription: 'PSTN - NP/EP - 2nd Con', minDistance: 0, maxDistance: 9999, cen: 3100.00, hk: 3100.00, other: 3100.00 },
  { workType: 'PSTN', workDescription: 'PSTN - NP/EP - 3rd Con', minDistance: 0, maxDistance: 9999, cen: 3200.00, hk: 3200.00, other: 3200.00 },
  { workType: 'PSTN', workDescription: 'PSTN - NP/EP - 4th Con', minDistance: 0, maxDistance: 9999, cen: 3300.00, hk: 3300.00, other: 3300.00 },
  { workType: 'PSTN', workDescription: 'PSTN Con (IDP)', minDistance: 0, maxDistance: 9999, cen: 1500.00, hk: 1500.00, other: 1500.00 },

  // IPTV Visits
  { workType: 'IPTV', workDescription: 'IPTV- Single Visit', minDistance: 0, maxDistance: 9999, cen: 1500.00, hk: 1500.00, other: 1500.00 },
  { workType: 'IPTV', workDescription: 'IPTV- Second visit', minDistance: 0, maxDistance: 9999, cen: 1800.00, hk: 1800.00, other: 1800.00 },
  { workType: 'IPTV', workDescription: 'IPTV - 2nd / 3rd Visit (FTTH)', minDistance: 0, maxDistance: 9999, cen: 1500.00, hk: 1500.00, other: 1500.00 },

  // Pole Installations
  { workType: 'POLE', workDescription: '5.6m Pole Installation', minDistance: 0, maxDistance: 9999, poleType: '5.6m', poleMethod: 'STANDARD', cen: 700.00, hk: 700.00, other: 700.00 },
  { workType: 'POLE', workDescription: '5.6m Pole Installation ( Manual)', minDistance: 0, maxDistance: 9999, poleType: '5.6m', poleMethod: 'MANUAL', cen: 900.00, hk: 900.00, other: 900.00 },
  { workType: 'POLE', workDescription: '5.6m Pole Installation & Base Concrete', minDistance: 0, maxDistance: 9999, poleType: '5.6m', poleMethod: 'CONCRETE', cen: 4000.00, hk: 4000.00, other: 4000.00 },
  { workType: 'POLE', workDescription: '6.7m Pole Installations', minDistance: 0, maxDistance: 9999, poleType: '6.7m', poleMethod: 'STANDARD', cen: 800.00, hk: 800.00, other: 800.00 },
  { workType: 'POLE', workDescription: '6.7m Pole Installation ( Manual)', minDistance: 0, maxDistance: 9999, poleType: '6.7m', poleMethod: 'MANUAL', cen: 1000.00, hk: 1000.00, other: 1000.00 },
  { workType: 'POLE', workDescription: '6.7m Pole Installation & Base Concrete', minDistance: 0, maxDistance: 9999, poleType: '6.7m', poleMethod: 'CONCRETE', cen: 4000.00, hk: 4000.00, other: 4000.00 },
  { workType: 'POLE', workDescription: '8m Pole Installation', minDistance: 0, maxDistance: 9999, poleType: '8.0m', poleMethod: 'STANDARD', cen: 900.00, hk: 900.00, other: 900.00 },
  { workType: 'POLE', workDescription: '8m Pole Installation ( Manual)', minDistance: 0, maxDistance: 9999, poleType: '8.0m', poleMethod: 'MANUAL', cen: 1500.00, hk: 1500.00, other: 1500.00 },
  { workType: 'POLE', workDescription: '8m Pole Installation & Base Concrete', minDistance: 0, maxDistance: 9999, poleType: '8.0m', poleMethod: 'CONCRETE', cen: 4000.00, hk: 4000.00, other: 4000.00 },
  { workType: 'POLE', workDescription: '5.6m Poles Installation (External Boom)', minDistance: 0, maxDistance: 9999, poleType: '5.6m', poleMethod: 'BOOM', cen: 2500.00, hk: 2500.00, other: 2500.00 },
  { workType: 'POLE', workDescription: '6.7m Poles Installation (External Boom)', minDistance: 0, maxDistance: 9999, poleType: '6.7m', poleMethod: 'BOOM', cen: 2900.00, hk: 2900.00, other: 2900.00 },
  { workType: 'POLE', workDescription: '8.0m Poles Installation (External Boom)', minDistance: 0, maxDistance: 9999, poleType: '8.0m', poleMethod: 'BOOM', cen: 3200.00, hk: 3200.00, other: 3200.00 }
];

async function seedContractorRateMatrix() {
  console.log(`\n======================================================================`);
  console.log(`🌱 SEEDING DYNAMIC CONTRACTOR INVOICING RATE MATRIX (CEN / HK / OTHER)`);
  console.log(`======================================================================\n`);

  try {
    // Clear existing rules to avoid duplicate seed conflicts
    await prisma.contractorRateRule.deleteMany({});
    console.log(`   🧹 Cleared existing rate rules...`);

    let totalInserted = 0;

    for (const rule of rateRulesData) {
      const regions: Array<{ areaGroup: 'CEN' | 'HK' | 'OTHER'; rateAmount: number }> = [
        { areaGroup: 'CEN', rateAmount: rule.cen },
        { areaGroup: 'HK', rateAmount: rule.hk },
        { areaGroup: 'OTHER', rateAmount: rule.other }
      ];

      for (const reg of regions) {
        await prisma.contractorRateRule.create({
          data: {
            workType: rule.workType,
            workDescription: rule.workDescription,
            minDistance: rule.minDistance,
            maxDistance: rule.maxDistance,
            areaGroup: reg.areaGroup,
            rateAmount: reg.rateAmount,
            poleType: (rule as any).poleType || null,
            poleMethod: (rule as any).poleMethod || null,
            isActive: true
          }
        });
        totalInserted++;
      }
    }

    console.log(`\n======================================================================`);
    console.log(`🎉 SUCCESS: Seeded ${totalInserted} Dynamic Contractor Rate Rules into PostgreSQL!`);
    console.log(`======================================================================\n`);

  } catch (err: any) {
    console.error(`❌ SEEDING ERROR:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

seedContractorRateMatrix();
