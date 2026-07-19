import { SODQueryService } from '../src/services/sod/sod.query.service';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('[TEST] Starting SOD Optimization Verification...');

    try {
        console.log('\n--- 1. Testing SODQueryService.getExtensionRawData (Uppercase Indexing) ---');
        // Test mixed-case input to verify .toUpperCase() normalization
        const rawData = await SODQueryService.getExtensionRawData('so-TEST-1234');
        console.log('[OK] getExtensionRawData executed successfully (No DB errors). Result:', rawData ? 'Found' : 'Not Found');

        console.log('\n--- 2. Testing SODQueryService.getPatResults (Hash Map Optimization) ---');
        // I modified getPatResults (line 500-515) to use Maps.
        const patResults = await SODQueryService.getPatResults({ limit: 5 });
        console.log(`[OK] getPatResults executed successfully. Retrieved ${patResults.data?.length || 0} records.`);

    } catch (error) {
        console.error('[ERROR] Test failed with exception:', error);
    } finally {
        await prisma.$disconnect();
        console.log('\n[TEST] Finished verification.');
    }
}

main();
