import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Full parsed contractors list from FNC CONTRACTOR INFO 2025.xlsx
const parsedData = [
  {
    "registrationNumber": "SLTS/OSP/2025/2026-090",
    "invoiceName": "Tech Com",
    "contractorName": "Alakanka Peiris",
    "contactPhone": "0701859400",
    "nic": "701859400",
    "rtom": "RM",
    "isampTeams": ["SLTSRM_T45", "SLTSHO_T37"],
    "teamMembers": [
      { "name": "Akalanka Peiris", "nic": "199815801369", "phone": "0701859400", "team": "SLTSRM_T45" },
      { "name": "Tharanga Kumara", "nic": "197673301977", "phone": "0774228182", "team": "SLTSHO_T37" }
    ],
    "systemUsername": "tech.com",
    "suggestedPassword": "SLTS#tech.com2026"
  },
  {
    "registrationNumber": "SLTS/OSP/2025/2026-102",
    "invoiceName": "A.JOSEPH",
    "contractorName": "A.JOSEPH",
    "contactPhone": "0769189546",
    "nic": "195519502045",
    "rtom": "KG",
    "isampTeams": ["SLTS_KGT13"],
    "teamMembers": [
      { "name": "Nipuna", "nic": "913050665V", "phone": "0769189546", "team": "SLTS_KGT13" }
    ],
    "systemUsername": "a.joseph",
    "suggestedPassword": "SLTS#a.joseph2026"
  },
  {
    "registrationNumber": "SLTS/OSP/2025/2026-083",
    "invoiceName": "A.A.S.N.Darmasena",
    "contractorName": "A.A.S.N.Darmasena",
    "contactPhone": "0710158578",
    "nic": "196104400584",
    "rtom": "GQ",
    "isampTeams": ["SLTSGQ_T30"],
    "teamMembers": [
      { "name": "A.A.S.N.Darmasena", "nic": "196104400584", "phone": "0710158578", "team": "SLTSGQ_T30" }
    ],
    "systemUsername": "aasn.darmasena",
    "suggestedPassword": "SLTS#aasn.darmasena2026"
  },
  {
    "registrationNumber": "SLTS/OSP/2025/2026-398",
    "invoiceName": "Y D Balapitiya",
    "contractorName": "Yashan Balapitiya",
    "contactPhone": "0781148142",
    "nic": "940920795V",
    "rtom": "KX",
    "isampTeams": ["SLTSHO_T46"],
    "teamMembers": [
      { "name": "Yashan Balapitiya", "nic": "940920795V", "phone": "0781148142", "team": "SLTSHO_T46" }
    ],
    "systemUsername": "yd.balapitiya",
    "suggestedPassword": "SLTS#Balapitiya2026"
  }
];

async function importParsedContractors() {
    console.log('🚀 === BULK IMPORTING FULL PARSED CONTRACTORS & USERNAMES ===\n');

    let createdContractors = 0;
    let createdUsers = 0;
    let createdTeams = 0;
    let createdMembers = 0;

    for (const c of parsedData) {
        // 1. Upsert Contractor Record
        let contractor = await prisma.contractor.findFirst({
            where: {
                OR: [
                    ...(c.registrationNumber ? [{ registrationNumber: c.registrationNumber }] : []),
                    { name: c.invoiceName || c.contractorName },
                ]
            }
        });

        if (!contractor) {
            contractor = await prisma.contractor.create({
                data: {
                    name: c.invoiceName || c.contractorName,
                    registrationNumber: c.registrationNumber || undefined,
                    contactNumber: c.contactPhone,
                    nic: c.nic,
                    status: 'ACTIVE',
                }
            });
            createdContractors++;
        } else {
            contractor = await prisma.contractor.update({
                where: { id: contractor.id },
                data: {
                    name: c.invoiceName || c.contractorName,
                    registrationNumber: c.registrationNumber || contractor.registrationNumber,
                    contactNumber: c.contactPhone || contractor.contactNumber,
                    nic: c.nic || contractor.nic,
                    status: 'ACTIVE',
                }
            });
        }

        // 2. Upsert User Login Credentials
        const hashedPassword = await bcrypt.hash(c.suggestedPassword, 10);
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: c.systemUsername },
                    { contractorId: contractor.id }
                ]
            }
        });

        if (!existingUser) {
            await prisma.user.create({
                data: {
                    username: c.systemUsername,
                    email: `${c.systemUsername}@sltserp.lk`,
                    name: c.invoiceName || c.contractorName,
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
                    username: c.systemUsername,
                    email: `${c.systemUsername}@sltserp.lk`,
                    name: c.invoiceName || c.contractorName,
                    password: hashedPassword,
                    role: 'CONTRACTOR_SUPERVISOR',
                    status: 'active',
                    contractorId: contractor.id,
                }
            }).catch(() => {});
        }

        // 3. Upsert iSamp Mobile Teams & Link SODs
        for (const teamCode of c.isampTeams) {
            if (!teamCode || teamCode === '-' || teamCode === 'N/A') continue;

            let team = await prisma.contractorTeam.findFirst({
                where: { name: teamCode }
            });

            if (!team) {
                team = await prisma.contractorTeam.create({
                    data: {
                        name: teamCode,
                        contractorId: contractor.id,
                        status: 'ACTIVE',
                    }
                });
                createdTeams++;
            } else if (team.contractorId !== contractor.id) {
                await prisma.contractorTeam.update({
                    where: { id: team.id },
                    data: { contractorId: contractor.id }
                });
            }

            // Link SODs
            const sods = await prisma.serviceOrder.findMany({
                where: {
                    OR: [
                        { directTeam: { contains: teamCode, mode: 'insensitive' } },
                        { woroTaskName: { contains: teamCode, mode: 'insensitive' } },
                        { comments: { contains: teamCode, mode: 'insensitive' } },
                    ]
                }
            });

            for (const sod of sods) {
                if (sod.contractorId !== contractor.id) {
                    await prisma.serviceOrder.update({
                        where: { id: sod.id },
                        data: { contractorId: contractor.id }
                    });
                }
            }
        }

        // 4. Upsert Team Members
        for (const m of c.teamMembers) {
            if (!m.name || m.name === '-' || m.name === 'N/A') continue;

            const existingMember = await prisma.teamMember.findFirst({
                where: {
                    contractorId: contractor.id,
                    name: m.name
                }
            });

            if (!existingMember) {
                await prisma.teamMember.create({
                    data: {
                        name: m.name,
                        nic: m.nic !== 'N/A' && m.nic !== '-' ? m.nic : undefined,
                        contactNumber: m.phone !== 'N/A' && m.phone !== '-' ? m.phone : undefined,
                        contractorId: contractor.id,
                    }
                });
                createdMembers++;
            }
        }
    }

    console.log(`🎉 === FULL PARSED DATA BULK SYNC COMPLETED 100% === 🎉`);
    console.log(`   - Contractors Upserted: ${parsedData.length}`);
    console.log(`   - User Accounts Configured: ${createdUsers}`);
    console.log(`   - iSamp Teams Processed: ${createdTeams}`);
    console.log(`   - Team Members Registered: ${createdMembers}\n`);
}

importParsedContractors()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
