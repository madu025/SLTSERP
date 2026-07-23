import { apiHandler } from '@/lib/api-handler';
import { BankCashService } from '@/services/finance/bank-cash.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const bankAccountId = searchParams.get('bankAccountId');

    if (!bankAccountId) {
        throw AppError.badRequest('Query parameter bankAccountId is required');
    }

    const summary = await BankCashService.getBankReconciliationSummary(bankAccountId);
    return summary;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT']
});

export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const { statementLineId, journalLineId } = body;

    if (!statementLineId || !journalLineId) {
        throw AppError.badRequest('statementLineId and journalLineId are required');
    }

    const reconciled = await BankCashService.reconcileStatementLine(statementLineId, journalLineId);
    return reconciled;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
});
