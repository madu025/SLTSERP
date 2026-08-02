import { NexusAgentService } from './src/services/ai/nexus-agent.service';
import { primaryClient as prisma } from './src/lib/prisma';
import dotenv from 'dotenv';

dotenv.config();

async function testAgent() {
    try {
        console.log("Fetching a valid User ID...");
        const user = await prisma.user.findFirst({
            where: { role: 'SUPER_ADMIN' }
        });

        if (!user) {
            console.error("No SUPER_ADMIN user found in database for testing.");
            process.exit(1);
        }

        console.log(`Testing with User: ${user.name} (${user.id})`);

        const queries = [
            "Show me the daily progress bar chart for R-MD OPMC including completed, in hand and today's SOD"
        ];

        for (const query of queries) {
            console.log(`\n======================================`);
            console.log(`🗣️ Query: "${query}"`);
            console.log(`======================================\n`);
            
            console.log("⏳ Waiting for Nexus Agent response (Function Calling)...");
            const result = await NexusAgentService.ask(query, user.id);
            
            console.log(`\n✅ Intent Triggered: ${result.intent}`);
            console.log(`\n💬 Response:\n${result.response}`);
            if (result?.actions?.length) {
                console.log(`\n⚡ Recommended Actions:`, JSON.stringify(result.actions, null, 2));
            }
            if (result?.chart) {
                console.log(`\n📊 Chart Generated:`, JSON.stringify(result.chart, null, 2));
            }
        }
        
    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testAgent();
