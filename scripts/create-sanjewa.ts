import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
    const passwordHash = await bcrypt.hash('12345', 12);
    
    const user = await prisma.user.create({
        data: {
            username: 'sanjewa',
            name: 'Sanjewa',
            email: 'sanjewa@slts.lk',
            password: passwordHash,
            role: 'STORES_MANAGER',
            status: 'ACTIVE',
        }
    });
    console.log('Created Sanjewa:', JSON.stringify({ id: user.id, username: user.username, role: user.role }, null, 2));
    
    await prisma.$disconnect();
}

main();
