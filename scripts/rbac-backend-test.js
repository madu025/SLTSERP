/**
 * RBAC Backend API Test Script
 * 
 * Tests API endpoints with different roles to verify:
 * 1. Role-based access control
 * 2. OPMC data scoping
 * 3. Section assignment permissions
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TEST_USERNAME = 'prasad';
const TEST_PASSWORD = 'Admin@123';
const BASE_URL = 'http://localhost:3000';

// Test endpoints with expected behavior
const API_TESTS = [
    // Admin endpoints
    {
        category: 'Admin',
        path: '/api/admin/role-options',
        method: 'GET',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP'],
        description: 'Role options for admin dropdowns'
    },
    {
        category: 'Admin',
        path: '/api/admin/users',
        method: 'GET',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP'],
        description: 'User management list'
    },
    
    // Project endpoints (OPMC-scoped)
    {
        category: 'Projects',
        path: '/api/projects',
        method: 'GET',
        opmcScoped: true,
        description: 'Project list (filtered by OPMC)'
    },
    
    // Service Order endpoints (OPMC-scoped)
    {
        category: 'Service Orders',
        path: '/api/service-orders',
        method: 'GET',
        opmcScoped: true,
        description: 'Service orders list (filtered by OPMC)'
    },
    {
        category: 'Dashboard',
        path: '/api/dashboard/stats',
        method: 'GET',
        opmcScoped: true,
        description: 'Dashboard statistics (filtered by OPMC)'
    },
    
    // Inventory endpoints
    {
        category: 'Inventory',
        path: '/api/inventory/dashboard-kpis',
        method: 'GET',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'STORES_MANAGER', 'STORES_ASSISTANT', 'OSP_MANAGER', 'AREA_MANAGER'],
        description: 'Inventory dashboard KPIs'
    },
    
    // Finance endpoints (OPMC-scoped)
    {
        category: 'Finance',
        path: '/api/finance/wip-revenue',
        method: 'GET',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'OSP_MANAGER'],
        opmcScoped: true,
        description: 'WIP Revenue summary'
    },
    
    // Profile endpoints (all authenticated)
    {
        category: 'Profile',
        path: '/api/profile',
        method: 'GET',
        allowedRoles: ['ALL_AUTHENTICATED'],
        description: 'User profile'
    },
    {
        category: 'Notifications',
        path: '/api/notifications',
        method: 'GET',
        allowedRoles: ['ALL_AUTHENTICATED'],
        description: 'User notifications'
    },
];

// Roles to test
const TEST_ROLES = [
    'SUPER_ADMIN',
    'ADMIN',
    'ASSISTANT_ENGINEER',
    'STORES_MANAGER',
    'FINANCE_MANAGER',
    'OSP_MANAGER',
    'AREA_MANAGER',
    'ENGINEER',
    'PROCUREMENT_OFFICER',
    'OFFICE_ADMIN',
];

async function updatePrasadRole(role) {
    return await prisma.user.update({
        where: { username: TEST_USERNAME },
        data: { role }
    });
}

async function loginViaApi() {
    try {
        const response = await fetch(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: TEST_USERNAME,
                password: TEST_PASSWORD
            })
        });

        if (!response.ok) {
            return { success: false, error: `Login failed: ${response.status}` };
        }

        const data = await response.json();
        
        // Extract token from cookie
        const setCookie = response.headers.get('set-cookie');
        const tokenMatch = setCookie?.match(/token=([^;]+)/);
        const token = tokenMatch ? tokenMatch[1] : null;

        return { success: true, token, user: data.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function testApiEndpoint(token, endpoint) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint.path}`, {
            method: endpoint.method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json().catch(() => null);

        return {
            path: endpoint.path,
            method: endpoint.method,
            status: response.status,
            allowed: response.status !== 401 && response.status !== 403,
            dataSize: data ? (Array.isArray(data.data) ? data.data.length : Object.keys(data).length) : 0
        };
    } catch (error) {
        return {
            path: endpoint.path,
            method: endpoint.method,
            status: 0,
            allowed: false,
            error: error.message
        };
    }
}

async function runRoleTests(role) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing Role: ${role}`);
    console.log('='.repeat(70));
    
    // Update role
    await updatePrasadRole(role);
    
    // Login via API
    const loginResult = await loginViaApi();
    if (!loginResult.success) {
        console.log(`  SKIPPED: ${loginResult.error}`);
        return { role, status: 'SKIPPED', reason: loginResult.error };
    }
    
    console.log(`  Logged in as ${role}`);
    console.log(`  User: ${loginResult.user.name}`);
    
    // Get user details for OPMC/section info
    const user = await prisma.user.findUnique({
        where: { username: TEST_USERNAME },
        include: {
            accessibleOpmcs: { select: { id: true, name: true, rtom: true } },
            sectionAssignments: {
                include: { role: true, section: true }
            }
        }
    });
    
    console.log(`  OPMCs: ${user.accessibleOpmcs.length}`);
    console.log(`  Sections: ${user.sectionAssignments.length}\n`);
    
    // Test each endpoint
    const results = [];
    for (const endpoint of API_TESTS) {
        const result = await testApiEndpoint(loginResult.token, endpoint);
        results.push({ ...endpoint, ...result });
        
        const status = result.allowed ? '✓' : '';
        const dataSize = result.dataSize > 0 ? `(${result.dataSize} items)` : '';
        console.log(`  ${status} ${endpoint.category.padEnd(15)} ${endpoint.method} ${endpoint.path.padEnd(35)} ${result.status} ${dataSize}`);
    }
    
    return {
        role,
        status: 'COMPLETED',
        opmcCount: user.accessibleOpmcs.length,
        sectionCount: user.sectionAssignments.length,
        results
    };
}

async function generateReport(results) {
    console.log(`\n\n${'='.repeat(70)}`);
    console.log('BACKEND RBAC TEST REPORT');
    console.log('='.repeat(70));
    
    const completed = results.filter(r => r.status === 'COMPLETED');
    const skipped = results.filter(r => r.status === 'SKIPPED');
    
    console.log(`\nTotal Roles Tested: ${results.length}`);
    console.log(`Completed: ${completed.length}`);
    console.log(`Skipped: ${skipped.length}`);
    
    // Summary table
    console.log(`\n${'─'.repeat(70)}`);
    console.log('ACCESS SUMMARY BY ROLE');
    console.log('─'.repeat(70));
    
    for (const result of completed) {
        const apiAccess = result.results.filter(r => r.allowed).length;
        const apiTotal = result.results.length;
        
        console.log(`\n${result.role}:`);
        console.log(`  API Endpoints: ${apiAccess}/${apiTotal} accessible`);
        console.log(`  OPMCs: ${result.opmcCount} | Sections: ${result.sectionCount}`);
        
        // Show denied endpoints
        const denied = result.results.filter(r => !r.allowed);
        if (denied.length > 0) {
            console.log(`  Denied:`);
            for (const d of denied) {
                console.log(`    - ${d.path} (${d.status})`);
            }
        }
    }
    
    // Export detailed results
    const reportData = {
        timestamp: new Date().toISOString(),
        totalRoles: results.length,
        completed: completed.length,
        skipped: skipped.length,
        results: completed
    };
    
    const fs = require('fs');
    fs.writeFileSync('rbac-backend-test-report.json', JSON.stringify(reportData, null, 2));
    console.log(`\nDetailed report saved to: rbac-backend-test-report.json`);
}

async function main() {
    console.log('Starting Backend RBAC API Tests...\n');
    console.log(`Test User: ${TEST_USERNAME}`);
    console.log(`Total Roles to Test: ${TEST_ROLES.length}\n`);
    
    const results = [];
    
    for (const role of TEST_ROLES) {
        const result = await runRoleTests(role);
        results.push(result);
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await generateReport(results);
    
    // Restore Prasad to SUPER_ADMIN
    console.log(`\n${'='.repeat(70)}`);
    console.log('Restoring Prasad to SUPER_ADMIN role...');
    await updatePrasadRole('SUPER_ADMIN');
    console.log('Role restored successfully.');
}

main().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
