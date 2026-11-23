import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { VendorStatementService } from '@/services/finance/vendor-statement.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/vendor-statement                -> every vendor with its balance
// GET /api/finance/vendor-statement?vendorId=<id>   -> one vendor's statement (invoices, payments, debit notes, running balance)
// Vendor balances are company-wide figures, so users limited to specific OPMCs cannot read them.
export const GET = apiHandler(async (req, params) => {
    if (await resolveOpmcScope(params._userId, 'finance') !== undefined) throw AppError.forbidden('Vendor statements need company-wide finance access');
    const vendorId = new URL(req.url).searchParams.get('vendorId');
    if (!vendorId) return VendorStatementService.listBalances();
    const statement = await VendorStatementService.getStatement(vendorId);
    if (!statement) throw AppError.notFound('Vendor not found');
    return statement;
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });
