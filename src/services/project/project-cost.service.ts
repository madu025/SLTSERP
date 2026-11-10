import type { TransactionClient } from '@/types/inventory/inventory-service.types';

type Db = TransactionClient;

export interface ProjectCostBreakdown {
    expenseCost: number;
    laborCost: number;
    /** Net material cost at the batch cost recorded in the inventory ledger: issues minus good returns. */
    materialCost: number;
    /** False when an approved issue/return has no cost basis (legacy rows priced at 0), so the total would be partial. */
    materialCostKnown: boolean;
    hasMaterialMovements: boolean;
    budget: number | null;
    /** expenses + labor + material, or null while the material cost is unknown. */
    actualCost: number | null;
}

/**
 * The one definition of a project's actual cost. Material cost comes from the immutable inventory ledger rows written when
 * a stock issue / return is approved (the unit price on those rows is the cost of the batches that were picked), never from
 * the BOQ selling rate and never from the mutable item price.
 */
export async function computeProjectCost(db: Db, projectId: string): Promise<ProjectCostBreakdown> {
    const [issues, returns, expenses, labor, project] = await Promise.all([
        db.stockIssue.findMany({ where: { projectId, status: 'APPROVED' }, select: { issueNumber: true } }),
        db.projectMaterialReturn.findMany({ where: { projectId, status: 'APPROVED' }, select: { returnNumber: true } }),
        db.projectExpense.aggregate({ where: { projectId }, _sum: { amount: true } }),
        db.dailyProgress.aggregate({ where: { projectId }, _sum: { laborCost: true } }),
        db.project.findUnique({ where: { id: projectId }, select: { budget: true } }),
    ]);

    const issueNumbers = issues.map((i) => i.issueNumber);
    const returnNumbers = returns.map((r) => r.returnNumber);
    const ledger = issueNumbers.length || returnNumbers.length
        ? await db.inventoryLedger.findMany({
            where: {
                OR: [
                    ...(issueNumbers.length ? [{ transactionType: 'PROJECT_ISSUE', referenceId: { in: issueNumbers } }] : []),
                    ...(returnNumbers.length ? [{ transactionType: 'PROJECT_RETURN', referenceId: { in: returnNumbers } }] : []),
                ],
            },
            select: { transactionType: true, referenceId: true, quantityChange: true, unitPrice: true },
        })
        : [];

    let materialCost = 0;
    let known = true;
    const issuesWithLedger = new Set<string>();
    for (const row of ledger) {
        const value = Math.abs(Number(row.quantityChange)) * Number(row.unitPrice);
        if (Number(row.unitPrice) <= 0) known = false;
        if (row.transactionType === 'PROJECT_ISSUE') {
            materialCost += value;
            issuesWithLedger.add(row.referenceId);
        } else {
            materialCost -= value;
        }
    }
    // An approved issue without any ledger row has no cost basis either
    if (issueNumbers.some((n) => !issuesWithLedger.has(n))) known = false;

    const expenseCost = Number(expenses._sum.amount ?? 0);
    const laborCost = Number(labor._sum.laborCost ?? 0);
    const round = (v: number) => Math.round(v * 100) / 100;
    return {
        expenseCost,
        laborCost,
        materialCost: round(Math.max(0, materialCost)),
        materialCostKnown: known,
        hasMaterialMovements: issueNumbers.length > 0 || returnNumbers.length > 0,
        budget: project?.budget === null || project?.budget === undefined ? null : Number(project.budget),
        actualCost: known ? round(expenseCost + laborCost + Math.max(0, materialCost)) : null,
    };
}

/** Recomputes and stores project.actualCost / variance from the sources. Leaves the stored total alone while material cost is unknown. */
export async function syncProjectActualCost(db: Db, projectId: string): Promise<ProjectCostBreakdown> {
    const cost = await computeProjectCost(db, projectId);
    if (cost.actualCost === null) return cost;
    await db.project.update({
        where: { id: projectId },
        data: { actualCost: cost.actualCost, variance: cost.budget === null ? null : cost.budget - cost.actualCost },
    });
    return cost;
}
