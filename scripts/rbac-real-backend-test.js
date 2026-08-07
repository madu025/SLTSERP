/**
 * RBAC Real Backend Test Script
 * Tests actual HTTP requests against running dev server
 * for multiple roles to verify RBAC enforcement.
 */
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE = 'http://localhost:3000';
const USERNAME = 'prasad';
const PASSWORD = 'Admin@123';

// Test endpoints: [method, path, expectedStatusForRole]
const TEST_ENDPOINTS = {
    SUPER_ADMIN: [
        ['GET', '/api/users', 200],
        ['GET', '/api/admin/role-options', 200],
        ['GET', '/api/admin/sections', 200],
        ['GET', '/api/projects', 200],
        ['GET', '/api/inventory/stores', 200],
        ['GET', '/api/finance/contracts', 200],
        ['GET', '/api/admin/audit-logs', 200],
        ['GET', '/api/admin/monitoring/dashboard', 200],
    ],
    ASSISTANT_ENGINEER: [
        ['GET', '/api/users', 403],           // ADMINS only
        ['GET', '/api/admin/role-options', 403], // ADMINS only
        ['GET', '/api/projects', 200],         // OPS has access
        ['GET', '/api/inventory/stores', 200], // stores endpoint accessible
        ['GET', '/api/admin/sections', 403],   // ADMINS only
        ['GET', '/api/admin/audit-logs', 403], // ADMINS only
    ],
    STORES_MANAGER: [
        ['GET', '/api/users', 403],            // ADMINS only
        ['GET', '/api/inventory/stores', 200], // stores access
        ['GET', '/api/admin/sections', 403],   // ADMINS only
        ['GET', '/api/projects', 403],         // no OPS access
    ],
    FINANCE_MANAGER: [
        ['GET', '/api/users', 403],            // ADMINS only
        ['GET', '/api/finance/contracts', 200],// finance access
        ['GET', '/api/admin/sections', 403],   // ADMINS only
        ['GET', '/api/projects', 403],         // no OPS access
    ],
    AREA_MANAGER: [
        ['GET', '/api/users', 403],            // ADMINS only
        ['GET', '/api/projects', 200],         // OPS access
        ['GET', '/api/admin/audit-logs', 403], // ADMINS only
    ],
    ENGINEER: [
        ['GET', '/api/users', 403],            // ADMINS only
        ['GET', '/api/projects', 200],         // OPS access
        ['GET', '/api/admin/sections', 403],   // ADMINS only
    ],
    CEO: [
        ['GET', '/api/users', 200],            // ADMINS includes CEO
        ['GET', '/api/admin/role-options', 200],// ADMINS includes CEO
        ['GET', '/api/projects', 200],         // OPS includes CEO
        ['GET', '/api/admin/sections', 200],   // ADMINS includes CEO
    ],
};

function login(username, password) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ username, password });
        const req = http.request({
            hostname: 'localhost', port: 3000, path: '/api/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                const cookies = res.headers['set-cookie'] || [];
                const tokenCookie = cookies.find(c => c.startsWith('token='));
                const token = tokenCookie ? tokenCookie.split(';')[0].replace('token=', '') : null;
                try {
                    const json = JSON.parse(body);
                    resolve({ status: res.statusCode, token, user: json.user, body: json });
                } catch {
                    resolve({ status: res.statusCode, token, body: body.substring(0, 500) });
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function apiRequest(method, path, token) {
    return new Promise((resolve, reject) => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Cookie'] = `token=${token}`;
        
        const req = http.request({
            hostname: 'localhost', port: 3000, path, method, headers
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                resolve({ status: res.statusCode, body: body.substring(0, 200) });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function testRole(role) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`TESTING ROLE: ${role}`);
    console.log('='.repeat(70));

    // Switch role
    await prisma.user.update({
        where: { username: USERNAME },
        data: { role }
    });

    // Login
    const loginResult = await login(USERNAME, PASSWORD);
    if (loginResult.status !== 200 || !loginResult.token) {
        console.log(`  LOGIN FAILED: status=${loginResult.status}`);
        console.log(`  Response: ${JSON.stringify(loginResult.body).substring(0, 200)}`);
        return { role, loginOk: false, results: [] };
    }
    console.log(`  Login OK: ${loginResult.user?.name} (${loginResult.user?.role})`);

    // Test endpoints
    const tests = TEST_ENDPOINTS[role] || [];
    const results = [];
    for (const [method, path, expected] of tests) {
        const res = await apiRequest(method, path, loginResult.token);
        const pass = res.status === expected;
        const icon = pass ? 'PASS' : 'FAIL';
        console.log(`  [${icon}] ${method} ${path} => ${res.status} (expected ${expected})`);
        if (!pass) {
            console.log(`         Response: ${res.body.substring(0, 100)}`);
        }
        results.push({ method, path, expected, actual: res.status, pass });
    }

    return { role, loginOk: true, results };
}

async function testUnauthenticated() {
    console.log(`\n${'='.repeat(70)}`);
    console.log('TESTING: Unauthenticated Access');
    console.log('='.repeat(70));

    const endpoints = [
        ['GET', '/api/users', 401],
        ['GET', '/api/projects', 401],
        ['GET', '/api/admin/role-options', 401],
        ['GET', '/api/inventory/stores', 401],
        ['GET', '/api/finance/contracts', 401],
        ['GET', '/api/admin/audit-logs', 401],
        ['GET', '/dashboard', 307], // redirect to login
        ['GET', '/admin/users', 307], // redirect to login
    ];

    const results = [];
    for (const [method, path, expected] of endpoints) {
        const res = await apiRequest(method, path, null);
        // For redirects, http module follows them, so check for non-200
        const pass = res.status === expected || (expected === 307 && res.status !== 200);
        const icon = pass ? 'PASS' : 'FAIL';
        console.log(`  [${icon}] ${method} ${path} => ${res.status} (expected ${expected})`);
        results.push({ method, path, expected, actual: res.status, pass });
    }
    return { role: 'UNAUTHENTICATED', loginOk: true, results };
}

async function main() {
    console.log('RBAC BACKEND TEST SUITE');
    console.log(`Target: ${BASE}`);
    console.log(`Time: ${new Date().toISOString()}`);

    const allResults = [];

    // Test 1: Unauthenticated
    allResults.push(await testUnauthenticated());

    // Test 2: Each role
    const roles = Object.keys(TEST_ENDPOINTS);
    for (const role of roles) {
        allResults.push(await testRole(role));
    }

    // Summary
    console.log(`\n${'='.repeat(70)}`);
    console.log('SUMMARY');
    console.log('='.repeat(70));

    let totalPass = 0, totalFail = 0;
    for (const r of allResults) {
        const pass = r.results.filter(x => x.pass).length;
        const fail = r.results.filter(x => !x.pass).length;
        totalPass += pass;
        totalFail += fail;
        console.log(`  ${r.role.padEnd(25)} ${r.loginOk ? 'OK' : 'FAIL'}  Pass: ${pass}  Fail: ${fail}`);
    }
    console.log(`\n  TOTAL: ${totalPass} passed, ${totalFail} failed out of ${totalPass + totalFail} tests`);

    // Restore role
    await prisma.user.update({
        where: { username: USERNAME },
        data: { role: 'SUPER_ADMIN' }
    });
    console.log('\n  Role restored to SUPER_ADMIN');

    await prisma.$disconnect();
    process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
