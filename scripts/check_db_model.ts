import { prisma } from '../src/lib/prisma';

async function test() {
    try {
        const count = await (prisma as any).extensionRawData.count();
        console.log('Successfully connected to extensionRawData. Current count:', count);
    } catch (error) {
        console.error('Error accessing extensionRawData:', error);
    } finally {
        process.exit(0);
    }
}

test();
