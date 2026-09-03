/**
 * One-shot manual trigger of CompletedSODSyncService.syncCompletedSODs().
 * Also serves as the backfill run: enriched count reports rows whose missing
 * customer identity was null-filled from the OPMC completed record.
 */
import { CompletedSODSyncService } from '../src/services/service-order/completed-sod-sync.service';

async function main() {
    // Optional arg: custom start date (e.g. 2026-07-01) for history backfill;
    // omit for the default current-month window.
    const customStartDate = process.argv[2];
    const result = await CompletedSODSyncService.syncCompletedSODs(customStartDate);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
