import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { SystemMonitoringService } from '@/services/admin/system-monitoring.service';

export const dynamic = 'force-dynamic';

// GET /api/admin/monitoring/audit-ledger - Run SHA-256 Checksum Security Verification
export const GET = apiHandler(async () => {
    return await SystemMonitoringService.runLedgerSecurityAudit();
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'VERIFY_LEDGER_SHA256_INTEGRITY', entity: 'InventoryLedger' }
});
