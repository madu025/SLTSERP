import { prisma } from '@/lib/prisma';
import { ACCOUNTS } from './account-codes';
import { LedgerReportService } from './ledger-report.service';
import { ArApService } from './ar-ap.service';

export type LiabilityCategory = 'TRADE_PAYABLES' | 'RETENTION' | 'TAXES' | 'INTERCOMPANY' | 'OTHER';

export interface LiabilityAccountLine {
    code: string;
    name: string;
    balance: number;
}

export interface LiabilityGroup {
    category: LiabilityCategory;
    label: string;
    total: number;
    accounts: LiabilityAccountLine[];
}

export interface LiabilitiesSchedule {
    asOf: string;
    groups: LiabilityGroup[];
    totalLiabilities: number;
    /** Sub-ledger cross-checks: where a document-level total exists it is compared with the ledger. */
    reconciliation: {
        contractorPayablesSubLedger: number;
        contractorPayablesLedger: number;
        contractorPayablesDifference: number;
        retentionHeldSubLedger: number;
        retentionLedger: number;
        retentionDifference: number;
    };
    note: string;
}

const CATEGORY_OF: Record<string, LiabilityCategory> = {
    [ACCOUNTS.AP_ACCRUED]: 'TRADE_PAYABLES',
    [ACCOUNTS.AP_VENDOR]: 'TRADE_PAYABLES',
    [ACCOUNTS.AP_CONTRACTOR]: 'TRADE_PAYABLES',
    [ACCOUNTS.RETENTION_PAYABLE]: 'RETENTION',
    [ACCOUNTS.VAT_PAYABLE]: 'TAXES',
    [ACCOUNTS.SSCL_PAYABLE]: 'TAXES',
    [ACCOUNTS.WHT_PAYABLE]: 'TAXES',
    [ACCOUNTS.HO_CLEARING]: 'INTERCOMPANY',
    [ACCOUNTS.HO_CLEARING_LEGACY]: 'INTERCOMPANY',
};

const LABELS: Record<LiabilityCategory, string> = {
    TRADE_PAYABLES: 'Trade & contractor payables',
    RETENTION: 'Retention payable',
    TAXES: 'Taxes payable (VAT, SSCL, WHT)',
    INTERCOMPANY: 'Head office / inter-company',
    OTHER: 'Other liabilities',
};

const ORDER: LiabilityCategory[] = ['TRADE_PAYABLES', 'RETENTION', 'TAXES', 'INTERCOMPANY', 'OTHER'];

export function categoriseLiability(code: string): LiabilityCategory {
    return CATEGORY_OF[code] ?? 'OTHER';
}

/** Group liability account balances into the management categories, dropping zero balances. */
export function groupLiabilities(accounts: { code: string; name: string; balance: number }[]): { groups: LiabilityGroup[]; total: number } {
    const buckets = new Map<LiabilityCategory, LiabilityAccountLine[]>();
    for (const a of accounts) {
        if (Math.abs(a.balance) < 0.005) continue;
        const cat = categoriseLiability(a.code);
        buckets.set(cat, [...(buckets.get(cat) ?? []), { code: a.code, name: a.name, balance: a.balance }]);
    }
    const groups = ORDER.filter((c) => buckets.has(c)).map((category) => {
        const lines = buckets.get(category)!.sort((x, y) => y.balance - x.balance);
        return { category, label: LABELS[category], total: lines.reduce((s, l) => s + l.balance, 0), accounts: lines };
    });
    return { groups, total: groups.reduce((s, g) => s + g.total, 0) };
}

/**
 * Everything the company owes, from the ledger, grouped for management, with sub-ledger cross-checks.
 * Company-wide figures: the route restricts it to users with company-wide access.
 */
export class LiabilitiesScheduleService {
    static async getSchedule(asOf: Date = new Date()): Promise<LiabilitiesSchedule> {
        const tb = await LedgerReportService.getAccountBalances(undefined, asOf);
        const liabilities = tb.accounts
            .filter((a) => a.type === 'LIABILITY')
            .map((a) => ({ code: a.code, name: a.name, balance: a.netBalance }));
        const { groups, total } = groupLiabilities(liabilities);

        const ledgerOf = (codes: string[]) => liabilities.filter((a) => codes.includes(a.code)).reduce((s, a) => s + a.balance, 0);
        const [ap, retention] = await Promise.all([
            ArApService.getApAgingReport(null, { unscoped: true }),
            prisma.projectRetention.aggregate({ where: { status: { notIn: ['RELEASED', 'CANCELLED'] } }, _sum: { balanceAmount: true } }),
        ]);

        const contractorLedger = ledgerOf([ACCOUNTS.AP_CONTRACTOR, ACCOUNTS.AP_VENDOR, ACCOUNTS.AP_ACCRUED]);
        const retentionLedger = ledgerOf([ACCOUNTS.RETENTION_PAYABLE]);
        const retentionSub = Number(retention._sum.balanceAmount ?? 0);

        return {
            asOf: asOf.toISOString(),
            groups,
            totalLiabilities: total,
            reconciliation: {
                contractorPayablesSubLedger: ap.summary.total,
                contractorPayablesLedger: contractorLedger,
                contractorPayablesDifference: contractorLedger - ap.summary.total,
                retentionHeldSubLedger: retentionSub,
                retentionLedger,
                retentionDifference: retentionLedger - retentionSub,
            },
            note: 'Ledger balances of all liability accounts. A non-zero difference in the cross-checks means the sub-ledger (invoices, retention records) and the general ledger have drifted and should be investigated.',
        };
    }
}
