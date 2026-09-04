import { prisma } from '@/lib/prisma';

/**
 * Postgres-backed scheduler state.
 *
 * The queue path dedupes a tick's child work with deterministic BullMQ job ids. Serverless has
 * neither Redis nor a worker (`instrumentation.ts` skips worker boot when VERCEL=1), so that
 * dedupe cannot exist - yet one 10-minute clock still fans out into interval tasks and wall-clock
 * dailies that must each run once per slot, including when several function instances are invoked
 * for the same minute or a manual trigger overlaps a scheduled tick.
 *
 * State lives in `SystemConfig` (key/value) and every claim is a compare-and-set on the stored
 * JSON string: a concurrent writer makes the update match zero rows, so the loser stands down
 * instead of double-running portal work. `updatedAt` is Prisma-managed, which is what makes the
 * lease expiry check a single statement.
 */

const SLOTS_KEY = 'cron.tick.slots';
const LOCK_KEY = 'cron.tick.lock';
const SWEEP_CURSOR_KEY = 'cron.tick.rtom-cursor';

interface SlotEntry {
    ranAt: number;
    dayKey?: string;
}

type SlotMap = Record<string, SlotEntry>;

export type SlotPlan =
    | { kind: 'interval'; intervalMs: number }
    | { kind: 'daily'; dayKey: string; notBefore: number };

export interface TickLock {
    token: string;
    serialized: string;
}

async function readRaw(key: string): Promise<string | null> {
    const row = await prisma.systemConfig.findUnique({ where: { key }, select: { value: true } });
    return row?.value ?? null;
}

function parseSlots(raw: string | null): SlotMap {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return {};
        const map: SlotMap = {};
        for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
            if (entry && typeof entry === 'object' && typeof (entry as SlotEntry).ranAt === 'number') {
                map[key] = entry as SlotEntry;
            }
        }
        return map;
    } catch {
        return {};
    }
}

function isDue(entry: SlotEntry | undefined, plan: SlotPlan, now: number): boolean {
    if (plan.kind === 'daily' && now < plan.notBefore) return false;
    if (!entry) return true;
    if (plan.kind === 'interval') return now - entry.ranAt >= plan.intervalMs;
    return entry.dayKey !== plan.dayKey;
}

/**
 * Claim a task slot for this tick. True means "nobody has run this task in its current slot, and
 * it is now yours to run". False means not due yet, or another instance won the compare-and-set.
 */
export async function claimSlot(taskId: string, plan: SlotPlan, now: number = Date.now()): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
        const raw = await readRaw(SLOTS_KEY);
        const map = parseSlots(raw);
        if (!isDue(map[taskId], plan, now)) return false;

        const entry: SlotEntry = { ranAt: now };
        if (plan.kind === 'daily') entry.dayKey = plan.dayKey;
        const next = JSON.stringify({ ...map, [taskId]: entry });

        if (raw === null) {
            try {
                await prisma.systemConfig.create({
                    data: { key: SLOTS_KEY, value: next, description: 'Cron tick slot ledger (serverless scheduler idempotency)' },
                });
                return true;
            } catch {
                continue; // another instance created it first - re-read and CAS
            }
        }

        const res = await prisma.systemConfig.updateMany({ where: { key: SLOTS_KEY, value: raw }, data: { value: next } });
        if (res.count === 1) return true;
    }
    return false;
}

/**
 * Hand a claimed slot back after the work failed, so the next tick retries instead of waiting a
 * full interval (or losing the whole day for a daily).
 */
export async function releaseSlot(taskId: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
        const raw = await readRaw(SLOTS_KEY);
        if (raw === null) return;
        const map = parseSlots(raw);
        if (!(taskId in map)) return;
        delete map[taskId];
        const res = await prisma.systemConfig.updateMany({
            where: { key: SLOTS_KEY, value: raw },
            data: { value: JSON.stringify(map) },
        });
        if (res.count === 1) return;
    }
}

/**
 * Single-flight lease for the tick itself. A tick that overruns its interval must not let a second
 * instance start the same portal sweep; an instance that died mid-tick only blocks until the lease
 * goes stale, because the expiry is read from `updatedAt` rather than from a counter.
 */
export async function tryAcquireTickLock(ttlMs: number, now: number = Date.now()): Promise<TickLock | null> {
    const token = `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const serialized = JSON.stringify({ token, at: now });

    const taken = await prisma.systemConfig.updateMany({
        where: { key: LOCK_KEY, updatedAt: { lt: new Date(now - ttlMs) } },
        data: { value: serialized },
    });
    if (taken.count === 1) return { token, serialized };

    if ((await readRaw(LOCK_KEY)) === null) {
        try {
            await prisma.systemConfig.create({
                data: { key: LOCK_KEY, value: serialized, description: 'Cron tick single-flight lease (inline serverless ticks)' },
            });
            return { token, serialized };
        } catch {
            return null;
        }
    }
    return null;
}

export async function releaseTickLock(lock: TickLock): Promise<void> {
    await prisma.systemConfig.deleteMany({ where: { key: LOCK_KEY, value: lock.serialized } });
}

/** Index of the next RTOM the inline sweep should pick up (wraps over the target list). */
export async function readSweepCursor(total: number): Promise<number> {
    const raw = await readRaw(SWEEP_CURSOR_KEY);
    const index = raw === null ? 0 : Number.parseInt(raw, 10);
    if (!Number.isFinite(index) || index < 0) return 0;
    return total > 0 ? index % total : 0;
}

export async function writeSweepCursor(index: number): Promise<void> {
    const value = String(index);
    await prisma.systemConfig.upsert({
        where: { key: SWEEP_CURSOR_KEY },
        update: { value },
        create: { key: SWEEP_CURSOR_KEY, value, description: 'RTOM sweep resume position for inline (serverless) ticks' },
    });
}
