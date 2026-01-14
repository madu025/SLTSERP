const http = require('http');

/**
 * SLTS ERP Docker Worker
 * This script runs inside a separate container and triggers the internal 
 * API endpoints to perform sync and automation tasks.
 */

const SECRET = process.env.CRON_SECRET || 'your_secret_here';
const APP_URL = process.env.INTERNAL_APP_URL || 'http://app:3000';

function triggerSync() {
    console.log(`\n[${new Date().toLocaleString()}] Worker: Triggering Background Sync...`);

    // We call the sync-sod endpoint with tasks=daily to handle both 
    // SLT data sync and internal automation (low stock, reminders, etc.)
    const url = `${APP_URL}/api/cron/sync-sod?tasks=daily&secret=${SECRET}`;

    http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log(`[${new Date().toLocaleString()}] Worker: Sync Success (200)`);
                try {
                    const parsed = JSON.parse(data);
                    console.log(` - Stats: `, JSON.stringify(parsed.sync?.stats || 'Done'));
                } catch (e) {
                    console.log(` - Response: Success but not JSON format`);
                }
            } else {
                console.error(`[${new Date().toLocaleString()}] Worker: Sync Failed Status (${res.statusCode})`);
                console.error(` - Error: ${data.substring(0, 200)}`);
            }
        });
    }).on('error', (err) => {
        console.error(`[${new Date().toLocaleString()}] Worker: Request Error:`, err.message);
    });
}

// Startup
console.log("==========================================");
console.log("   SLT ERP BACKGROUND WORKER (DOCKER)    ");
console.log("==========================================");
console.log(`Target: ${APP_URL}`);
console.log(`Schedule: Every 30 minutes (with 30s initial delay)`);

// Wait 30 seconds before the first attempt to ensure 'app' is fully started
// This prevents 'ECONNREFUSED' during initial system boot
setTimeout(() => {
    triggerSync();
    // Schedule every 30 minutes thereafter
    setInterval(triggerSync, 30 * 60 * 1000);
}, 30000);
