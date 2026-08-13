import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inventory/audit-verification
 * Audits and verifies SHA-256 checksums across all InventoryLedger records.
 */
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId') || undefined;
    const itemId = searchParams.get('itemId') || undefined;

    const verificationResult = await AuditLedgerService.verifyLedgerIntegrity(storeId, itemId);

    return {
        success: true,
        data: verificationResult
    };
}, {
    roles: ROLE_GROUPS.STORES_ALL,
    rawResponse: true
});
