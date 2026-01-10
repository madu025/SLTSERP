import { NotificationService } from '../src/services/notification.service';
import { prisma } from '../src/lib/prisma';

/**
 * Manual Cleanup Script for Notifications
 * Run using: npx ts-node scripts/cleanup-notifications.ts
 */
async function main() {
    console.log('--- Starting Notification Cleanup ---');

    try {
        const days = 30;
        const result = await NotificationService.cleanup(days, true);

        console.log(`Success! Deleted ${result.count} notifications older than ${days} days.`);
    } catch (error) {
        console.error('Cleanup failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
