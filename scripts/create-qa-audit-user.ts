/**
 * QA Audit User Provisioning
 * ---------------------------
 * Creates the QA-audit test user:
 *   username : kamal
 *   role     : HEAD_OF_SECTION (read-only reporting role)
 *   scope    : all store/area REPORTS visible; NO store/inventory operational access
 *
 * Access model:
 *  - Sidebar visibility granted via ROLE_GROUPS.SECTION_HEADS in sidebar-menu.ts
 *    (Reports & Analytics submenus + Stock Ledger Cardex only)
 *  - Deliberately NOT in any stores/inventory operational ROLE_GROUPS
 *  - getAccessibleStores() returns an empty set for this user (no assigned
 *    store, no OPMCs, non-admin role)
 *
 * Usage: npx tsx scripts/create-qa-audit-user.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import { UserService } from '../src/services/hr/user.service';

const prisma = new PrismaClient();

const QA_USER = {
    username: 'kamal',
    name: 'Kamal (QA Audit)',
    email: 'kamal.qa@slts.lk',
    role: 'HEAD_OF_SECTION',
    password: 'kamal@slts',
};

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    const existing = await prisma.user.findFirst({
        where: {
            OR: [
                { username: { equals: QA_USER.username, mode: 'insensitive' } },
                { email: { equals: QA_USER.email, mode: 'insensitive' } },
            ],
        },
    });

    if (existing) {
        if (dryRun) {
            console.log(`[DRY-RUN] Would align existing user ${existing.username} (${existing.role}) to ${QA_USER.role}`);
            return;
        }
        // QA audit requirement: existing kamal must be the read-only reporting role
        const updated = await prisma.user.update({
            where: { id: existing.id },
            data: {
                role: 'HEAD_OF_SECTION',
                permissions: JSON.stringify(['dashboard']),
            },
        });
        console.log(`[OK] Existing user aligned: ${updated.username} -> role ${updated.role} (id=${updated.id})`);
        return;
    }

    if (dryRun) {
        console.log('[DRY-RUN] Would create:', JSON.stringify(QA_USER, null, 2));
        return;
    }

    const user = await UserService.createUser(
        {
            username: QA_USER.username,
            name: QA_USER.name,
            email: QA_USER.email,
            role: QA_USER.role,
            password: QA_USER.password,
            status: 'active',
        },
        'system'
    );

    // QA account: direct login (no forced password change), dashboard-only permissions
    await prisma.user.update({
        where: { id: user.id },
        data: {
            mustChangePassword: false,
            permissions: JSON.stringify(['dashboard']),
        },
    });

    console.log(`[OK] QA audit user created: ${QA_USER.username} / role ${QA_USER.role} / id=${user.id}`);
    console.log(`[OK] Temporary password: ${QA_USER.password}`);
}

main()
    .catch((e) => {
        console.error('[FAIL]', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
