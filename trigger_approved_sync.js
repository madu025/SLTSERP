const { ServiceOrderService } = require('./src/services/sod.service');
const { prisma } = require('./src/lib/prisma');

async function triggerSync() {
    console.log('Starting manual trigger of HO Approved Sync...');
    try {
        const stats = await ServiceOrderService.syncHoApprovedResults();
        console.log('Sync completed:', stats);
    } catch (e) {
        console.error('Sync failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

triggerSync();
