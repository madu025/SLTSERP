import { apiHandler } from '@/lib/api-handler';
import { BankCashService } from '@/services/finance/bank-cash.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { resolveOpmcScope } from '@/lib/opmc-scope';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req, params) => {
    if (await resolveOpmcScope(params._userId) !== undefined) {
        throw AppError.forbidden('Bank reconciliation requires global Finance scope');
    }
    const { searchParams } = new URL(req.url);
    const bankAccountId = searchParams.get('bankAccountId');

    if (!bankAccountId) return { accounts: await BankCashService.getActiveBankAccounts() };

    const summary = await BankCashService.getBankReconciliationSummary(bankAccountId);
    return summary;
}, {
    permissions: [RBAC_PERMISSIONS.FINANCE_READ]
});

export const POST = apiHandler(async (req, params) => {
    if (await resolveOpmcScope(params._userId) !== undefined) {
        throw AppError.forbidden('Bank reconciliation requires global Finance scope');
    }
    const body = await req.json();
    const { statementLineId, journalLineId } = body;

    if (!statementLineId || !journalLineId) {
        throw AppError.badRequest('statementLineId and journalLineId are required');
    }

    const reconciled = await BankCashService.reconcileStatementLine(statementLineId, journalLineId);
    return reconciled;
}, {
    permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE],
    audit: { action: 'RECONCILE', entity: 'BANK_STATEMENT_LINE' }
});
