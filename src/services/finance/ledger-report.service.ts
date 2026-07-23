import { prisma } from '@/lib/prisma';
import { AccountType } from '@prisma/client';

export interface AccountBalanceSummary {
    code: string;
    name: string;
    type: AccountType;
    isPostable: boolean;
    totalDebit: number;
    totalCredit: number;
    netBalance: number;
}

export interface TrialBalanceReportResult {
    fromDate?: string;
    toDate?: string;
    accounts: AccountBalanceSummary[];
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
    difference: number;
}

export interface PnlReportResult {
    fromDate?: string;
    toDate?: string;
    revenueAccounts: AccountBalanceSummary[];
    expenseAccounts: AccountBalanceSummary[];
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
}

export interface BalanceSheetReportResult {
    asOfDate?: string;
    assetAccounts: AccountBalanceSummary[];
    liabilityAccounts: AccountBalanceSummary[];
    equityAccounts: AccountBalanceSummary[];
    totalAssets: number;
    totalLiabilities: number;
    retainedEarnings: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
    difference: number;
}

export interface CashFlowReportResult {
    fromDate?: string;
    toDate?: string;
    cashAccounts: AccountBalanceSummary[];
    openingCash: number;
    totalInflow: number;
    totalOutflow: number;
    netCashFlow: number;
    closingCash: number;
}

export class LedgerReportService {
    /**
     * Group JournalLines by accountCode and aggregate balances.
     */
    static async getAccountBalances(fromDate?: Date, toDate?: Date): Promise<TrialBalanceReportResult> {
        // Build date filter for JournalEntry
        const dateFilter: any = {};
        if (fromDate) dateFilter.gte = fromDate;
        if (toDate) dateFilter.lte = toDate;

        const entryWhere = {
            ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
            status: { not: 'REVERSED' }
        };

        // Fetch all CoA records for catalog names & types
        const coaList = await prisma.chartOfAccount.findMany({
            orderBy: { code: 'asc' }
        });
        const coaMap = new Map(coaList.map(c => [c.code, c]));

        // Aggregate journal line debits & credits grouped by accountCode
        const lineAggregations = await prisma.journalLine.groupBy({
            by: ['accountCode'],
            _sum: {
                debit: true,
                credit: true
            },
            where: {
                entry: entryWhere
            }
        });

        const aggMap = new Map(lineAggregations.map(a => [
            a.accountCode,
            {
                debit: Number(a._sum.debit || 0),
                credit: Number(a._sum.credit || 0)
            }
        ]));

        let sumTotalDebit = 0;
        let sumTotalCredit = 0;
        const accounts: AccountBalanceSummary[] = [];

        // Build summary for all active accounts with activity or defined in CoA
        for (const coa of coaList) {
            const agg = aggMap.get(coa.code) || { debit: 0, credit: 0 };
            const totalDebit = agg.debit;
            const totalCredit = agg.credit;

            sumTotalDebit += totalDebit;
            sumTotalCredit += totalCredit;

            // Compute net balance based on account type normal balance sign
            let netBalance = 0;
            if (coa.type === AccountType.ASSET || coa.type === AccountType.EXPENSE) {
                netBalance = totalDebit - totalCredit;
            } else {
                netBalance = totalCredit - totalDebit;
            }

            accounts.push({
                code: coa.code,
                name: coa.name,
                type: coa.type,
                isPostable: coa.isPostable,
                totalDebit,
                totalCredit,
                netBalance
            });
        }

        const difference = Math.abs(sumTotalDebit - sumTotalCredit);
        const isBalanced = difference <= 0.01;

        return {
            fromDate: fromDate?.toISOString(),
            toDate: toDate?.toISOString(),
            accounts,
            totalDebit: sumTotalDebit,
            totalCredit: sumTotalCredit,
            isBalanced,
            difference
        };
    }

    /**
     * Profit & Loss (Income Statement) Report
     */
    static async getPnlReport(fromDate?: Date, toDate?: Date): Promise<PnlReportResult> {
        const tb = await this.getAccountBalances(fromDate, toDate);

        const revenueAccounts = tb.accounts.filter(a => a.type === AccountType.REVENUE && (a.totalDebit > 0 || a.totalCredit > 0));
        const expenseAccounts = tb.accounts.filter(a => a.type === AccountType.EXPENSE && (a.totalDebit > 0 || a.totalCredit > 0));

        const totalRevenue = revenueAccounts.reduce((acc, a) => acc + a.netBalance, 0);
        const totalExpense = expenseAccounts.reduce((acc, a) => acc + a.netBalance, 0);
        const netProfit = totalRevenue - totalExpense;

        return {
            fromDate: fromDate?.toISOString(),
            toDate: toDate?.toISOString(),
            revenueAccounts,
            expenseAccounts,
            totalRevenue,
            totalExpense,
            netProfit
        };
    }

    /**
     * Balance Sheet Report (ASSETS = LIABILITIES + EQUITY + Retained Earnings)
     */
    static async getBalanceSheetReport(asOfDate?: Date): Promise<BalanceSheetReportResult> {
        const tb = await this.getAccountBalances(undefined, asOfDate);
        const pnl = await this.getPnlReport(undefined, asOfDate);

        const assetAccounts = tb.accounts.filter(a => a.type === AccountType.ASSET && (a.totalDebit > 0 || a.totalCredit > 0));
        const liabilityAccounts = tb.accounts.filter(a => a.type === AccountType.LIABILITY && (a.totalDebit > 0 || a.totalCredit > 0));
        const equityAccounts = tb.accounts.filter(a => a.type === AccountType.EQUITY && (a.totalDebit > 0 || a.totalCredit > 0));

        const totalAssets = assetAccounts.reduce((acc, a) => acc + a.netBalance, 0);
        const totalLiabilities = liabilityAccounts.reduce((acc, a) => acc + a.netBalance, 0);
        const statedEquity = equityAccounts.reduce((acc, a) => acc + a.netBalance, 0);
        const retainedEarnings = pnl.netProfit;
        const totalEquity = statedEquity + retainedEarnings;
        const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

        const difference = Math.abs(totalAssets - totalLiabilitiesAndEquity);
        const isBalanced = difference <= 0.01;

        return {
            asOfDate: asOfDate?.toISOString(),
            assetAccounts,
            liabilityAccounts,
            equityAccounts,
            totalAssets,
            totalLiabilities,
            retainedEarnings,
            totalEquity,
            totalLiabilitiesAndEquity,
            isBalanced,
            difference
        };
    }

    /**
     * Cash Flow Statement Report (Indirect summary for Bank & Petty Cash accounts)
     */
    static async getCashFlowReport(fromDate?: Date, toDate?: Date): Promise<CashFlowReportResult> {
        const tb = await this.getAccountBalances(fromDate, toDate);

        const cashAccounts = tb.accounts.filter(
            a => a.type === AccountType.ASSET && (a.code.startsWith('BANK') || a.code.startsWith('PETTY'))
        );

        let openingCash = 0;
        if (fromDate) {
            const priorTb = await this.getAccountBalances(undefined, new Date(fromDate.getTime() - 1));
            const priorCashAccounts = priorTb.accounts.filter(
                a => a.type === AccountType.ASSET && (a.code.startsWith('BANK') || a.code.startsWith('PETTY'))
            );
            openingCash = priorCashAccounts.reduce((acc, a) => acc + a.netBalance, 0);
        }

        const totalInflow = cashAccounts.reduce((acc, a) => acc + a.totalDebit, 0);
        const totalOutflow = cashAccounts.reduce((acc, a) => acc + a.totalCredit, 0);
        const netCashFlow = totalInflow - totalOutflow;
        const closingCash = openingCash + netCashFlow;

        return {
            fromDate: fromDate?.toISOString(),
            toDate: toDate?.toISOString(),
            cashAccounts,
            openingCash,
            totalInflow,
            totalOutflow,
            netCashFlow,
            closingCash
        };
    }
}
