/**
 * One-time backfill: capture the raw SLT return reason + comment for every
 * RETURN SOD from the ishamp RETURNED_SLTS mirror (RETURNED_REASON /
 * RETURNED_COMMENT fields), replacing bare classifier categories like "OTHER"
 * with the actual portal explanation (e.g. "OSS DATA ERROR - LEA Changed (HC)").
 *
 * Idempotent: rows already carrying a rich reason are skipped by
 * SODSyncService.syncReturnReasons; re-running updates nothing.
 */
import { SODSyncService } from '../src/services/service-order/sod.sync.service';

async function main() {
    const result = await SODSyncService.syncReturnReasons(99);
    console.log(`Return reason backfill complete: checked ${result.checked}, updated ${result.updated}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    });
