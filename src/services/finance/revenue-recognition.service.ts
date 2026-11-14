import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { getAccessibleProjectIds } from '@/lib/project-record-access';

export interface RevenueRecognitionRow {
    projectId: string;
    projectCode: string;
    name: string;
    status: string;
    contractValue: number;
    progressPct: number;
    recognisedRevenue: number;
    billedToDate: number;
    /** Revenue earned but not yet billed (unbilled / contract asset). */
    contractAsset: number;
    /** Billed ahead of work done (deferred revenue / contract liability). */
    contractLiability: number;
    actualCost: number;
    /** Projected total cost if the project keeps its current cost efficiency: actual cost / progress. */
    estimateAtCompletion: number | null;
    expectedProfit: number | null;
    expectedLoss: boolean;
}

export interface RevenueRecognitionReport {
    asOf: string;
    rows: RevenueRecognitionRow[];
    withoutContractValue: { count: number; projects: { projectId: string; projectCode: string; name: string }[] };
    totals: { contractValue: number; recognisedRevenue: number; billedToDate: number; contractAsset: number; contractLiability: number; expectedLossProjects: number };
    note: string;
}

/** Pure percentage-of-completion maths for one contract, kept separate so it can be tested exactly. */
export function pocMetrics(contractValue: number, progressPct: number, billed: number, actualCost: number) {
    const progress = Math.min(Math.max(progressPct, 0), 100);
    const recognised = Math.round(contractValue * progress) / 100;
    const gap = recognised - billed;
    const estimateAtCompletion = progress > 0 ? Math.round((actualCost / progress) * 100 * 100) / 100 : null;
    const expectedProfit = estimateAtCompletion === null ? null : Math.round((contractValue - estimateAtCompletion) * 100) / 100;
    return {
        recognisedRevenue: recognised,
        contractAsset: gap > 0 ? gap : 0,
        contractLiability: gap < 0 ? -gap : 0,
        estimateAtCompletion,
        expectedProfit,
        expectedLoss: expectedProfit !== null && expectedProfit < 0,
    };
}

/**
 * Contract-level revenue recognition (percentage of completion) for projects that have a contract value.
 * Read-only: it reports what should be recognised and the resulting contract asset / liability, it never
 * posts entries. OPMC scope is enforced through the caller's accessible projects.
 */
export class RevenueRecognitionService {
    static async getReport(userId: string | null | undefined, now = new Date()): Promise<RevenueRecognitionReport> {
        const accessible = await getAccessibleProjectIds(userId);
        const projects = await prisma.project.findMany({
            where: { status: { not: 'CANCELLED' }, ...(accessible ? { id: { in: [...accessible] } } : {}) },
            select: { id: true, projectCode: true, name: true, status: true, progress: true, contractValue: true, actualCost: true },
            orderBy: { projectCode: 'asc' },
        });

        const withValue = projects.filter((p) => p.contractValue !== null && Number(p.contractValue) > 0);
        const billed = withValue.length === 0 ? [] : await prisma.projectInvoice.groupBy({
            by: ['projectId'],
            where: { projectId: { in: withValue.map((p) => p.id) }, type: 'CLIENT', status: { notIn: ['DRAFT', 'CANCELLED', 'REJECTED'] } },
            _sum: { totalAmount: true },
        });
        const billedBy = new Map(billed.map((b) => [b.projectId, Number(b._sum.totalAmount ?? 0)]));

        const rows: RevenueRecognitionRow[] = withValue.map((p) => {
            const contractValue = Number(p.contractValue);
            const progressPct = Number(p.progress ?? 0);
            const billedToDate = billedBy.get(p.id) ?? 0;
            const actualCost = Number(p.actualCost ?? 0);
            return { projectId: p.id, projectCode: p.projectCode, name: p.name, status: p.status, contractValue, progressPct, billedToDate, actualCost, ...pocMetrics(contractValue, progressPct, billedToDate, actualCost) };
        }).sort((a, b) => b.contractAsset + b.contractLiability - (a.contractAsset + a.contractLiability));

        const without = projects.filter((p) => p.contractValue === null || Number(p.contractValue) <= 0)
            .map((p) => ({ projectId: p.id, projectCode: p.projectCode, name: p.name }));
        const sum = (f: (r: RevenueRecognitionRow) => number) => rows.reduce((a, r) => a + f(r), 0);

        return {
            asOf: now.toISOString(), rows,
            withoutContractValue: { count: without.length, projects: without.slice(0, 50) },
            totals: {
                contractValue: sum((r) => r.contractValue), recognisedRevenue: sum((r) => r.recognisedRevenue), billedToDate: sum((r) => r.billedToDate),
                contractAsset: sum((r) => r.contractAsset), contractLiability: sum((r) => r.contractLiability), expectedLossProjects: rows.filter((r) => r.expectedLoss).length,
            },
            note: 'Recognised revenue = contract value x project progress. Billed = issued client invoices. The estimate at completion extrapolates the cost to date at the current progress, so it is a warning signal, not a forecast. Nothing here posts to the ledger.',
        };
    }

    /** Set (or clear with null) a project's client contract value. */
    static async setContractValue(userId: string | null | undefined, projectId: string, contractValue: number | null) {
        const accessible = await getAccessibleProjectIds(userId);
        if (accessible && !accessible.has(projectId)) throw AppError.forbidden('That project is outside your access');
        if (contractValue !== null && (!Number.isFinite(contractValue) || contractValue < 0)) throw AppError.badRequest('Contract value must be a non-negative number');
        const exists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
        if (!exists) throw AppError.notFound('Project not found');
        await prisma.project.update({ where: { id: projectId }, data: { contractValue } });
        return { projectId, contractValue };
    }
}
