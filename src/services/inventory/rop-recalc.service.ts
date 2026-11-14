import { prisma } from '@/lib/prisma';

/**
 * Weekly reorder-level recalculation. It rewrites item reorder levels from the last 90 days of use and purchase lead
 * times, so it only runs when SystemConfig ROP_AUTO_RECALC is "true". A store minimum that differs from the item level
 * is a deliberate override and is never touched (see fn_update_rop_levels).
 */
export class RopRecalcService {
    static async run(): Promise<{ skipped: boolean; updated: number }> {
        const flag = await prisma.$queryRaw<{ value: string }[]>`SELECT "value" FROM "SystemConfig" WHERE "key" = 'ROP_AUTO_RECALC' LIMIT 1`;
        if ((flag[0]?.value ?? '').toLowerCase() !== 'true') return { skipped: true, updated: 0 };
        const rows = await prisma.$queryRaw<{ updated: number }[]>`SELECT fn_update_rop_levels() AS updated`;
        return { skipped: false, updated: Number(rows[0]?.updated ?? 0) };
    }
}
