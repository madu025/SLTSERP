/* Shared Prisma helper: retry on transient pooler unreachability + 6543 fallback */
const { PrismaClient } = require('@prisma/client');

const url = process.env.DATABASE_URL || '';
const prisma = new PrismaClient();
const prisma6543 = url.includes(':5432') ? new PrismaClient({ datasources: { db: { url: url.replace(':5432', ':6543') } } }) : null;

function isUnreachable(e) {
    return e.code === 'P1001' || String(e.message || '').includes("Can't reach database server");
}

async function withRetry(fn, label, tries = 5) {
    let lastErr;
    for (let i = 1; i <= tries; i++) {
        try { return await fn(); } catch (e) {
            lastErr = e;
            if (isUnreachable(e) && i < tries) {
                console.log(`[${label}] unreachable attempt ${i}, retrying in 4s...`);
                await new Promise(r => setTimeout(r, 4000));
                continue;
            }
            throw e;
        }
    }
    throw lastErr;
}

/** q(tx => tx.model.findMany(...), 'label') — runs query with retry + pooler fallback */
async function q(fn, label) {
    try {
        return await withRetry(() => fn(prisma), label);
    } catch (e) {
        if (prisma6543 && isUnreachable(e)) {
            console.log(`[${label}] falling back to transaction pooler :6543`);
            return await withRetry(() => fn(prisma6543), label + ':6543');
        }
        throw e;
    }
}

async function disconnect() {
    await prisma.$disconnect();
    if (prisma6543) await prisma6543.$disconnect();
}

module.exports = { q, disconnect, prisma };
