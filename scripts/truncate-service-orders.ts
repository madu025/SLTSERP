import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function truncateServiceOrders() {
    console.log('🗑️  Truncating ServiceOrder table...');

    try {
        // Delete all service orders
        const result = await prisma.serviceOrder.deleteMany({});

        console.log(`✅ Deleted ${result.count} service orders`);
        console.log('📝 Table is now empty. Sync will create fresh records with sltsStatus = empty (pending)');

    } catch (error) {
        console.error('❌ Error truncating table:', error);
    } finally {
        await prisma.$disconnect();
    }
}

truncateServiceOrders();
