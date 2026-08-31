const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Pick a harmless, long-terminal SOD to test against (never modifies its status).
async function pickVictim() {
    const sod = await p.serviceOrder.findFirst({
        where: { sltsStatus: 'INSTALL_CLOSED', status: 'INSTALL_CLOSED' },
        select: { id: true, soNum: true, comments: true }
    });
    if (!sod) throw new Error('No INSTALL_CLOSED SOD found for test');
    return sod;
}

async function main() {
    const sod = await pickVictim();
    console.log('Test SOD:', sod.soNum);

    // ── Test 1: VIOLATING write must be REJECTED ──
    // Payload sets status=PENDING while row already has sltsStatus=INSTALL_CLOSED.
    // The trigger must raise SOD_STATUS_INVARIANT_VIOLATION and abort.
    let violationRejected = false;
    try {
        await p.serviceOrder.update({
            where: { id: sod.id },
            data: { status: 'PENDING' }
        });
    } catch (e) {
        const msg = String(e.message || '');
        if (msg.includes('SOD_STATUS_INVARIANT_VIOLATION')) {
            violationRejected = true;
            console.log('TEST 1 PASS: violating write rejected ->', msg.slice(0, 120));
        } else {
            console.log('TEST 1 FAIL: rejected with unexpected error:', msg.slice(0, 200));
        }
    }
    if (!violationRejected) console.log('TEST 1 FAIL: violating write was ACCEPTED');

    // ── Test 2: VALID write must PASS (no status change involved) ──
    const marker = `INVARIANT-TEST-${Date.now()}`;
    await p.serviceOrder.update({
        where: { id: sod.id },
        data: { comments: `${sod.comments || ''}\n${marker}` }
    });
    console.log('TEST 2 PASS: valid comment update accepted');

    // ── Test 3: VALID write must PASS (coherent terminal pair) ──
    await p.serviceOrder.update({
        where: { id: sod.id },
        data: { status: 'INSTALL_CLOSED', sltsStatus: 'INSTALL_CLOSED' }
    });
    console.log('TEST 3 PASS: coherent INSTALL_CLOSED+INSTALL_CLOSED pair accepted');

    // ── Cleanup: remove test marker comment ──
    const clean = await p.serviceOrder.findUnique({ where: { id: sod.id }, select: { comments: true } });
    if (clean && clean.comments && clean.comments.includes(marker)) {
        await p.serviceOrder.update({
            where: { id: sod.id },
            data: { comments: clean.comments.replace(`\n${marker}`, '') }
        });
    }
    console.log('Cleanup done. Final state:', sod.soNum);

    const final = await p.serviceOrder.findUnique({
        where: { id: sod.id },
        select: { status: true, sltsStatus: true }
    });
    console.log('Final status pair:', JSON.stringify(final));
}

main().catch(console.error).finally(() => p.$disconnect());
