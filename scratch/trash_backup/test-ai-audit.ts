process.env.READ_REPLICA_URL = "";
import { prisma } from '../src/lib/prisma';
import { AiAuditService } from '../src/services/inventory/ai-audit.service';

async function main() {
    console.log("=== STARTING AUTOMATED AI AUDIT VALIDATION SCAN ===");
    try {
        const report = await AiAuditService.runSystemAudit();
        console.log("Audit execution successful!");
        console.log("Timestamp:", report.timestamp);
        console.log("Summary:", JSON.stringify(report.summary, null, 2));
        console.log(`Detected Discrepancies Count: ${report.discrepancies.length}`);
        
        if (report.discrepancies.length > 0) {
            console.log("Discrepancies list:");
            for (const d of report.discrepancies) {
                console.log(`- [${d.severity}] ${d.type} on ${d.entityRef}: ${d.details}`);
                console.log(`  Suggested Fix: ${d.suggestedFix}`);
            }
        } else {
            console.log("Clean audit! 0 discrepancies found.");
        }
    } catch (error) {
        console.error("AI Audit execution failed with error:", error);
        process.exit(1);
    }
}

main();
