import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { SOD_PAT_OK, SOD_READY_STAGES } from '@/lib/sod-approval-rules';
import { narrowScope } from '@/services/service-order/area-overview.service';

const FINISHED = ['COMPLETED', 'INSTALL_CLOSED'] as const;
const TEAM_ROLES = ['AREA_COORDINATOR', 'QC_OFFICER', 'ENGINEER', 'ASSISTANT_ENGINEER'] as const;
const DAY = 86_400_000;

export interface PipelineCounts {
    /** finished, not invoiced, and ... */
    waitingPat: number; noContractor: number; waitingCheck: number; waitingContractor: number; readyToInvoice: number; held: number;
    invoicedThisMonth: number; invoicesInApproval: number; returnedToCheck: number; oldestWaitingCheckDays: number | null;
}
export interface PipelineArea extends PipelineCounts {
    rtom: string; name: string; team: Array<{ id: string; name: string; role: string }>;
    /** Share of the orders that are past the check and the contractor (ready to invoice or held) among all finished orders still to be invoiced. */
    progressPct: number | null;
}
export interface PipelinePerson { id: string; name: string; role: string; email: string | null; lastLoginAt: Date | null; rtoms: string[]; checkedThisMonth: number; invoicedThisMonth: number; waitingNow: number; returnedNow: number }
export interface AreaPipeline {
    month: string; monthNumber: number; year: number; rtom: string;
    areas: PipelineArea[]; people: PipelinePerson[]; totals: PipelineCounts;
}

const empty = (): PipelineCounts => ({ waitingPat: 0, noContractor: 0, waitingCheck: 0, waitingContractor: 0, readyToInvoice: 0, held: 0, invoicedThisMonth: 0, invoicesInApproval: 0, returnedToCheck: 0, oldestWaitingCheckDays: null });
const NOT_READY = { OR: [{ sodApprovalStage: null }, { sodApprovalStage: { notIn: [...SOD_READY_STAGES] } }] };

/**
 * The engineer's view of the whole month-end pipeline of the RTOMs in their area: for each RTOM where the finished orders stand (PAT, the
 * Completed SOD check by the Area Coordinator / QC Officer, the contractor's verification, ready to invoice, invoiced, invoices in approval),
 * who the team of the RTOM is, and what each team member has done this month. Only reads; always limited to the person's own areas.
 */
export class AreaPipelineService {
    static async forUser(userId: string, opts: { month?: number; year?: number; rtom?: string } = {}): Promise<AreaPipeline | null> {
        const allScope = await resolveOpmcScope(userId, 'sod');
        if (allScope === undefined) return null;
        const now = new Date();
        const m = opts.month && opts.month >= 1 && opts.month <= 12 ? opts.month : now.getMonth() + 1;
        const y = opts.year && opts.year >= 2020 && opts.year <= 2100 ? opts.year : now.getFullYear();
        const from = new Date(y, m - 1, 1), to = new Date(y, m, 1);
        const month = from.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        const scope = await narrowScope(allScope, opts.rtom);
        const which = { month, monthNumber: m, year: y, rtom: scope.length === 1 && allScope.length > 1 ? (opts.rtom ?? 'ALL') : 'ALL' };
        if (scope.length === 0) return { ...which, areas: [], people: [], totals: empty() };

        const base = { opmcId: { in: scope }, status: { in: [...FINISHED] }, invoiced: false };
        const by = (where: object) => prisma.serviceOrder.groupBy({ by: ['opmcId'], where: where as never, _count: { _all: true } });
        const [areas, waitingPat, noContractor, waitingCheck, waitingContractor, readyToInvoice, held, invoiced, returned, oldest, invoices, team] = await Promise.all([
            prisma.oPMC.findMany({ where: { id: { in: scope } }, select: { id: true, rtom: true, name: true }, orderBy: { rtom: 'asc' } }),
            by({ ...base, contractorId: { not: null }, NOT: SOD_PAT_OK }),
            by({ ...base, contractorId: null }),
            by({ ...base, contractorId: { not: null }, AND: [SOD_PAT_OK, NOT_READY] }),
            by({ ...base, sodApprovalStage: { in: [...SOD_READY_STAGES] }, contractorVerifiedAt: null }),
            by({ ...base, sodApprovalStage: { in: [...SOD_READY_STAGES] }, contractorVerifiedAt: { not: null }, invoicingHeldAt: null }),
            by({ ...base, sodApprovalStage: { in: [...SOD_READY_STAGES] }, invoicingHeldAt: { not: null } }),
            by({ opmcId: { in: scope }, invoiced: true, invoice: { is: { month: m, year: y } } }),
            by({ ...base, AND: [NOT_READY], sodReturnNote: { not: null } }),
            prisma.serviceOrder.groupBy({ by: ['opmcId'], where: { ...base, contractorId: { not: null }, AND: [SOD_PAT_OK, NOT_READY] }, _min: { completedDate: true } }),
            prisma.invoice.groupBy({ by: ['opmcId'], where: { opmcId: { in: scope }, confirmStage: { notIn: ['CONFIRMED', 'CANCELLED'] }, status: { not: 'CANCELLED' } }, _count: { _all: true } }),
            prisma.user.findMany({
                where: { status: 'active', role: { in: [...TEAM_ROLES] }, accessibleOpmcs: { some: { id: { in: scope } } } },
                select: { id: true, name: true, role: true, email: true, lastLoginAt: true, accessibleOpmcs: { where: { id: { in: scope } }, select: { id: true, rtom: true } } },
                orderBy: { name: 'asc' },
            }),
        ]);
        const pick = (rows: Array<{ opmcId: string | null; _count: { _all: number } }>) => new Map(rows.map((r) => [r.opmcId ?? '', r._count._all]));
        const [cPat, cNoC, cChk, cCon, cRdy, cHeld, cInv, cRet, cApp] = [waitingPat, noContractor, waitingCheck, waitingContractor, readyToInvoice, held, invoiced, returned, invoices].map((r) => pick(r as never));
        const oldestBy = new Map(oldest.map((r) => [r.opmcId ?? '', r._min.completedDate]));

        const rows: PipelineArea[] = areas.map((a) => {
            const c: PipelineCounts = {
                waitingPat: cPat.get(a.id) ?? 0, noContractor: cNoC.get(a.id) ?? 0, waitingCheck: cChk.get(a.id) ?? 0, waitingContractor: cCon.get(a.id) ?? 0,
                readyToInvoice: cRdy.get(a.id) ?? 0, held: cHeld.get(a.id) ?? 0, invoicedThisMonth: cInv.get(a.id) ?? 0, invoicesInApproval: cApp.get(a.id) ?? 0,
                returnedToCheck: cRet.get(a.id) ?? 0, oldestWaitingCheckDays: oldestBy.get(a.id) ? Math.max(0, Math.floor((Date.now() - (oldestBy.get(a.id) as Date).getTime()) / DAY)) : null,
            };
            const total = c.waitingPat + c.noContractor + c.waitingCheck + c.waitingContractor + c.readyToInvoice + c.held;
            return {
                rtom: a.rtom, name: a.name, ...c,
                team: team.filter((t) => t.accessibleOpmcs.some((o) => o.id === a.id)).map((t) => ({ id: t.id, name: t.name ?? '-', role: String(t.role) })),
                progressPct: total === 0 ? null : Math.round(((c.readyToInvoice + c.held) / total) * 100),
            };
        });

        // what each Area Coordinator / QC Officer did this month, and what waits in their RTOMs now
        const rtomIdByName = new Map(areas.map((a) => [a.rtom, a.id]));
        const done = await prisma.sodApproval.groupBy({ by: ['userId'], where: { userId: { in: team.map((t) => t.id) }, action: 'CONFIRMED', createdAt: { gte: from, lt: to } }, _count: { _all: true } });
        const doneBy = new Map(done.map((d) => [d.userId, d._count._all]));
        // orders each Engineer put on an invoice this month (the invoicing step writes one audit row per order)
        const invoicedRows = await prisma.auditLog.groupBy({ by: ['userId'], where: { userId: { in: team.map((t) => t.id) }, action: 'SOD_INVOICED', createdAt: { gte: from, lt: to } }, _count: { _all: true } });
        const invoicedBy = new Map(invoicedRows.map((d) => [d.userId ?? '', d._count._all]));
        const people: PipelinePerson[] = team.map((t) => {
            const ids = t.accessibleOpmcs.map((o) => o.id);
            const sum = (mp: Map<string, number>) => ids.reduce((x, id) => x + (mp.get(id) ?? 0), 0);
            return { id: t.id, name: t.name ?? '-', role: String(t.role), email: t.email ?? null, lastLoginAt: t.lastLoginAt ?? null, rtoms: t.accessibleOpmcs.map((o) => o.rtom).sort(), checkedThisMonth: doneBy.get(t.id) ?? 0, invoicedThisMonth: invoicedBy.get(t.id) ?? 0, waitingNow: sum(cChk), returnedNow: sum(cRet) };
        });
        void rtomIdByName;

        const totals = rows.reduce<PipelineCounts>((a, r) => ({
            waitingPat: a.waitingPat + r.waitingPat, noContractor: a.noContractor + r.noContractor, waitingCheck: a.waitingCheck + r.waitingCheck, waitingContractor: a.waitingContractor + r.waitingContractor,
            readyToInvoice: a.readyToInvoice + r.readyToInvoice, held: a.held + r.held, invoicedThisMonth: a.invoicedThisMonth + r.invoicedThisMonth, invoicesInApproval: a.invoicesInApproval + r.invoicesInApproval,
            returnedToCheck: a.returnedToCheck + r.returnedToCheck,
            oldestWaitingCheckDays: r.oldestWaitingCheckDays === null ? a.oldestWaitingCheckDays : Math.max(a.oldestWaitingCheckDays ?? 0, r.oldestWaitingCheckDays),
        }), empty());
        return { ...which, areas: rows, people, totals };
    }
}
