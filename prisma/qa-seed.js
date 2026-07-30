const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting QA Environment Seeding...');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Test@123', salt);

    const qaUsers = [
        {
            username: 'qa_admin',
            email: 'qa_admin@slts.com',
            name: 'QA Super Admin',
            role: 'SUPER_ADMIN',
            password: passwordHash,
            status: 'ACTIVE'
        },
        {
            username: 'qa_finance',
            email: 'qa_finance@slts.com',
            name: 'QA Finance Manager',
            role: 'FINANCE_MANAGER',
            password: passwordHash,
            status: 'ACTIVE'
        },
        {
            username: 'qa_osp',
            email: 'qa_osp@slts.com',
            name: 'QA OSP Manager',
            role: 'OSP_MANAGER',
            password: passwordHash,
            status: 'ACTIVE'
        },
        {
            username: 'qa_contractor',
            email: 'qa_contractor@slts.com',
            name: 'QA Primary Contractor',
            role: 'CONTRACTOR_SUPERVISOR',
            password: passwordHash,
            status: 'ACTIVE'
        },
        {
            username: 'qa_field',
            email: 'qa_field@slts.com',
            name: 'QA Field Engineer',
            role: 'CONTRACTOR_TECHNICIAN',
            password: passwordHash,
            status: 'ACTIVE'
        }
    ];

    for (const user of qaUsers) {
        await prisma.user.upsert({
            where: { username: user.username },
            update: { password: user.password, status: 'ACTIVE' },
            create: user,
        });
        console.log(`✅ Upserted QA User: ${user.username} (Role: ${user.role}) - Password: Test@123`);
    }

    console.log('✅ QA Seed Data Successfully Inserted!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
