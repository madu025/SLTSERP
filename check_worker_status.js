const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSyncStatus() {
    console.log('--- Checking System Sync Status ---');
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: 'LAST_SYNC_STATS' }
        });

        if (setting) {
            console.log('Last Sync Statistics Found:');
            console.log(JSON.stringify(setting.value, null, 2));

            const lastSyncDate = new Date(setting.value.lastSync);
            const now = new Date();
            const diffMinutes = Math.floor((now - lastSyncDate) / (1000 * 60));

            console.log(`\nLast Sync was ${diffMinutes} minutes ago.`);

            if (diffMinutes > 45) {
                console.warn('WARNING: Last sync was more than 45 minutes ago. Background worker might be STOPPED.');
            } else {
                console.log('SUCCESS: Background worker appears to be RUNNING correctly.');
            }
        } else {
            console.log('No sync statistics found in the database. A sync has likely never completed.');
        }

        // Also check SLTPATStatus recent records
        const recentPat = await prisma.sLTPATStatus.findFirst({
            orderBy: { updatedAt: 'desc' }
        });
        if (recentPat) {
            console.log(`Last SLTPATStatus DB update: ${recentPat.updatedAt.toLocaleString()}`);
        }

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkSyncStatus();
