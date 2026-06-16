import { ServiceOrderService } from '../src/services/sod.service';
import { prisma } from '../src/lib/prisma';

/**
 * Background Sync Script
 * This script runs indefinitely and syncs all OPMCs every 30 minutes.
 * Usage: npx ts-node scripts/background-sync.ts
 */

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
let lastDailyTaskDate: string | null = null;

async function runSync() {
    console.log(`\n[${new Date().toLocaleString()}] Starting Background Sync...`);

    try {
        const stats = await ServiceOrderService.syncAllOpmcs();

        console.log(`[${new Date().toLocaleString()}] Sync Completed:`);
        console.log(` - Success: ${stats.stats.success}`);
        console.log(` - Failed: ${stats.stats.failed}`);
        console.log(` - Created: ${stats.stats.created}`);
        console.log(` - Updated: ${stats.stats.updated}`);

        // Handle Daily Automation Tasks (Once per day)
        const todayStr = new Date().toDateString();
        if (lastDailyTaskDate !== todayStr) {
            console.log(`[${new Date().toLocaleString()}] Running Daily Automation Tasks...`);
            const { AutomationService } = await import('../src/services/automation.service');
            const autoResults = await AutomationService.runAllDailyTasks();
            lastDailyTaskDate = todayStr;
            console.log(`[${new Date().toLocaleString()}] Daily Tasks Completed successfully.`);
        }

        if (stats.stats.failed > 0) {
            stats.details.filter((d: any) => d.error).forEach((d: any) => {
                console.error(`   - Error in ${d.rtom}: ${d.error}`);
            });
        }
    } catch (error) {
        console.error(`[${new Date().toLocaleString()}] Critical Error during sync:`, error);
    }

    console.log(`Next sync scheduled in 30 minutes...`);
}

async function start() {
    console.log("==========================================");
    console.log("   SLT ERP BACKGROUND SYNC WORKER        ");
    console.log("==========================================");
    console.log(`Sync Interval: 30 Minutes`);
    console.log(`Starting first sync now...\n`);

    // First run
    await runSync();

    // Schedule subsequent runs
    setInterval(runSync, SYNC_INTERVAL_MS);
}

start().catch(err => {
    console.error("Worker failed to start:", err);
    process.exit(1);
});
