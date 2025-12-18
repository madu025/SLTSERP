import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Creating Super Admin user...\n');

    const hashedPassword = await bcrypt.hash('admin123', 10);

    try {
        const user = await prisma.user.create({
            data: {
                username: 'admin',
                email: 'admin@slt.lk',
                password: hashedPassword,
                name: 'Super Administrator',
                role: 'SUPER_ADMIN'
            }
        });

        console.log('✅ Super Admin created successfully!');
        console.log('\nLogin credentials:');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('\n⚠️  Please change the password after first login!');
    } catch (error: any) {
        if (error.code === 'P2002') {
            console.log('ℹ️  Super Admin already exists');
        } else {
            console.error('❌ Error creating Super Admin:', error);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
