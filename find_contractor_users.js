const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    const activeContractor = await prisma.contractor.findFirst({
        where: { status: 'ACTIVE' },
        include: { teams: true }
    });

    if (!activeContractor) {
        console.log('No active contractor found!');
        return;
    }

    const hashedPassword = await bcrypt.hash('123456', 10);
    const testUsername = 'contractor1';

    const testUser = await prisma.user.upsert({
        where: { username: testUsername },
        update: {
            password: hashedPassword,
            role: 'CONTRACTOR_SUPERVISOR',
            contractorId: activeContractor.id,
            status: 'active'
        },
        create: {
            username: testUsername,
            name: `${activeContractor.name} (Supervisor)`,
            password: hashedPassword,
            role: 'CONTRACTOR_SUPERVISOR',
            contractorId: activeContractor.id,
            status: 'active',
            email: 'contractor1@slts.lk'
        }
    });

    console.log(`\n==========================================`);
    console.log(`✅ CONTRACTOR LOGIN USER UPDATED!`);
    console.log(`Username: ${testUser.username}`);
    console.log(`Password: 123456`);
    console.log(`Status:   ${testUser.status}`);
    console.log(`Contractor: ${activeContractor.name}`);
    console.log(`==========================================\n`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
