import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function syncFNCContractorsAndIsampTeams() {
    const filePath = 'd:\\MyProject\\SLTSERP\\FNC CONTRACTOR INFO 2025.xlsx';
    console.log(`🚀 === IMPORTING & SYNCING FNC CONTRACTORS & iSAMP MOBILE TEAMS ===\n`);
    console.log(`Reading Excel file: ${filePath}`);

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let contractorCount = 0;
    let teamCount = 0;
    let sodLinkCount = 0;

    // Start from row 1 (row 0 is header)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const regNo = String(row[1] || '').trim();
        const invoiceName = String(row[2] || '').trim();
        const contractorName = String(row[3] || row[2] || '').trim();
        const rawPhone = String(row[4] || '').trim();
        const nic = String(row[7] || '').trim();
        const rtom = String(row[8] || '').trim();

        if (!regNo && !contractorName) continue;

        // Clean phone number
        const phone = rawPhone ? (rawPhone.startsWith('0') ? rawPhone : `0${rawPhone}`) : undefined;

        // 1. Upsert Contractor Record
        let contractor = await prisma.contractor.findFirst({
            where: {
                OR: [
                    ...(regNo ? [{ registrationNumber: regNo }] : []),
                    ...(contractorName ? [{ name: contractorName }] : []),
                    ...(invoiceName ? [{ name: invoiceName }] : []),
                ]
            }
        });

        if (!contractor) {
            contractor = await prisma.contractor.create({
                data: {
                    name: contractorName || invoiceName || `Contractor ${regNo}`,
                    registrationNumber: regNo || `SLTS/OSP/2025/2026-${i}`,
                    contactNumber: phone,
                    nic: nic || undefined,
                    status: 'ACTIVE',
                }
            });
            contractorCount++;
        } else {
            contractor = await prisma.contractor.update({
                where: { id: contractor.id },
                data: {
                    name: contractorName || invoiceName || contractor.name,
                    registrationNumber: regNo || contractor.registrationNumber,
                    contactNumber: phone || contractor.contactNumber,
                    nic: nic || contractor.nic,
                    status: 'ACTIVE',
                }
            });
        }

        // 2. Ensure User Login Account exists for this Contractor
        const sanitizedUsername = (contractorName || invoiceName)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '.')
            .replace(/\.+/g, '.')
            .replace(/^\.|\.$/g, '');

        if (sanitizedUsername) {
            const existingUser = await prisma.user.findFirst({
                where: { contractorId: contractor.id }
            });

            if (!existingUser) {
                const hashedPassword = await bcrypt.hash(`SLTS#${sanitizedUsername.slice(0, 5)}2026`, 10);
                await prisma.user.create({
                    data: {
                        username: sanitizedUsername,
                        email: `${sanitizedUsername}@sltserp.lk`,
                        name: contractorName || invoiceName,
                        password: hashedPassword,
                        role: 'CONTRACTOR_SUPERVISOR',
                        status: 'active',
                        contractorId: contractor.id,
                    }
                }).catch(() => {});
            }
        }

        // 3. Extract all iSamp Mobile Team Names from repeating columns
        // Columns 12, 16, 20, 24, 28, 32... contain 'I-shamp Mobile Team Name'
        const isampTeamCols = [12, 16, 20, 24, 28, 32];
        const isampTeams: string[] = [];

        for (const colIdx of isampTeamCols) {
            if (row[colIdx]) {
                const teamName = String(row[colIdx]).trim();
                if (teamName && teamName !== '-' && teamName !== 'N/A' && !isampTeams.includes(teamName)) {
                    isampTeams.push(teamName);
                }
            }
        }

        // 4. Upsert ContractorTeams and Link SODs
        for (const teamCode of isampTeams) {
            let team = await prisma.contractorTeam.findFirst({
                where: { name: teamCode }
            });

            if (!team) {
                team = await prisma.contractorTeam.create({
                    data: {
                        name: teamCode,
                        contractorId: contractor.id,
                        status: 'ACTIVE'
                    }
                });
                teamCount++;
            } else if (team.contractorId !== contractor.id) {
                await prisma.contractorTeam.update({
                    where: { id: team.id },
                    data: { contractorId: contractor.id }
                });
            }

            // 5. Link SODs matching this iSamp Mobile Team Code
            const matchedSODs = await prisma.serviceOrder.findMany({
                where: {
                    OR: [
                        { directTeam: { contains: teamCode, mode: 'insensitive' } },
                        { woroTaskName: { contains: teamCode, mode: 'insensitive' } },
                        { comments: { contains: teamCode, mode: 'insensitive' } },
                    ]
                }
            });

            for (const sod of matchedSODs) {
                if (sod.contractorId !== contractor.id) {
                    await prisma.serviceOrder.update({
                        where: { id: sod.id },
                        data: { contractorId: contractor.id }
                    });
                    sodLinkCount++;
                }
            }
        }
    }

    console.log(`\n🎉 === FNC EXCEL CONTRACTOR & iSAMP TEAM SYNC COMPLETE === 🎉`);
    console.log(`   - Total Contractors Processed/Updated: ${rows.length - 1}`);
    console.log(`   - New Contractors Created: ${contractorCount}`);
    console.log(`   - iSamp Mobile Teams Synced: ${teamCount}`);
    console.log(`   - SODs Linked via iSamp Mobile Teams: ${sodLinkCount}\n`);

    // Verify Balapitiya specifically
    const balapitiyaContractor = await prisma.contractor.findFirst({
        where: { name: { contains: 'Balapitiya', mode: 'insensitive' } },
        include: { teams: true, serviceOrders: true }
    });

    if (balapitiyaContractor) {
        console.log(`📌 Y D Balapitiya Verification:`);
        console.log(`   - Name: ${balapitiyaContractor.name}`);
        console.log(`   - Reg: ${balapitiyaContractor.registrationNumber}`);
        console.log(`   - Phone: ${balapitiyaContractor.contactNumber}`);
        console.log(`   - iSamp Teams: ${balapitiyaContractor.teams.map(t => t.name).join(', ')}`);
        console.log(`   - Total Assigned SODs: ${balapitiyaContractor.serviceOrders.length}`);
    }
}

syncFNCContractorsAndIsampTeams()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
