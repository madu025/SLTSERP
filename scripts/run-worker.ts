import { initializeBackgroundWorkers } from '../src/workers/init';

async function main() {
    console.log('[WORKER_RUNNER] Starting SLTSERP Standalone Worker Process...');
    await initializeBackgroundWorkers();
    console.log('[WORKER_RUNNER] Workers initialized and running in background loop. Listening for jobs...');
}

main().catch((err) => {
    console.error('[WORKER_RUNNER] Fatal worker error:', err);
    process.exit(1);
});
