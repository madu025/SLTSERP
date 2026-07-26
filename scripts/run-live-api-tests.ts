import fs from 'fs';
import path from 'path';

// Define the root of our API routes
const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
const baseUrl = 'http://localhost:3000/api';

async function findGetRoutes(dir: string, baseRoute: string = ''): Promise<string[]> {
    let routes: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            routes = routes.concat(await findGetRoutes(fullPath, `${baseRoute}/${entry.name}`));
        } else if (entry.name === 'route.ts') {
            // Check if the route has a GET handler
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('export const GET =') || content.includes('export async function GET')) {
                // If it has dynamic segments (e.g. [id]), skip it for this automated test
                if (!baseRoute.includes('[') && !baseRoute.includes(']')) {
                    routes.push(baseRoute);
                }
            }
        }
    }
    return routes;
}

async function runTests() {
    console.log('🔍 Discovering API GET routes...');
    const routes = await findGetRoutes(apiDir);
    console.log(`Found ${routes.length} static GET routes.`);

    let passed = 0;
    let failed = 0;

    for (const route of routes) {
        const url = `${baseUrl}${route}`;
        try {
            const res = await fetch(url, {
                // Mock an auth header if needed, or rely on it returning 401 Unauthorized
                headers: { 'Cookie': 'next-auth.session-token=mocked-token' }
            });
            
            // 200 OK or 401 Unauthorized are considered passing (since we are unauthenticated/mocked)
            // 500 Internal Server Error is a failure
            if (res.status === 500) {
                console.error(`❌ FAILED (500): ${url}`);
                failed++;
            } else {
                console.log(`✅ PASSED (${res.status}): ${route}`);
                passed++;
            }
        } catch (error: any) {
            console.error(`❌ FAILED (Network/Fetch): ${url} - ${error.message}`);
            failed++;
        }
    }

    console.log('\n--- Test Summary ---');
    console.log(`Total Routes Tested: ${routes.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed (500s): ${failed}`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(console.error);
