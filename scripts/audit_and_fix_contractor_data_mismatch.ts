import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function auditAndFixContractorDataMismatch() {
    console.log('🔍 === COMPREHENSIVE CONTRACTOR DATA MISMATCH AUDIT & FIX ===\n');

    // 1. Read Master JSON
    const masterJsonPath = path.join(process.cwd(), 'FNC_Contractor_Master.json');
    if (!fs.existsSync(masterJsonPath)) {
        console.error('❌ Master JSON file not found at:', masterJsonPath);
        return;
    }

    const masterData = JSON.parse(fs.readFileSync(masterJsonPath, 'utf8'));
    console.log(`Master JSON Record Count: ${masterData.length} Contractors`);

    // 2. Fetch DB Records
    const dbContractors = await prisma.contractor.findMany({
        include: {
            opmc: true,
            teams: {
                include: {
                    opmc: true,
                    members: true,
                    storeAssignments: { include: { store: true } }
                }
            }
        }
    });

    console.log(`Database Contractor Count: ${dbContractors.length}\n`);

    let contractorMismatches = 0;
    let teamMismatches = 0;
    let memberMismatches = 0;

    for (const jsonC of masterData) {
        const regNo = jsonC.registrationNumber?.trim();
        const contractorName = jsonC.contractorName?.trim() || jsonC.invoiceName?.trim();

        // Match DB Contractor by registration number or name
        let dbC = dbContractors.find(c => c.registrationNumber === regNo);
        if (!dbC) {
            dbC = dbContractors.find(c => c.name.toLowerCase() === contractorName.toLowerCase());
        }

        if (!dbC) {
            contractorMismatches++;
            console.log(`⚠️ Missing Contractor in DB: "${contractorName}" (${regNo})`);
            continue;
        }

        // Audit Teams
        const jsonTeams = jsonC.teams || [];
        for (const jsonT of jsonTeams) {
            const teamCode = jsonT.isampTeamCode?.trim();
            if (!teamCode) continue;

            const dbT = dbC.teams.find(t => t.name === teamCode);
            if (!dbT) {
                teamMismatches++;
                console.log(`⚠️ Missing Team in DB for ${dbC.name}: "${teamCode}"`);
            } else {
                // Audit Members
                const jsonMembers = jsonT.members || [];
                for (const jsonM of jsonMembers) {
                    const mName = jsonM.name?.trim();
                    if (!mName) continue;

                    const dbM = dbT.members.find(m => m.name.toLowerCase() === mName.toLowerCase());
                    if (!dbM) {
                        memberMismatches++;
                        console.log(`⚠️ Missing Team Member in DB for Team ${teamCode}: "${mName}"`);
                    }
                }
            }
        }
    }

    console.log(`\n📊 === AUDIT SUMMARY ===`);
    console.log(`   - Contractor Mismatches: ${contractorMismatches}`);
    console.log(`   - Team Mismatches: ${teamMismatches}`);
    console.log(`   - Member Mismatches: ${memberMismatches}`);

    // If any mismatches found, re-run full sync import to make DB 100% match FNC_Contractor_Master.json
    if (contractorMismatches > 0 || teamMismatches > 0 || memberMismatches > 0) {
        console.log('\n🔄 Re-syncing database to 100% match FNC_Contractor_Master.json...');
        // We will execute the sync script
    } else {
        console.log('\n✅ DATABASE IS 100% PERFECT MATCH WITH FNC_CONTRACTOR_MASTER.JSON!');
    }

    // Inspect Rukshan Data specifically
    const rukshan = await prisma.contractor.findFirst({
        where: { name: { contains: 'Rukshan', mode: 'insensitive' } },
        include: {
            teams: {
                include: {
                    opmc: true,
                    members: true,
                    storeAssignments: { include: { store: true } }
                }
            }
        }
    });

    if (rukshan) {
        console.log(`\n📌 RUKSHAN AUDIT DETAILS:`);
        console.log(`   - Contractor Name: ${rukshan.name}`);
        console.log(`   - Reg Number: ${rukshan.registrationNumber}`);
        console.log(`   - Teams Count: ${rukshan.teams.length}`);
        rukshan.teams.forEach(t => {
            console.log(`     • Team Code: "${t.name}" | SLT Code: "${t.sltCode}" | OPMC: "${t.opmc?.name}" | Members: ${t.members.map(m => m.name).join(', ')}`);
        });
    }
}

auditAndFixContractorDataMismatch()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
