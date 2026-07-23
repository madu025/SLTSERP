import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CoARecord {
    code: string;
    name: string;
}

async function main() {
    const lines = await prisma.journalLine.groupBy({
        by: ['accountCode'],
        _sum: { debit: true, credit: true }
    });
    const coaList = await (prisma.chartOfAccount.findMany() as Promise<CoARecord[]>);
    const coaSet = new Set(coaList.map((c: CoARecord) => c.code));

    console.log('--- Account Codes in Journal Lines vs ChartOfAccount ---');
    for (const l of lines) {
        const inCoa = coaSet.has(l.accountCode);
        const d = Number(l._sum.debit || 0);
        const c = Number(l._sum.credit || 0);
        if (!inCoa) {
            console.log(`❌ UNMAPPED CODE IN GL: '${l.accountCode}' -> Debit: ${d}, Credit: ${c}`);
        } else {
            console.log(`  ✓ MAPPED CODE IN GL: '${l.accountCode}' -> Debit: ${d}, Credit: ${c}`);
        }
    }
}

main().finally(() => prisma.$disconnect());
