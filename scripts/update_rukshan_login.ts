import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function updateRukshanLogin() {
    console.log('🚀 === CONFIGURING TEST LOGIN FOR TEAM SLTSKX_T9 (Rukshan / 12345) ===\n');

    // 1. Find team SLTSKX_T9
    const team = await prisma.contractorTeam.findFirst({
        where: { name: { contains: 'SLTSKX_T9', mode: 'insensitive' } },
        include: {
            contractor: true,
            members: true,
            storeAssignments: { include: { store: true } }
        }
    });

    if (!team) {
        console.log('❌ Team SLTSKX_T9 not found!');
        return;
    }

    const contractor = team.contractor;
    console.log(`📌 Found Team: "${team.name}"`);
    console.log(`   - Contractor Name: ${contractor.name}`);
    console.log(`   - Registration Number: ${contractor.registrationNumber || 'N/A'}`);
    console.log(`   - Contact Number: ${contractor.contactNumber || 'N/A'}`);

    // 2. Hash password "12345"
    const hashedPassword = await bcrypt.hash('12345', 10);

    // 3. Find or Create User for Rukshan
    let user = await prisma.user.findFirst({
        where: {
            OR: [
                { username: 'Rukshan' },
                { contractorId: contractor.id }
            ]
        }
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                username: 'Rukshan',
                email: 'rukshan@sltserp.lk',
                name: contractor.name,
                password: hashedPassword,
                role: 'CONTRACTOR_SUPERVISOR',
                status: 'active',
                contractorId: contractor.id,
            }
        });
    } else {
        user = await prisma.user.update({
            where: { id: user.id },
            data: {
                username: 'Rukshan',
                password: hashedPassword,
                role: 'CONTRACTOR_SUPERVISOR',
                status: 'active',
                contractorId: contractor.id,
            }
        });
    }

    // 4. Count linked SODs
    const sodsCount = await prisma.serviceOrder.count({
        where: {
            OR: [
                { contractorId: contractor.id },
                { teamId: team.id },
                { directTeam: { contains: 'SLTSKX_T9', mode: 'insensitive' } },
                { woroTaskName: { contains: 'SLTSKX_T9', mode: 'insensitive' } }
            ]
        }
    });

    console.log(`\n🎉 === RUKSHAN TEST LOGIN CONFIGURATION COMPLETED 100% === 🎉`);
    console.log(`   - Username: Rukshan`);
    console.log(`   - Password: 12345`);
    console.log(`   - Linked Contractor: ${contractor.name}`);
    console.log(`   - Active Team: ${team.name}`);
    console.log(`   - Team Members: ${team.members.map(m => m.name).join(', ') || 'N/A'}`);
    console.log(`   - Primary Store: ${team.storeAssignments[0]?.store.name || 'N/A'}`);
    console.log(`   - Assigned Active SODs: ${sodsCount}\n`);
}

updateRukshanLogin()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
