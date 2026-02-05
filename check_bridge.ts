
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const sync = await prisma.sODBridgeSync.findFirst({
        where: { soNum: 'AN202601270027566' },
        orderBy: { updatedAt: 'desc' }
    });
    if (!sync) {
        console.log("Sync not found");
        return;
    }
    console.log("Bridge Scraped Data:");
    console.log(JSON.stringify(sync.scrapedData, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
