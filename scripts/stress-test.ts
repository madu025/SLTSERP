import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const prisma = new PrismaClient();
const SECRET_KEY = process.env.JWT_SECRET || 'dev-secret-key-please-change-in-prod';
const key = new TextEncoder().encode(SECRET_KEY);

async function generateToken(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(key);
}

async function runStressTest() {
    console.log('--- Starting Stress Test: 50 Concurrent Users ---');
    try {
        // 1. Get an active SUPER_ADMIN user
        const user = await prisma.user.findFirst({
            where: { role: 'SUPER_ADMIN' },
            select: { id: true, role: true }
        });

        if (!user) {
            console.error('No SUPER_ADMIN user found in the database. Cannot run test.');
            process.exit(1);
        }

        console.log(`Authenticated as User ID: ${user.id} (${user.role})`);
        
        // Generate real JWT token to bypass middleware
        const token = await generateToken({ id: user.id, role: user.role });

        const CONCURRENT_USERS = 50;
        const REQUESTS_PER_USER = 10; // Each user will make 10 requests sequentially
        const ENDPOINT_1 = `http://localhost:3000/api/dashboard/stats?userId=${user.id}`;
        const ENDPOINT_2 = `http://localhost:3000/api/service-orders?rtomId=ALL&filter=pending`;
        
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const results = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTimeMs: 0,
            maxTimeMs: 0,
            minTimeMs: 999999,
        };

        const startTime = Date.now();
        console.log(`Simulating ${CONCURRENT_USERS} concurrent users, each making ${REQUESTS_PER_USER} requests...`);

        // Create 50 concurrent "user" promises
        const userPromises = Array.from({ length: CONCURRENT_USERS }).map(async (_, userIndex) => {
            for (let i = 0; i < REQUESTS_PER_USER; i++) {
                const reqStart = Date.now();
                // Alternate between ENDPOINT_1 and ENDPOINT_2
                const targetEndpoint = i % 2 === 0 ? ENDPOINT_1 : ENDPOINT_2;
                
                try {
                    const response = await fetch(targetEndpoint, { headers });
                    const duration = Date.now() - reqStart;
                    
                    results.totalRequests++;
                    results.totalTimeMs += duration;
                    results.maxTimeMs = Math.max(results.maxTimeMs, duration);
                    results.minTimeMs = Math.min(results.minTimeMs, duration);

                    if (response.ok) {
                        results.successfulRequests++;
                    } else {
                        results.failedRequests++;
                        const errorText = await response.text();
                        console.error(`[User ${userIndex}] Request failed with status: ${response.status} | Body: ${errorText.substring(0, 100)}`);
                    }
                } catch (error: any) {
                    results.totalRequests++;
                    results.failedRequests++;
                    console.error(`[User ${userIndex}] Request threw error:`, error.message);
                }
            }
        });

        // Wait for all users to complete their requests
        await Promise.all(userPromises);

        const totalDuration = Date.now() - startTime;
        console.log('\n--- Stress Test Results ---');
        console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
        console.log(`Total Requests: ${results.totalRequests}`);
        console.log(`Successful Requests: ${results.successfulRequests}`);
        console.log(`Failed Requests: ${results.failedRequests}`);
        console.log(`Average Response Time: ${(results.totalTimeMs / results.totalRequests).toFixed(2)}ms`);
        console.log(`Min Response Time: ${results.minTimeMs}ms`);
        console.log(`Max Response Time: ${results.maxTimeMs}ms`);
        console.log(`Requests per second (RPS): ${(results.totalRequests / (totalDuration / 1000)).toFixed(2)}`);
        
    } catch (e) {
        console.error('Test execution failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

runStressTest();
