process.env.READ_REPLICA_URL = "";
import { prisma } from '../src/lib/prisma';
import { DynamicReportService } from '../src/services/inventory/dynamic-report.service';

async function main() {
    console.log("=== STARTING AUTOMATED DYNAMIC REPORT ENGINE VALIDATION ===");
    try {
        // Test 1: Standard ServiceOrder query
        console.log("\n--- TEST 1: ServiceOrder Standard Report ---");
        const report1 = await DynamicReportService.generateReport({
            entity: 'serviceOrder',
            columns: ['soNum', 'sltsStatus', 'rtom', 'revenueAmount'],
            filters: [
                { field: 'sltsStatus', operator: 'equals', value: 'COMPLETED' }
            ]
        });
        console.log(`Success! Fetched ${report1.rows.length} rows.`);
        if (report1.rows.length > 0) {
            console.log("First row sample:", JSON.stringify(report1.rows[0], null, 2));
        }

        // Test 2: Nested MaterialUsage query
        console.log("\n--- TEST 2: MaterialUsage Nested Filters Report ---");
        const report2 = await DynamicReportService.generateReport({
            entity: 'materialUsage',
            columns: ['serviceOrder.soNum', 'item.code', 'quantity', 'costPrice'],
            filters: [
                { field: 'serviceOrder.sltsStatus', operator: 'equals', value: 'COMPLETED' }
            ]
        });
        console.log(`Success! Fetched ${report2.rows.length} rows.`);
        if (report2.rows.length > 0) {
            console.log("First row sample:", JSON.stringify(report2.rows[0], null, 2));
        }

        // Test 3: Aggregated MaterialUsage SUM query grouped by Item Code
        console.log("\n--- TEST 3: MaterialUsage SUM Aggregation ---");
        const report3 = await DynamicReportService.generateReport({
            entity: 'materialUsage',
            columns: ['item.code'],
            filters: [
                { field: 'serviceOrder.sltsStatus', operator: 'equals', value: 'COMPLETED' }
            ],
            aggregation: {
                groupBy: 'item.code',
                targetField: 'quantity',
                type: 'SUM'
            }
        });
        console.log(`Success! Grouped groups: ${report3.rows.length}`);
        if (report3.rows.length > 0) {
            console.log("Aggregated rows:", JSON.stringify(report3.rows, null, 2));
        }

        // Test 4: Security whitelist validation checks (expected to fail)
        console.log("\n--- TEST 4: Whitelist Violation Handling ---");
        try {
            await DynamicReportService.generateReport({
                entity: 'serviceOrder',
                columns: ['soNum', 'restrictedSecretField'],
                filters: []
            });
            console.error("FAILED: Did not catch forbidden column!");
            process.exit(1);
        } catch (err: any) {
            console.log("Passed! Caught expected validation error:", err.message);
        }

        console.log("\n=== ALL DYNAMIC REPORT VALIDATIONS COMPLETED SUCCESSFULLY ===");
    } catch (error) {
        console.error("Dynamic report execution failed with error:", error);
        process.exit(1);
    }
}

main();
