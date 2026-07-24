import { apiHandler } from '@/lib/api-handler';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';
import { NextResponse } from 'next/server';

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

    return NextResponse.json({
        success: true,
        data: verificationResult
    });
});
