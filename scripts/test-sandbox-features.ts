import { ForecastService } from '../src/services/inventory/forecast.service';
import { NotificationPolicyService } from '../src/services/notification/notification-policy.service';
import { NexusAgentService } from '../src/services/nexus-agent.service';

async function runTests() {
    console.log("=========================================");
    console.log("   NEXUS ERP AI SANDBOX TEST SUITE");
    console.log("=========================================\n");

    // Test 1: AI Material Forecasting
    console.log("[TEST 1] AI Material Forecasting (1 Month, Target: 500)...");
    try {
        const forecast = await ForecastService.getMaterialForecast({ months: 1, monthlyConnectionTarget: 500 });
        console.log(`Forecast returned ${forecast.length} items with shortages/low stock:`);
        forecast.forEach(item => {
            console.log(` - Code: ${item.itemCode} | Name: ${item.itemName} | Recommended Order: ${item.recommendedQty} ${item.unit} | Cost: LKR ${item.projectedCost.toLocaleString()}`);
        });
    } catch (err) {
        console.error("Test 1 Failed:", err);
    }
    console.log("-----------------------------------------\n");

    // Test 2: Batch Expiry (FEFO) Audits
    console.log("[TEST 2] Running Batch Expiry Audits (FEFO)...");
    try {
        const warnings = await NotificationPolicyService.checkBatchExpirations();
        console.log(`Expiry check returned ${warnings.length} active warnings:`);
        warnings.forEach(w => {
            console.log(` - Batch: ${w.batchNumber} | Item: ${w.itemName} | Store: ${w.storeName} | Qty: ${w.quantity} | Expires: ${w.expiryDate?.toLocaleDateString()}`);
        });
    } catch (err) {
        console.error("Test 2 Failed:", err);
    }
    console.log("-----------------------------------------\n");

    // Test 3: Nexus Agent Conversational Queries
    console.log("[TEST 3] Conversational Nexus Agent Sandbox queries...");
    
    const queries = [
        "low stock materials monawada?",
        "expiring batches thiyeda?",
        "Laptops assign wela thiyenne kataද?",
        "Hello Nexus Agent!"
    ];

    for (const q of queries) {
        console.log(`\nUser: "${q}"`);
        try {
            const reply = await NexusAgentService.ask(q);
            console.log(`Nexus Agent:\n"${reply.response}"`);
            if (reply.actions && reply.actions.length > 0) {
                console.log(`Suggested Actions: ${JSON.stringify(reply.actions, null, 2)}`);
            }
        } catch (err) {
            console.error(`Nexus Agent failed for query "${q}":`, err);
        }
    }
    
    console.log("\n=========================================");
    console.log("         SANDBOX TESTS COMPLETED");
    console.log("=========================================");
}

runTests();
