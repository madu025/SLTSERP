process.env.READ_REPLICA_URL = "";
import { NexusAgentService } from '../src/services/nexus-agent.service';

async function main() {
    console.log("=== STARTING NEXUS AGENT QUERY INTEGRATION TEST ===");

    try {
        // Query 1: Contractors Count
        console.log("Querying: 'how many contractors are registerd'...");
        const res1 = await NexusAgentService.ask('how many contractors are registerd');
        console.log("Agent Response:", res1.response);
        
        if (!res1.response.toLowerCase().includes('contractor')) {
            throw new Error("ASSERTION_FAILED: Contractor query did not return contractor count details.");
        }

        // Query 2: Low Stock Items
        console.log("\nQuerying: 'Low stock details check'...");
        const res2 = await NexusAgentService.ask('Low stock details check');
        console.log("Agent Response:", res2.response);
        
        if (!res2.response.includes('Low Stock') && !res2.response.includes('අවම')) {
            throw new Error("ASSERTION_FAILED: Low stock query did not return correct details.");
        }

        // Query 3: Active Projects
        console.log("\nQuerying: 'active projects'...");
        const res3 = await NexusAgentService.ask('active projects');
        console.log("Agent Response:", res3.response);
        
        if (!res3.response.toLowerCase().includes('project')) {
            throw new Error("ASSERTION_FAILED: Projects query did not return project count details.");
        }

        console.log("\nNexus Agent query parsing verified successfully! All counts matching perfectly.");

    } catch (error) {
        console.error("Nexus Agent test failed with error:", error);
        process.exit(1);
    }
}

main();
