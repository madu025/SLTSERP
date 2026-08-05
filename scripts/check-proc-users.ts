import { prisma } from '../src/lib/prisma';

async function main() {
    const procUsers = await prisma.user.findMany({
        where: { role: 'PROCUREMENT_OFFICER' },
        select: { id: true, username: true, name: true, role: true }
    });
    console.log('Procurement users:', JSON.stringify(procUsers, null, 2));

    if (procUsers.length === 0) {
        console.log('No PROCUREMENT_OFFICER found. Creating one...');
        const bcrypt = await import('bcryptjs');
        const hash = await bcrypt.hash('Admin@123', 12);
        const user = await prisma.user.create({
            data: {
                username: 'procurement',
                name: 'Procurement Officer',
                email: 'procurement@slts.lk',
                password: hash,
                role: 'PROCUREMENT_OFFICER',
                status: 'ACTIVE',
            }
        });
        console.log('Created:', JSON.stringify({ id: user.id, username: user.username, role: user.role }));
    }

    await prisma.$disconnect();
}

main();
