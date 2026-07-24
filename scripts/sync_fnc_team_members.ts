import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncFNCTeamMembers() {
    const filePath = 'd:\\MyProject\\SLTSERP\\FNC CONTRACTOR INFO 2025.xlsx';
    console.log(`🚀 === SYNCING INDIVIDUAL TEAM MEMBERS FROM FNC EXCEL ===\n`);
    console.log(`Reading Excel file: ${filePath}`);

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let memberCount = 0;

    // Repeating team member blocks:
    // Block 1: Name col 9, NIC col 10, Phone col 11, Team col 12
    // Block 2: Name col 13, NIC col 14, Phone col 15, Team col 16
    // Block 3: Name col 17, NIC col 18, Phone col 19, Team col 20
    // Block 4: Name col 21, NIC col 22, Phone col 23, Team col 24
    // Block 5: Name col 25, NIC col 26, Phone col 27, Team col 28
    // Block 6: Name col 29, NIC col 30, Phone col 31, Team col 32
    const memberBlocks = [
        { nameCol: 9, nicCol: 10, phoneCol: 11, teamCol: 12 },
        { nameCol: 13, nicCol: 14, phoneCol: 15, teamCol: 16 },
        { nameCol: 17, nicCol: 18, phoneCol: 19, teamCol: 20 },
        { nameCol: 21, nicCol: 22, phoneCol: 23, teamCol: 24 },
        { nameCol: 25, nicCol: 26, phoneCol: 27, teamCol: 28 },
        { nameCol: 29, nicCol: 30, phoneCol: 31, teamCol: 32 },
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

        // Process each team member block
        for (const block of memberBlocks) {
            const memberName = String(row[block.nameCol] || '').trim();
            const memberNic = String(row[block.nicCol] || '').trim();
            const rawPhone = String(row[block.phoneCol] || '').trim();
            const teamCode = String(row[block.teamCol] || '').trim();

            if (!memberName || memberName === '-' || memberName === 'N/A') continue;

            const phone = rawPhone && rawPhone !== '-' ? (rawPhone.startsWith('0') ? rawPhone : `0${rawPhone}`) : undefined;
            const cleanNic = memberNic && memberNic !== '-' && memberNic !== 'N/A' ? memberNic : undefined;

            // Find ContractorTeam if teamCode exists
            let teamId: string | undefined = undefined;
            if (teamCode && teamCode !== '-' && teamCode !== 'N/A') {
                const team = await prisma.contractorTeam.findFirst({
                    where: { name: teamCode, contractorId: contractor.id }
                });
                teamId = team?.id;
            }

            // Upsert TeamMember
            const existingMember = await prisma.teamMember.findFirst({
                where: {
                    contractorId: contractor.id,
                    name: memberName
                }
            });

            if (!existingMember) {
                await prisma.teamMember.create({
                    data: {
                        name: memberName,
                        nic: cleanNic,
                        contactNumber: phone,
                        contractorId: contractor.id,
                        teamId: teamId || null,
                    }
                });
                memberCount++;
            } else {
                await prisma.teamMember.update({
                    where: { id: existingMember.id },
                    data: {
                        nic: cleanNic || existingMember.nic,
                        contactNumber: phone || existingMember.contactNumber,
                        teamId: teamId || existingMember.teamId,
                    }
                });
            }
        }
    }

    console.log(`\n🎉 === TEAM MEMBERS SYNC COMPLETE === 🎉`);
    console.log(`   - Total Individual Team Members Synced: ${memberCount}\n`);

    // Verify Balapitiya's Team Members
    const balapitiyaContractor = await prisma.contractor.findFirst({
        where: { name: { contains: 'Balapitiya', mode: 'insensitive' } },
        include: { teamMembers: true }
    });

    if (balapitiyaContractor) {
        console.log(`📌 Y D Balapitiya Team Members Verification:`);
        console.log(`   - Contractor: ${balapitiyaContractor.name}`);
        console.log(`   - Total Team Members: ${balapitiyaContractor.teamMembers.length}`);
        balapitiyaContractor.teamMembers.forEach(m => {
            console.log(`     • ${m.name} | NIC: ${m.nic || 'N/A'} | Phone: ${m.contactNumber || 'N/A'}`);
        });
    }
}

syncFNCTeamMembers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
