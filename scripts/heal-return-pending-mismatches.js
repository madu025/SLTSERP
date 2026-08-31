const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// RETURN_PENDING was incorrectly mapped to RETURN (includes('RETURN') fuzzy match),
// firing material/ledger rollback on un-executed returns. Portal remains authority:
// reset these rows to INPROGRESS and let the next sync cycle re-derive the true state
// (portal will confirm RETURN_PENDING still pending, a real RETURN, or a completion).
const BATCH = 3;
const BATCH_DELAY_MS = 2000;

async function main() {
    const rows = await p.serviceOrder.findMany({
        where: {
            sltsStatus: 'RETURN',
            status: 'PENDING',
            OR: [
                { returnReason: { contains: 'RETURN_PENDING' } },
                { comments: { contains: 'RETURN_PENDING' } }
            ]
        },
        select: { id: true, soNum: true, status: true, statusDate: true, comments: true }
    });
    console.log('Rows to heal:', rows.length);

    let fixed = 0, failed = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        await Promise.all(batch.map(async (sod) => {
            try {
                await p.$transaction(async (tx) => {
                    await tx.serviceOrder.update({
                        where: { id: sod.id },
                        data: {
                            sltsStatus: 'INPROGRESS',
                            returnReason: null,
                            comments: sod.comments
                                ? `${sod.comments}\n[SYNC-FIX] RETURN_PENDING was wrongly mapped to RETURN; reset to active (portal authority).`
                                : '[SYNC-FIX] RETURN_PENDING was wrongly mapped to RETURN; reset to active (portal authority).',
                            statusDate: sod.statusDate || new Date()
                        }
                    });
                    await tx.serviceOrderStatusHistory.create({
                        data: {
                            serviceOrderId: sod.id,
                            status: 'INPROGRESS',
                            statusDate: new Date()
                        }
                    });
                });
                fixed++;
            } catch (e) {
                failed++;
                console.error('Failed:', sod.soNum, String(e.message).slice(0, 120));
            }
        }));
        console.log(`Progress: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
        if (i + BATCH < rows.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }
    }
    console.log(`Done. Fixed: ${fixed}, Failed: ${failed}`);
}

main().catch(console.error).finally(() => p.$disconnect());
