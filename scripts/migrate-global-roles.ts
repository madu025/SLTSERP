import { PrismaClient } from '@prisma/client';
import { DEFAULT_ROLE_PERMISSIONS, SECTION_MAPPING } from '../src/config/auth-defaults';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting migration: DEFAULT_ROLE_PERMISSIONS → SystemRole...\n');

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Process each role in DEFAULT_ROLE_PERMISSIONS
    for (const [roleCode, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        const sections = SECTION_MAPPING[roleCode];
        
        if (!sections || sections.length === 0) {
            console.log(`⚠️  No section mapping for ${roleCode} — skipping`);
            skippedCount++;
            continue;
        }

        // For SUPER_ADMIN/ADMIN, create one role with all sections access
        // For others, create per-section roles
        if (roleCode === 'SUPER_ADMIN' || roleCode === 'ADMIN') {
            // Create a single SystemRole for SUPER_ADMIN/ADMIN
            const systemRoleCode = `${roleCode}_GLOBAL`;
            const existingRole = await prisma.systemRole.findUnique({
                where: { code: systemRoleCode }
            });

            if (existingRole) {
                // Update permissions if role exists
                await prisma.systemRole.update({
                    where: { code: systemRoleCode },
                    data: { permissions: JSON.stringify(permissions) }
                });
                console.log(`✅ Updated ${systemRoleCode} permissions`);
                updatedCount++;
            } else {
                // Create new role (no section — global admin role)
                await prisma.systemRole.create({
                    data: {
                        name: roleCode.replace(/_/g, ' '),
                        code: systemRoleCode,
                        sectionId: null, // Global role, not tied to a section
                        permissions: JSON.stringify(permissions),
                        level: 4 // Manager level
                    }
                });
                console.log(`✅ Created ${systemRoleCode} (global admin role)`);
                createdCount++;
            }
        } else {
            // For regular roles, create per-section roles
            for (const sectionCode of sections) {
                // Find or create the section
                let section = await prisma.section.findUnique({
                    where: { code: sectionCode }
                });

                if (!section) {
                    section = await prisma.section.create({
                        data: {
                            name: sectionCode.replace(/_/g, ' '),
                            code: sectionCode
                        }
                    });
                    console.log(`📁 Created section: ${sectionCode}`);
                }

                // Create SystemRole for this section
                const systemRoleCode = `${sectionCode}_${roleCode}`;
                const existingRole = await prisma.systemRole.findUnique({
                    where: { code: systemRoleCode }
                });

                if (existingRole) {
                    // Update permissions if role exists
                    await prisma.systemRole.update({
                        where: { code: systemRoleCode },
                        data: { permissions: JSON.stringify(permissions) }
                    });
                    console.log(`✅ Updated ${systemRoleCode} permissions`);
                    updatedCount++;
                } else {
                    await prisma.systemRole.create({
                        data: {
                            name: roleCode.replace(/_/g, ' '),
                            code: systemRoleCode,
                            sectionId: section.id,
                            permissions: JSON.stringify(permissions),
                            level: getRoleLevel(roleCode)
                        }
                    });
                    console.log(`✅ Created ${systemRoleCode}`);
                    createdCount++;
                }
            }
        }
    }

    console.log('\n--- Migration Summary ---');
    console.log(`Created: ${createdCount}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log('\nMigration complete.');
}

function getRoleLevel(roleCode: string): number {
    // Map role codes to levels (1=Junior, 2=Mid, 3=Senior, 4=Manager)
    if (roleCode.includes('MANAGER') || roleCode.includes('HEAD')) return 4;
    if (roleCode.includes('SENIOR') || roleCode.includes('COORDINATOR')) return 3;
    if (roleCode.includes('ASSISTANT')) return 1;
    return 2; // Default to Mid level
}

main()
    .catch((e) => {
        console.error('Migration failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
