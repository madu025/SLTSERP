const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const SOD_IDS = [
    '019fdbd5-8802-ee1c-d314-7b9f9c7cc64d',
    '019fdbd5-8802-a2dd-5a1d-ac211e82fccf',
    '019fc81c-4365-b237-4f8c-6adb37bac269',
    '019fd633-7f3f-e626-b185-060b2906e204',
    '019fd6e6-1520-0efb-ad5e-a2adee0cd60e',
    '019fd685-ef10-5276-1712-69711ff837ed',
    '019fdbd5-8802-0a52-683f-040e6e7a5472',
    '019fdbd5-8802-520a-e4a5-5fd06e6c60a3',
    '019fc81c-4361-1a09-e165-45865876483e',
    '019fcb33-5ec8-c24e-68a2-61d5823cc888',
];

async function main() {
    // Find approval instances for our SODs
    const instances = await p.universalApprovalInstance.findMany({
        where: { entityId: { in: SOD_IDS } },
        select: { id: true, entityId: true, status: true, levelIndex: true, level: true, requiredRole: true, policyId: true }
    });
    
    console.log(`Found ${instances.length} approval instances`);
    for (const inst of instances) {
        console.log(`  SOD: ${inst.entityId.substring(0,12)}... | status: ${inst.status} | level: ${inst.levelIndex} | role: ${inst.requiredRole} | level_record: ${inst.level}`);
    }

    // Find admin user to approve as
    const admin = await p.user.findFirst({ where: { username: 'prasad' } });
    if (!admin) {
        console.log('Admin user not found, trying "admin"');
        const admin2 = await p.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
        if (!admin2) throw new Error('No admin user found');
        console.log('Using:', admin2.username, admin2.id);
    }
    const approver = admin || await p.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    console.log(`\nApprover: ${approver.username} (${approver.id}) role: ${approver.role}`);

    // Approve each instance using the advanceGate method via API
    const http = require('http');
    
    function approveInstance(instanceId) {
        return new Promise((resolve, reject) => {
            const payload = JSON.stringify({
                instanceId,
                action: 'APPROVED',
                comments: 'QA Test - PAT Approved',
            });
            
            const req = http.request({
                hostname: 'localhost', port: 3000,
                path: '/api/approval/advance',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                    'x-user-id': approver.id,
                    'x-user-role': approver.role,
                }
            }, res => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(data) });
                    } catch (e) {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    }

    // Approve pending instances
    let approved = 0, failed = 0;
    for (const inst of instances) {
        if (inst.status === 'APPROVED' || inst.status === 'COMPLETED') {
            console.log(`  SOD ${inst.entityId.substring(0,12)} already approved`);
            approved++;
            continue;
        }
        
        console.log(`  Approving SOD ${inst.entityId.substring(0,12)}... (instance ${inst.id.substring(0,12)})`);
        const result = await approveInstance(inst.id);
        
        if (result.status === 200) {
            console.log(`    PASSED`);
            approved++;
        } else {
            console.log(`    FAILED (HTTP ${result.status}): ${JSON.stringify(result.body).substring(0, 200)}`);
            failed++;
        }
    }

    console.log(`\nApproved: ${approved}/${instances.length}, Failed: ${failed}/${instances.length}`);

    // Verify final SOD statuses
    const finalSods = await p.serviceOrder.findMany({
        where: { id: { in: SOD_IDS } },
        select: { soNum: true, sltsStatus: true, completedDate: true }
    });
    
    console.log('\n=== FINAL SOD STATUSES ===');
    for (const s of finalSods) {
        console.log(`${s.soNum} | ${s.sltsStatus} | completed: ${s.completedDate}`);
    }

    await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
