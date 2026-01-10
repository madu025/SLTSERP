const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    const bankCount = await prisma.bank.count();
    const branchCount = await prisma.bankBranch.count();
    const firstBank = await prisma.bank.findFirst();
    const firstBranch = await prisma.bankBranch.findFirst();

    console.log({
        bankCount,
        branchCount,
        firstBank,
        firstBranch
    });
}

test().catch(console.error).finally(() => prisma.$disconnect());
