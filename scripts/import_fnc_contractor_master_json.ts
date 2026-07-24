import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function importFNCContractorMasterJSON() {
    console.log('🚀 === IMPORTING FULL FNC_Contractor_Master.json INTO DATABASE ===\n');

    const jsonPath = 'd:\\MyProject\\SLTSERP\\FNC_Contractor_Master.json';
    console.log(`Reading JSON file: ${jsonPath}`);

    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const contractorsData: any[] = JSON.parse(rawData);

    console.log(`Processing ${contractorsData.length} Contractors from master JSON...\n`);

    let createdContractors = 0;
    let createdUsers = 0;
    let createdTeams = 0;
    let createdMembers = 0;
    let linkedSods = 0;

    // Fetch OPMCs for RTOM matching
    const opmcs = await prisma.oPMC.findMany({ select: { id: true, name: true, rtom: true } });

    for (const c of contractorsData) {
        if (!c.invoiceName && !c.contractorName) continue;

        const name = c.invoiceName || c.contractorName;
        const rawPhone = String(c.contactPhone || '').trim();
        const phone = rawPhone && rawPhone !== 'N/A' && rawPhone !== '-' ? (rawPhone.startsWith('0') ? rawPhone : `0${rawPhone}`) : undefined;
        const cleanNic = c.nic && c.nic !== 'N/A' && c.nic !== '-' ? String(c.nic).trim() : undefined;
        const regNo = c.registrationNumber && c.registrationNumber !== 'N/A' ? String(c.registrationNumber).trim() : undefined;

        // 1. Create/Find Contractor
        let contractor = await prisma.contractor.findFirst({
            where: {
                OR: [
                    ...(regNo ? [{ registrationNumber: regNo }] : []),
                    { name: name },
                ]
            }
        });

        if (!contractor) {
            contractor = await prisma.contractor.create({
                data: {
                    name,
                    registrationNumber: regNo,
                    contactNumber: phone,
                    nic: cleanNic,
                    status: 'ACTIVE',
                }
            });
            createdContractors++;
        } else {
            contractor = await prisma.contractor.update({
                where: { id: contractor.id },
                data: {
                    name,
                    registrationNumber: regNo || contractor.registrationNumber,
                    contactNumber: phone || contractor.contactNumber,
                    nic: cleanNic || contractor.nic,
                    status: 'ACTIVE',
                }
            });
        }

        // 2. Create User Credentials
        const username = c.systemUsername || name.toLowerCase().replace(/[^a-z0-9]/g, '.');
        const rawPassword = c.suggestedPassword || `SLTS#${username}2026`;
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username },
                    { contractorId: contractor.id }
                ]
            }
        });

        if (!existingUser) {
            await prisma.user.create({
                data: {
                    username,
                    email: `${username}@sltserp.lk`,
                    name,
                    password: hashedPassword,
                    role: 'CONTRACTOR_SUPERVISOR',
                    status: 'active',
                    contractorId: contractor.id,
                }
            }).catch(() => {});
            createdUsers++;
        } else {
            await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    username,
                    email: `${username}@sltserp.lk`,
                    name,
                    password: hashedPassword,
                    role: 'CONTRACTOR_SUPERVISOR',
                    status: 'active',
                    contractorId: contractor.id,
                }
            }).catch(() => {});
        }

        // 3. Process Teams & Members
        if (c.teams && Array.isArray(c.teams)) {
            for (const teamItem of c.teams) {
                const isampCode = teamItem.isampTeamCode ? String(teamItem.isampTeamCode).trim() : null;
                if (!isampCode || isampCode === '-' || isampCode === 'N/A' || isampCode.toLowerCase() === 'no') continue;

                // Match RTOM code to OPMC
                let opmcId: string | null = null;
                if (teamItem.rtom) {
                    const cleanRtom = String(teamItem.rtom).replace(/^R-/, '').trim();
                    const matchedOpmc = opmcs.find(o => 
                        o.rtom?.toLowerCase() === cleanRtom.toLowerCase() || 
                        o.name.toLowerCase().includes(cleanRtom.toLowerCase())
                    );
                    opmcId = matchedOpmc?.id || null;
                }

                // Check or Create ContractorTeam
                let team = await prisma.contractorTeam.findFirst({
                    where: { name: isampCode, contractorId: contractor.id }
                });

                if (!team) {
                    team = await prisma.contractorTeam.create({
                        data: {
                            name: isampCode,
                            sltCode: isampCode,
                            contractorId: contractor.id,
                            opmcId,
                            status: 'ACTIVE',
                        }
                    });
                    createdTeams++;
                }

                // Auto-link SODs matching this team
                const matchingSods = await prisma.serviceOrder.findMany({
                    where: {
                        OR: [
                            { directTeam: { contains: isampCode, mode: 'insensitive' } },
                            { woroTaskName: { contains: isampCode, mode: 'insensitive' } },
                            { comments: { contains: isampCode, mode: 'insensitive' } },
                        ]
                    }
                });

                for (const sod of matchingSods) {
                    if (sod.contractorId !== contractor.id || sod.teamId !== team.id) {
                        await prisma.serviceOrder.update({
                            where: { id: sod.id },
                            data: { contractorId: contractor.id, teamId: team.id }
                        });
                        linkedSods++;
                    }
                }

                // Process Members
                if (teamItem.members && Array.isArray(teamItem.members)) {
                    for (const m of teamItem.members) {
                        const mName = m.name ? String(m.name).trim() : '';
                        if (!mName || mName === '-' || mName === 'N/A' || mName === '1' || mName.length < 2) continue;

                        const mPhoneRaw = String(m.phone || '').trim();
                        const mPhone = mPhoneRaw && mPhoneRaw !== 'N/A' && mPhoneRaw !== '-' ? (mPhoneRaw.startsWith('0') ? mPhoneRaw : `0${mPhoneRaw}`) : undefined;
                        const mNic = m.nic && m.nic !== 'N/A' && m.nic !== '-' ? String(m.nic).trim() : undefined;

                        const existingMember = await prisma.teamMember.findFirst({
                            where: {
                                contractorId: contractor.id,
                                name: mName,
                                teamId: team.id,
                            }
                        });

                        if (!existingMember) {
                            await prisma.teamMember.create({
                                data: {
                                    name: mName,
                                    nic: mNic,
                                    contactNumber: mPhone,
                                    contractorId: contractor.id,
                                    teamId: team.id,
                                }
                            });
                            createdMembers++;
                        }
                    }
                }
            }
        }
    }

    console.log(`\n🎉 === MASTER JSON IMPORT COMPLETED 100% === 🎉`);
    console.log(`   - Total Contractors Processed/Created: ${createdContractors}`);
    console.log(`   - User Credentials Configured: ${createdUsers}`);
    console.log(`   - ContractorTeams Created: ${createdTeams}`);
    console.log(`   - Team Members Registered: ${createdMembers}`);
    console.log(`   - Field SODs Linked: ${linkedSods}\n`);

    // Verify Samaranayake & Balapitiya
    const samaranayake = await prisma.contractor.findFirst({
        where: { name: { contains: 'Samaranayake', mode: 'insensitive' } },
        include: { teams: { include: { members: true } } }
    });

    if (samaranayake) {
        console.log(`📌 M.N.M. Samaranayake Verification:`);
        console.log(`   - Contractor: ${samaranayake.name} (${samaranayake.registrationNumber})`);
        samaranayake.teams.forEach(t => {
            console.log(`     • Team "${t.name}" (${t.members.length} members):`, t.members.map(m => `${m.name} (NIC: ${m.nic || 'N/A'})`).join(', '));
        });
    }

    const balapitiya = await prisma.contractor.findFirst({
        where: { name: { contains: 'Balapitiya', mode: 'insensitive' } },
        include: { teams: { include: { members: true } } }
    });

    if (balapitiya) {
        console.log(`\n📌 Y D Balapitiya Verification:`);
        console.log(`   - Contractor: ${balapitiya.name} (${balapitiya.registrationNumber})`);
        balapitiya.teams.forEach(t => {
            console.log(`     • Team "${t.name}" (${t.members.length} members):`, t.members.map(m => `${m.name} (NIC: ${m.nic || 'N/A'})`).join(', '));
        });
    }
}

importFNCContractorMasterJSON()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
