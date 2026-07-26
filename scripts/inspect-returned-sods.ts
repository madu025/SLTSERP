import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

let directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
if (directUrl.includes(':5432')) {
  directUrl = directUrl.replace(':5432', ':6543');
}
if (!directUrl.includes('pgbouncer=true')) {
  directUrl += (directUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: directUrl,
    },
  },
});

async function main() {
  const targetVoiceNumbers = ['0112548509', '0112876062', '0112585874', '0112875623'];

  console.log('====================================================');
  console.log('=== INSPECTING RETURNED SODS FOR VOICE NUMBERS ===');
  console.log('====================================================');

  for (const voiceNo of targetVoiceNumbers) {
    console.log(`\n----------------------------------------------------`);
    console.log(`🔎 Searching SOD for Voice Number: ${voiceNo}`);
    
    const sods = await prisma.serviceOrder.findMany({
      where: {
        voiceNumber: { contains: voiceNo }
      },
      include: {
        commentsHistory: true,
        statusHistory: true,
        contractor: true,
        team: true,
      }
    });

    if (sods.length === 0) {
      console.log(`❌ No ServiceOrder found matching voiceNumber containing '${voiceNo}'`);
      continue;
    }

    for (const sod of sods) {
      console.log(`\n📌 SO Number: ${sod.soNum}`);
      console.log(`   Voice Number: ${sod.voiceNumber}`);
      console.log(`   Status (Main / SLTS): ${sod.status} / ${sod.sltsStatus}`);
      console.log(`   Return Reason (DB field): "${sod.returnReason || 'EMPTY / NULL'}"`);
      console.log(`   Delay Reasons: "${sod.delayReasons || 'EMPTY / NULL'}"`);
      console.log(`   Comments (DB field): "${sod.comments || 'EMPTY / NULL'}"`);
      console.log(`   QC Comment / Status: "${sod.qcComment || 'N/A'}" / ${sod.qcStatus || 'N/A'}`);
      console.log(`   Contractor / Team: ${sod.contractor?.name || 'N/A'} / ${sod.team?.name || 'N/A'}`);
      console.log(`   Updated At: ${sod.updatedAt.toISOString()}`);

      console.log(`\n   💬 Comments History (${sod.commentsHistory.length} entries):`);
      if (sod.commentsHistory.length > 0) {
        sod.commentsHistory.forEach((c, idx) => {
          console.log(`      [${idx + 1}] (${c.createdAt.toISOString()}): ${c.comment}`);
        });
      } else {
        console.log(`      (No comments in CommentsHistory table)`);
      }

      console.log(`\n   📜 Status History (${sod.statusHistory.length} entries):`);
      if (sod.statusHistory.length > 0) {
        sod.statusHistory.forEach((s, idx) => {
          console.log(`      [${idx + 1}] Status: ${s.status} | Date: ${s.statusDate.toISOString()} | Logged: ${s.createdAt.toISOString()}`);
        });
      }

      // Check if ExtensionRawData exists for this SO Number
      const rawData = await prisma.extensionRawData.findFirst({
        where: { soNum: sod.soNum },
        orderBy: { createdAt: 'desc' }
      });

      if (rawData) {
        console.log(`\n   🌐 ExtensionRawData Scrape Log found!`);
        console.log(`      Active Tab: ${rawData.activeTab}`);
        const scraped = rawData.scrapedData as any;
        console.log(`      Scraped Details Keys:`, Object.keys(scraped.details || {}));
        if (scraped.details) {
          console.log(`      Scraped Details Content:`, JSON.stringify(scraped.details, null, 2));
        }
        if (scraped.allTabs) {
          console.log(`      Scraped All Tabs Keys:`, Object.keys(scraped.allTabs || {}));
        }
      } else {
        console.log(`\n   🌐 ExtensionRawData Scrape Log: None found for ${sod.soNum}`);
      }
    }
  }

  console.log('\n====================================================');
}

main()
  .catch((e) => console.error('EXECUTION ERROR:', e))
  .finally(() => prisma.$disconnect());
