import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { DAY_MS, isBackdated, type FinanceControlsReport } from '@/lib/control-shared';

const CHAIN_LIMIT = 5000;

/**
 * Month-end and posting discipline for finance reviewers: back-dated postings, reversals, entries without a dimension,
 * the bank-reconciliation backlog, which periods are still open, and an integrity check of the journal hash chain.
 * Read only. The hash check recomputes the same digest the ledger writes, so a break means a stored entry or its lines
 * no longer match what was posted, or that two entries were posted at the same instant (the chain reads the latest
 * entry by time), which is why a break is reported for review and not as proof of tampering.
 */
export class FinanceControlsService {
    static async getReport(days = 30, now = new Date()): Promise<FinanceControlsReport> {
        const since = new Date(now.getTime() - days * DAY_MS);

        const recent = await prisma.journalEntry.findMany({
            where: { createdAt: { gte: since }, status: { in: ['POSTED', 'REVERSED'] } },
            select: { id: true, date: true, createdAt: true, referenceType: true, reversalOfId: true, opmcId: true, projectId: true },
            take: 20000,
        });
        const backdatedRows = recent.filter((e) => isBackdated(e.date, e.createdAt));
        let backdatedAmount = 0;
        if (backdatedRows.length > 0) {
            const sums = await prisma.journalLine.groupBy({ by: ['entryId'], where: { entryId: { in: backdatedRows.slice(0, 2000).map((e) => e.id) } }, _sum: { debit: true } });
            backdatedAmount = sums.reduce((a, s) => a + Number(s._sum.debit ?? 0), 0);
        }
        const reversal = new Map<string, number>();
        for (const e of recent) {
            if (e.reversalOfId || (e.referenceType ?? '').startsWith('REVERSAL')) {
                const key = e.referenceType ?? 'REVERSAL';
                reversal.set(key, (reversal.get(key) ?? 0) + 1);
            }
        }

        const pending = await prisma.journalEntry.aggregate({ where: { status: { in: ['DRAFT', 'PENDING_APPROVAL'] } }, _count: { _all: true }, _min: { createdAt: true } });

        const lines = await prisma.bankStatementLine.findMany({ where: { isReconciled: false }, select: { statementDate: true }, take: 20000 });
        const buckets = [{ bucket: '0-30 d', count: 0 }, { bucket: '31-60 d', count: 0 }, { bucket: '61-90 d', count: 0 }, { bucket: '90+ d', count: 0 }];
        for (const l of lines) {
            const d = Math.floor((now.getTime() - l.statementDate.getTime()) / DAY_MS);
            buckets[d <= 30 ? 0 : d <= 60 ? 1 : d <= 90 ? 2 : 3].count++;
        }

        const periods = await prisma.fiscalPeriod.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 14 });
        const thisMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
        const openPast = periods.filter((p) => p.status === 'OPEN' && p.year * 12 + (p.month - 1) < thisMonth - 1).length;

        return {
            asOf: now.toISOString(),
            days,
            backdated: {
                count: backdatedRows.length,
                amount: backdatedAmount,
                sample: backdatedRows.slice(0, 8).map((e) => ({ reference: `${e.referenceType ?? 'ENTRY'} ${e.id.slice(0, 8)}`, date: e.date.toISOString().slice(0, 10), enteredAt: e.createdAt.toISOString().slice(0, 10) })),
            },
            reversals: { total: [...reversal.values()].reduce((a, b) => a + b, 0), byReference: [...reversal.entries()].map(([reference, count]) => ({ reference, count })).sort((a, b) => b.count - a.count) },
            withoutDimension: recent.filter((e) => !e.opmcId && !e.projectId).length,
            pendingJournals: { count: pending._count._all, oldestDays: pending._min.createdAt ? Math.floor((now.getTime() - pending._min.createdAt.getTime()) / DAY_MS) : null },
            bankBacklog: { buckets, total: lines.length },
            periods: periods.map((p) => ({ year: p.year, month: p.month, status: p.status, closedAt: p.closedAt ? p.closedAt.toISOString() : null })),
            openPastPeriods: openPast,
            hashChain: await this.verifyChain(),
        };
    }

    /** Recompute the digest of the latest entries in the order they were posted and report the first mismatch. */
    static async verifyChain(): Promise<FinanceControlsReport['hashChain']> {
        const entries = await prisma.journalEntry.findMany({
            where: { sha256Hash: { not: null } },
            orderBy: { createdAt: 'desc' },
            take: CHAIN_LIMIT + 1,
            select: { id: true, idempotencyKey: true, referenceId: true, sha256Hash: true, createdAt: true },
        });
        if (entries.length < 2) return { checked: 0, breaks: 0, firstBreak: null };
        const ordered = entries.reverse(); // oldest first; the first one only supplies the previous hash
        const sums = await prisma.journalLine.groupBy({ by: ['entryId'], where: { entryId: { in: ordered.map((e) => e.id) } }, _sum: { debit: true, credit: true } });
        const total = new Map(sums.map((s) => [s.entryId, { debit: Number(s._sum.debit ?? 0), credit: Number(s._sum.credit ?? 0) }]));

        let breaks = 0;
        let firstBreak: string | null = null;
        for (let i = 1; i < ordered.length; i++) {
            const e = ordered[i];
            const t = total.get(e.id) ?? { debit: 0, credit: 0 };
            const expected = crypto.createHash('sha256').update(`${e.idempotencyKey || ''}:${e.referenceId || ''}:${t.debit}:${t.credit}:${ordered[i - 1].sha256Hash}`).digest('hex');
            if (expected !== e.sha256Hash) {
                breaks++;
                firstBreak ??= `${e.id.slice(0, 8)} (${e.createdAt.toISOString().slice(0, 10)})`;
            }
        }
        return { checked: ordered.length - 1, breaks, firstBreak };
    }
}
