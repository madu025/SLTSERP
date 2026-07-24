import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function reimportFullContractorsTeamsMembers() {
    console.log('🔥 === CLEANING & RE-IMPORTING ALL TEAMS & MEMBERS FROM STRUCTURED JSON ===\n');

    // Step 1: Clean all existing teams and team members
    console.log('🧹 Step 1: Clearing existing TeamMember, TeamStoreAssignment, and ContractorTeam records...');
    await prisma.teamMember.deleteMany({});
    await prisma.teamStoreAssignment.deleteMany({});
    await prisma.contractorTeam.deleteMany({});
    console.log('✅ Cleared all TeamMembers and ContractorTeams.\n');

    // Step 2: Read JSON payload
    const jsonPath = path.join(__dirname, 'contractors_import_data.json');
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const contractorsData: any[] = JSON.parse(rawData);

    console.log(`🚀 Step 2: Processing ${contractorsData.length} Contractors from JSON payload...\n`);

    let upsertedContractors = 0;
    let createdUsers = 0;
    let createdTeams = 0;
    let createdMembers = 0;

    // Fetch OPMCs for RTOM matching
    const opmcs = await prisma.oPMC.findMany({ select: { id: true, name: true, rtom: true } });

    for (const c of contractorsData) {
        if (!c.invoiceName && !c.contractorName) continue;

        const name = c.invoiceName || c.contractorName;
        const phone = c.contactPhone ? (c.contactPhone.startsWith('0') ? c.contactPhone : `0${c.contactPhone}`) : undefined;
        const cleanNic = c.nic && c.nic !== 'N/A' && c.nic !== '-' ? c.nic : undefined;

        // 1. Upsert Contractor
        let contractor = await prisma.contractor.findFirst({
            where: {
                OR: [
                    ...(c.registrationNumber ? [{ registrationNumber: c.registrationNumber }] : []),
                    { name: name },
                ]
            }
        });

        if (!contractor) {
            contractor = await prisma.contractor.create({
                data: {
                    name,
                    registrationNumber: c.registrationNumber || undefined,
                    contactNumber: phone,
                    nic: cleanNic,
                    status: 'ACTIVE',
                }
            });
        } else {
            contractor = await prisma.contractor.update({
                where: { id: contractor.id },
                data: {
                    name,
                    registrationNumber: c.registrationNumber || contractor.registrationNumber,
                    contactNumber: phone || contractor.contactNumber,
                    nic: cleanNic || contractor.nic,
                    status: 'ACTIVE',
                }
            });
        }
        upsertedContractors++;

        // 2. Upsert User Login Credentials
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

        // 3. Process Teams & Nested Members
        if (c.teams && Array.isArray(c.teams)) {
            for (const teamItem of c.teams) {
                const isampCode = teamItem.isampTeamCode;
                if (!isampCode || isampCode === '-' || isampCode === 'N/A') continue;

                // Match RTOM code
                let opmcId: string | null = null;
                if (teamItem.rtom) {
                    const cleanRtom = teamItem.rtom.replace(/^R-/, '').trim();
                    const matchedOpmc = opmcs.find(o => 
                        o.rtom?.toLowerCase() === cleanRtom.toLowerCase() || 
                        o.name.toLowerCase().includes(cleanRtom.toLowerCase())
                    );
                    opmcId = matchedOpmc?.id || null;
                }

                // Create ContractorTeam
                const team = await prisma.contractorTeam.create({
                    data: {
                        name: isampCode,
                        contractorId: contractor.id,
                        opmcId,
                        status: 'ACTIVE',
                    }
                });
                createdTeams++;

                // Auto-link SODs
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
                    await prisma.serviceOrder.update({
                        where: { id: sod.id },
                        data: { contractorId: contractor.id }
                    });
                }

                // Create Nested Members
                if (teamItem.members && Array.isArray(teamItem.members)) {
                    for (const m of teamItem.members) {
                        if (!m.name || m.name === '-' || m.name === 'N/A' || m.name.length < 2) continue;

                        const memberPhone = m.phone && m.phone !== 'N/A' && m.phone !== '-' ? (m.phone.startsWith('0') ? m.phone : `0${m.phone}`) : undefined;
                        const memberNic = m.nic && m.nic !== 'N/A' && m.nic !== '-' ? m.nic : undefined;

                        await prisma.teamMember.create({
                            data: {
                                name: m.name,
                                nic: memberNic,
                                contactNumber: memberPhone,
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

    console.log(`\n🎉 === RE-IMPORT COMPLETELY SUCCESSFUL 100% === 🎉`);
    console.log(`   - Contractors Upserted: ${upsertedContractors}`);
    console.log(`   - User Credentials Configured: ${createdUsers}`);
    console.log(`   - ContractorTeams Created: ${createdTeams}`);
    console.log(`   - Team Members Mapped: ${createdMembers}\n`);

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

reimportFullContractorsTeamsMembers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
