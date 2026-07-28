import { apiHandler } from '@/lib/api-handler';
import { BankCashService } from '@/services/finance/bank-cash.service';
import { ACCOUNTS } from '@/services/finance/account-codes';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const glAccountCode = searchParams.get('accountCode') || ACCOUNTS.BANK;
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    const fromDate = fromStr ? new Date(fromStr) : undefined;
    const toDate = toStr ? new Date(toStr) : undefined;

    const report = await BankCashService.getCashBook(glAccountCode, fromDate, toDate);
    return report;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT']
});
