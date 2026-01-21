import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function test() {
    const raw = await prisma.$queryRaw`SELECT "receivedDate" FROM "ServiceOrder" LIMIT 1`;
    console.log('Raw result:', raw);
    process.exit(0);
}
test();
