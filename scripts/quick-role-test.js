/**
 * Quick Role Switcher for Manual Testing - Updated
 * 
 * Now supports:
 * - Role switching
 * - OPMC assignment switching
 * - Section assignment switching
 * 
 * Usage:
 *   node scripts/quick-role-test.js <command> [options]
 * 
 * Commands:
 *   role <username> <role>          - Change user's role
 *   opmc <username> <scenario>      - Change OPMC assignments
 *   section <username> <scenario>   - Change section assignments
 *   show <username>                 - Show current user config
 *   list                            - List all available roles
 * 
 * Examples:
 *   node scripts/quick-role-test.js role prasad ASSISTANT_ENGINEER
 *   node scripts/quick-role-test.js opmc prasad single
 *   node scripts/quick-role-test.js opmc prasad multiple
 *   node scripts/quick-role-test.js opmc prasad none
 *   node scripts/quick-role-test.js section prasad projects
 *   node scripts/quick-role-test.js show prasad
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ALL_ROLES = [
    'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER',
    'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER',
    'AREA_COORDINATOR', 'QC_OFFICER', 'STORES_MANAGER', 'STORES_ASSISTANT',
    'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'AR_OFFICER',
    'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'SA_MANAGER', 'SA_ASSISTANT',
    'FAULT_COORDINATOR', 'REPAIR_TECHNICIAN', 'SF_AUDIT_MANAGER',
    'SF_AUDIT_OFFICER', 'RATE_AUDITOR', 'PROCUREMENT_OFFICER',
    'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF',
    'OSP_ENGINEER', 'CIVIL_SUPERVISOR', 'CABLE_SPLICER', 'HEAD_OF_SECTION'
];

const OPMC_SCENARIOS = {
    none: { description: 'No OPMC assignments (deny all data)', ids: [] },
    single: { description: 'Single OPMC assignment', ids: 'SINGLE' },
    multiple: { description: 'Multiple OPMC assignments', ids: 'MULTIPLE' },
};

async function getAvailableOpmcs() {
    return await prisma.oPMC.findMany({
        take: 5,
        select: { id: true, name: true, rtom: true }
    });
}

async function getUserSections(username) {
    const user = await prisma.user.findUnique({
        where: { username },
        include: {
            sectionAssignments: {
                include: {
                    section: true,
                    role: true
                }
            }
        }
    });
    return user?.sectionAssignments || [];
}

async function showUserConfig(username) {
    const user = await prisma.user.findUnique({
        where: { username },
        include: {
            accessibleOpmcs: { select: { id: true, name: true, rtom: true } },
            sectionAssignments: {
                include: {
                    section: { select: { name: true } },
                    role: { select: { name: true } }
                }
            }
        }
    });

    if (!user) {
        console.error(`User '${username}' not found.`);
        process.exit(1);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`User Configuration: ${username}`);
    console.log('='.repeat(60));
    console.log(`  Role: ${user.role}`);
    console.log(`  Name: ${user.name || 'N/A'}`);
    console.log(`  Email: ${user.email}`);
    console.log(`\n  OPMC Assignments (${user.accessibleOpmcs.length}):`);
    if (user.accessibleOpmcs.length === 0) {
        console.log(`    [NONE] - No OPMC access (deny all data)`);
    } else {
        for (const opmc of user.accessibleOpmcs) {
            console.log(`    - ${opmc.name} (${opmc.rtom})`);
        }
    }
    console.log(`\n  Section Assignments (${user.sectionAssignments.length}):`);
    if (user.sectionAssignments.length === 0) {
        console.log(`    [NONE] - No section assignments`);
    } else {
        for (const assignment of user.sectionAssignments) {
            console.log(`    - ${assignment.section.name} (${assignment.role.name})`);
        }
    }
    console.log();
}

async function changeRole(username, newRole) {
    if (!ALL_ROLES.includes(newRole)) {
        console.error(`Invalid role: ${newRole}`);
        console.error('Run "list" command to see available roles.');
        process.exit(1);
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
        console.error(`User '${username}' not found.`);
        process.exit(1);
    }

    const oldRole = user.role;
    await prisma.user.update({
        where: { username },
        data: { role: newRole }
    });

    console.log(`\n✓ Role updated successfully!`);
    console.log(`  User: ${username}`);
    console.log(`  Old Role: ${oldRole}`);
    console.log(`  New Role: ${newRole}`);
}

async function changeOpmcAssignment(username, scenario) {
    const opmcs = await getAvailableOpmcs();
    
    if (opmcs.length === 0) {
        console.error('No OPMCs found in database.');
        process.exit(1);
    }

    let ids = [];
    if (scenario === 'single') {
        ids = [opmcs[0].id];
    } else if (scenario === 'multiple') {
        ids = opmcs.slice(0, 3).map(o => o.id);
    }
    // 'none' scenario: ids = []

    await prisma.user.update({
        where: { username },
        data: {
            accessibleOpmcs: {
                set: ids.map(id => ({ id }))
            }
        }
    });

    console.log(`\n✓ OPMC assignments updated!`);
    console.log(`  User: ${username}`);
    console.log(`  Scenario: ${scenario}`);
    console.log(`  Assigned OPMCs: ${ids.length}`);
    if (ids.length > 0) {
        for (const opmc of opmcs.filter(o => ids.includes(o.id))) {
            console.log(`    - ${opmc.name} (${opmc.rtom})`);
        }
    }
}

async function listRoles() {
    console.log('\nAvailable Roles:\n');
    ALL_ROLES.forEach((role, i) => {
        console.log(`  ${(i + 1).toString().padStart(2)}. ${role}`);
    });
    console.log();
}

async function main() {
    const command = process.argv[2];
    const username = process.argv[3] || 'prasad';
    const value = process.argv[4];

    if (!command) {
        console.log('Usage: node scripts/quick-role-test.js <command> [username] [value]\n');
        console.log('Commands:');
        console.log('  role <username> <role>          - Change user\'s role');
        console.log('  opmc <username> <scenario>      - Change OPMC assignments (none/single/multiple)');
        console.log('  section <username> <scenario>   - Change section assignments');
        console.log('  show <username>                 - Show current user configuration');
        console.log('  list                            - List all available roles');
        console.log('\nExamples:');
        console.log('  node scripts/quick-role-test.js role prasad ASSISTANT_ENGINEER');
        console.log('  node scripts/quick-role-test.js opmc prasad single');
        console.log('  node scripts/quick-role-test.js opmc prasad multiple');
        console.log('  node scripts/quick-role-test.js opmc prasad none');
        console.log('  node scripts/quick-role-test.js show prasad');
        console.log('  node scripts/quick-role-test.js list');
        process.exit(0);
    }

    switch (command) {
        case 'role':
            if (!value) {
                console.error('Please specify a role.');
                process.exit(1);
            }
            await changeRole(username, value);
            break;
        
        case 'opmc':
            if (!value || !OPMC_SCENARIOS[value]) {
                console.error('Please specify a scenario: none, single, multiple');
                process.exit(1);
            }
            await changeOpmcAssignment(username, value);
            break;
        
        case 'section':
            console.log('Section assignment switching - coming soon.');
            console.log('Use the admin UI to manage section assignments.');
            break;
        
        case 'show':
            await showUserConfig(username);
            break;
        
        case 'list':
            await listRoles();
            break;
        
        default:
            console.error(`Unknown command: ${command}`);
            process.exit(1);
    }

    console.log('\nNow login at http://localhost:3000/login');
    console.log(`Username: ${username}`);
    console.log('Password: Admin@123\n');
}

main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
});
