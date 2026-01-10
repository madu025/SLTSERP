/**
 * Script to assign stores to contractor teams
 * 
 * This script will:
 * 1. Find all contractor teams without store assignments
 * 2. Assign the team's OPMC store as the primary store
 * 
 * Run: node scripts/assign-stores-to-teams.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignStoresToTeams() {
    try {
        console.log('🔍 Finding teams without store assignments...\n');

        // Get all teams with their OPMC and existing store assignments
        const teams = await prisma.contractorTeam.findMany({
            include: {
                opmc: {
                    select: {
                        id: true,
                        name: true,
                        storeId: true,
                        store: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                storeAssignments: true
            }
        });

        console.log(`📊 Found ${teams.length} teams total\n`);

        let assignedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const team of teams) {
            // Skip if team already has store assignments
            if (team.storeAssignments.length > 0) {
                console.log(`⏭️  Team "${team.name}" already has ${team.storeAssignments.length} store(s) assigned - skipping`);
                skippedCount++;
                continue;
            }

            // Skip if OPMC doesn't have a store
            if (!team.opmc.storeId) {
                console.log(`⚠️  Team "${team.name}" - OPMC "${team.opmc.name}" has no store assigned - skipping`);
                skippedCount++;
                continue;
            }

            try {
                // Assign OPMC's store to the team as primary
                await prisma.teamStoreAssignment.create({
                    data: {
                        teamId: team.id,
                        storeId: team.opmc.storeId,
                        isPrimary: true
                    }
                });

                console.log(`✅ Team "${team.name}" → Store "${team.opmc.store?.name}" (Primary)`);
                assignedCount++;
            } catch (error) {
                console.error(`❌ Error assigning store to team "${team.name}":`, error.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📈 Summary:');
        console.log(`   ✅ Assigned: ${assignedCount}`);
        console.log(`   ⏭️  Skipped: ${skippedCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log('='.repeat(60) + '\n');

        if (assignedCount > 0) {
            console.log('🎉 Store assignments completed successfully!');
        } else {
            console.log('ℹ️  No new store assignments were needed.');
        }

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
assignStoresToTeams()
    .then(() => {
        console.log('\n✨ Script completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    });
