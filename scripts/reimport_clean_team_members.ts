import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reimportCleanTeamMembers() {
    console.log('🧹 === CLEARING OLD TEAM MEMBERS & RE-IMPORTING CLEAN TEAM MEMBERS (CORRECT COLUMN INDICES) ===\n');

    // 1. Clear all existing TeamMember records
    const deleted = await prisma.teamMember.deleteMany({});
    console.log(`✅ Step 1: Cleared ${deleted.count} old TeamMember records from database.\n`);

    // 2. Read FNC CONTRACTOR INFO 2025.xlsx
    const filePath = 'd:\\MyProject\\SLTSERP\\FNC CONTRACTOR INFO 2025.xlsx';
    console.log(`Reading Excel file: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let createdCount = 0;

    // Exact repeating member blocks:
    // Block 1: Name col 10, NIC col 11, Phone col 12, Team col 13
    // Block 2: Name col 14, NIC col 15, Phone col 16, Team col 17
    // Block 3: Name col 18, NIC col 19, Phone col 20, Team col 21
    // Block 4: Name col 22, NIC col 23, Phone col 24, Team col 25
    // Block 5: Name col 26, NIC col 27, Phone col 28, Team col 29
    // Block 6: Name col 30, NIC col 31, Phone col 32, Team col 33
    const memberBlocks = [
        { nameCol: 10, nicCol: 11, phoneCol: 12, teamCol: 13 },
        { nameCol: 14, nicCol: 15, phoneCol: 16, teamCol: 17 },
        { nameCol: 18, nicCol: 19, phoneCol: 20, teamCol: 21 },
        { nameCol: 22, nicCol: 23, phoneCol: 24, teamCol: 25 },
        { nameCol: 26, nicCol: 27, phoneCol: 28, teamCol: 29 },
        { nameCol: 30, nicCol: 31, phoneCol: 32, teamCol: 33 },
    ];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const regNo = String(row[1] || '').trim();
        const contractorName = String(row[3] || row[2] || '').trim();

        if (!regNo && !contractorName) continue;

        // Find Contractor
        const contractor = await prisma.contractor.findFirst({
            where: {
                OR: [
                    ...(regNo ? [{ registrationNumber: regNo }] : []),
                    ...(contractorName ? [{ name: contractorName }] : []),
                ]
            }
        });

        if (!contractor) continue;

        // Process each block
        for (const block of memberBlocks) {
            const memberName = String(row[block.nameCol] || '').trim();
            const memberNic = String(row[block.nicCol] || '').trim();
            const rawPhone = String(row[block.phoneCol] || '').trim();
            const teamCode = String(row[block.teamCol] || '').trim();

            if (!memberName || memberName === '-' || memberName === 'N/A' || memberName === '1' || memberName.length < 2) continue;

            const phone = rawPhone && rawPhone !== '-' && rawPhone !== 'N/A' ? (rawPhone.startsWith('0') ? rawPhone : `0${rawPhone}`) : undefined;
            const cleanNic = memberNic && memberNic !== '-' && memberNic !== 'N/A' ? memberNic : undefined;

            // Find or Create ContractorTeam for this teamCode
            let teamId: string | null = null;
            if (teamCode && teamCode !== '-' && teamCode !== 'N/A') {
                let team = await prisma.contractorTeam.findFirst({
                    where: { name: teamCode, contractorId: contractor.id }
                });

                if (!team) {
                    team = await prisma.contractorTeam.create({
                        data: {
                            name: teamCode,
                            contractorId: contractor.id,
                            status: 'ACTIVE'
                        }
                    });
                }
                teamId = team.id;
            }

            // Create clean TeamMember record mapped strictly to teamId
            await prisma.teamMember.create({
                data: {
                    name: memberName,
                    nic: cleanNic,
                    contactNumber: phone,
                    contractorId: contractor.id,
                    teamId: teamId,
                }
            });
            createdCount++;
        }
    }

    console.log(`\n🎉 === CLEAN RE-IMPORT COMPLETE === 🎉`);
    console.log(`   - Total Clean Team Members Created: ${createdCount}\n`);

    // Verify Samaranayake & Balapitiya
    const samaranayake = await prisma.contractor.findFirst({
        where: { name: { contains: 'Samaranayake', mode: 'insensitive' } },
        include: { teams: { include: { members: true } } }
    });

    if (samaranayake) {
        console.log(`📌 M.N.M. Samaranayake Verification:`);
        console.log(`   - Contractor: ${samaranayake.name}`);
        samaranayake.teams.forEach(t => {
            console.log(`     • Team "${t.name}" (${t.members.length} members):`, t.members.map(m => `${m.name} (NIC: ${m.nic})`).join(', '));
        });
    }
}

reimportCleanTeamMembers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
