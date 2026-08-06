/**
 * One-time fix: Clear stale "[AUTO-SYNC] Disappeared" comments
 * and fix status mismatches for SODs that recovered from DISAPPEARED.
 * 
 * Run: npx tsx scripts/fix-disappeared-comments.ts
 */

import { PrismaClient, ServiceOrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Starting fix for stale [AUTO-SYNC] Disappeared comments...\n');

    // ─── Part 1: Fix status mismatches ───────────────────────────────
    // SODs where status=DISAPPEARED but sltsStatus has moved to a completion status
    // Fix per-group since Prisma doesn't support SET status = "sltsStatus"
    const groups = [
        { sltsStatus: ServiceOrderStatus.INSTALL_CLOSED, label: 'INSTALL_CLOSED' },
        { sltsStatus: ServiceOrderStatus.COMPLETED, label: 'COMPLETED' },
        { sltsStatus: ServiceOrderStatus.PROV_CLOSED, label: 'PROV_CLOSED' },
    ];

    let totalStatusFixed = 0;
    for (const group of groups) {
        const result = await prisma.serviceOrder.updateMany({
            where: {
                comments: { contains: 'AUTO-SYNC' },
                status: ServiceOrderStatus.DISAPPEARED,
                sltsStatus: group.sltsStatus,
            },
            data: {
                status: group.sltsStatus,
                comments: null,
            },
        });
        console.log(`  ✅ status=DISAPPEARED → ${group.label}: ${result.count} SODs fixed`);
        totalStatusFixed += result.count;
    }

    // ─── Part 2: Clear stale comments for SODs with correct status ───
    // SODs where status is already correct but comments still have stale text
    const correctStatuses = [
        ServiceOrderStatus.INSTALL_CLOSED,
        ServiceOrderStatus.COMPLETED,
        ServiceOrderStatus.PROV_CLOSED,
        ServiceOrderStatus.RETURN,
    ];

    const staleCommentsResult = await prisma.serviceOrder.updateMany({
        where: {
            comments: { contains: 'AUTO-SYNC' },
            status: { in: correctStatuses },
        },
        data: {
            comments: null,
        },
    });
    console.log(`  ✅ Cleared stale comments (correct status): ${staleCommentsResult.count} SODs`);

    // ─── Part 3: Clean up duplicate comments for genuinely DISAPPEARED SODs ───
    const disappearedSods = await prisma.serviceOrder.findMany({
        where: {
            comments: { contains: 'AUTO-SYNC' },
            status: ServiceOrderStatus.DISAPPEARED,
            sltsStatus: ServiceOrderStatus.DISAPPEARED,
        },
        select: { id: true, soNum: true, comments: true },
    });

    let dupCleaned = 0;
    for (const sod of disappearedSods) {
        if (sod.comments && sod.comments.includes('\n')) {
            // Has duplicate entries - keep only one copy
            await prisma.serviceOrder.update({
                where: { id: sod.id },
                data: { comments: '[AUTO-SYNC] Disappeared from active portal list' },
            });
            dupCleaned++;
        }
    }
    console.log(`  ✅ Cleaned duplicate comments (genuinely DISAPPEARED): ${dupCleaned} SODs`);

    // ─── Summary ─────────────────────────────────────────────────────
    const remaining = await prisma.serviceOrder.count({
        where: { comments: { contains: 'AUTO-SYNC' } },
    });

    console.log(`\n📊 Summary:`);
    console.log(`   Status mismatches fixed: ${totalStatusFixed}`);
    console.log(`   Stale comments cleared:   ${staleCommentsResult.count}`);
    console.log(`   Duplicate comments cleaned: ${dupCleaned}`);
    console.log(`   Remaining with AUTO-SYNC:  ${remaining} (should be ~96 genuinely DISAPPEARED)`);
    console.log('\n✅ Fix complete!');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
