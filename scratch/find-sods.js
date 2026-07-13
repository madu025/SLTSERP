const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const soNums = [
    'AD202307070014752',
    'AD202307250058387',
    'AD202307290033640',
    'AD202307290033804',
    'AD202307290034054',
    'AD202307290034112',
    'AD202307290034811',
    'MTE202307070014595',
    'MTE202307150027256',
    'NCH202307170055332',
    'PPK202307110084452'
];

async function main() {
    console.log('Searching for service orders...');
    const results = await prisma.serviceOrder.findMany({
        where: {
            soNum: { in: soNums }
        },
        select: {
            soNum: true,
            receivedDate: true,
            statusDate: true,
            completedDate: true,
            createdAt: true,
            sltsStatus: true,
            status: true,
            rtom: true
        }
    });

    console.log(`Found ${results.length} records:`);
    console.log(JSON.stringify(results, null, 2));

    // Also look for similar ones or case insensitive if not found
    const missing = soNums.filter(num => !results.some(r => r.soNum.toLowerCase() === num.toLowerCase()));
    if (missing.length > 0) {
        console.log('Missing SO numbers:', missing);
        
        // Search case insensitively
        for (const m of missing) {
            const matches = await prisma.serviceOrder.findMany({
                where: {
                    soNum: { contains: m, mode: 'insensitive' }
                },
                select: { soNum: true, rtom: true }
            });
            if (matches.length > 0) {
                console.log(`Partial matches for ${m}:`, matches);
            }
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
