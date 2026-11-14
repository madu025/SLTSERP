import { prisma } from '@/lib/prisma';
import { computeEvm, plannedPercent, type EvmResult } from '@/lib/project-evm';

/** Projects that are finished or cancelled are not tracked any more. */
const FINISHED_STATUSES = ['COMPLETED', 'CANCELLED', 'SLT_PAT_PASSED', 'PRE_PAT_PASSED'];

/** Calendar day in Asia/Colombo, YYYY-MM-DD: the period label of a daily snapshot. */
export function colomboDay(d: Date): string {
    return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Daily earned-value pass: recompute every active project's EVM from its schedule, progress and cost ledger,
 * keep the current figures on ProjectEVM and one history row per day in EVMSnapshot.
 *
 * Only projects with a budget are measurable; rows a person entered by hand (source MANUAL) are left alone.
 * It never touches project data itself. Idempotent per day (upsert on evmId + periodLabel).
 */
export class ProjectEvmSnapshotService {
    static async runDaily(now: Date = new Date()): Promise<{ processed: number; updated: number; skippedManual: number; unmeasurable: number }> {
        const projects = await prisma.project.findMany({
            where: { status: { notIn: FINISHED_STATUSES as never[] } },
            select: { id: true, budget: true, actualCost: true, progress: true, startDate: true, endDate: true },
        });
        const measurable = projects.filter((p) => Number(p.budget ?? 0) > 0);
        const ids = measurable.map((p) => p.id);

        const [tasks, existing] = await Promise.all([
            ids.length ? prisma.projectTask.findMany({ where: { projectId: { in: ids } }, select: { projectId: true, plannedStartDate: true, plannedEndDate: true, estimatedCost: true, plannedDuration: true } }) : [],
            ids.length ? prisma.projectEVM.findMany({ where: { projectId: { in: ids } }, select: { projectId: true, source: true } }) : [],
        ]);
        const tasksBy = new Map<string, typeof tasks>();
        for (const t of tasks) tasksBy.set(t.projectId, [...(tasksBy.get(t.projectId) ?? []), t]);
        const sourceBy = new Map(existing.map((e) => [e.projectId, e.source]));

        const label = colomboDay(now);
        let updated = 0;
        let skippedManual = 0;

        for (const p of measurable) {
            if (sourceBy.get(p.id) === 'MANUAL') { skippedManual++; continue; }
            const plannedPct = plannedPercent(
                (tasksBy.get(p.id) ?? []).map((t) => ({ plannedStart: t.plannedStartDate, plannedEnd: t.plannedEndDate, estimatedCost: t.estimatedCost === null ? null : Number(t.estimatedCost), plannedDurationDays: t.plannedDuration })),
                { startDate: p.startDate, endDate: p.endDate },
                now,
            );
            const cost = Number(p.actualCost ?? 0);
            const evm = computeEvm({ bac: Number(p.budget), progressPct: Number(p.progress ?? 0), plannedPct, actualCost: cost > 0 ? cost : null });
            await this.persist(p.id, evm, label, now);
            updated++;
        }
        return { processed: projects.length, updated, skippedManual, unmeasurable: projects.length - measurable.length };
    }

    private static async persist(projectId: string, evm: EvmResult, label: string, now: Date) {
        const data = {
            lastCalculatedAt: now,
            pvTotal: evm.pv ?? 0, evTotal: evm.ev, acTotal: evm.ac ?? 0,
            spi: evm.spi, cpi: evm.cpi, scheduleVariance: evm.sv, costVariance: evm.cv,
            estimateAtCompletion: evm.eac, estimateToComplete: evm.etc, varianceAtCompletion: evm.vac,
            status: evm.status, statusNotes: evm.gaps.length ? evm.gaps.join('; ').slice(0, 500) : null,
            source: 'AUTO',
        };
        const row = await prisma.projectEVM.upsert({ where: { projectId }, update: data, create: { projectId, ...data } });
        const snap = {
            snapshotDate: now, pvCumulative: evm.pv ?? 0, evCumulative: evm.ev, acCumulative: evm.ac ?? 0,
            spi: evm.spi, cpi: evm.cpi, scheduleVariance: evm.sv, costVariance: evm.cv,
        };
        await prisma.eVMSnapshot.upsert({
            where: { evmId_periodLabel: { evmId: row.id, periodLabel: label } },
            update: snap,
            create: { evmId: row.id, periodLabel: label, ...snap },
        });
    }
}
