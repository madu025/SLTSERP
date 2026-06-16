import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Fixing username case sensitivity and password...\n');
    const hashedPassword = await bcrypt.hash('abcd1234', 10);

    // Find the user with username "Prasad" (Capital P)
    // We use findFirst because findUnique might strict match and we want to find the specific capitalized one if we can,
    // or we can search by email/name to be sure.
    const user = await prisma.user.findFirst({
        where: {
            username: 'Prasad'
        }
    });

    if (user) {
        console.log('✅ Found user with capitalized username:', user.username);

        try {
            const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: {
                    username: 'prasad', // Update to lowercase
                    password: hashedPassword // Reset password
                }
            });
            console.log('✅ Successfully updated username to lowercase and reset password for:', updatedUser.username);
        } catch (error) {
            console.error('❌ Error updating username:', error);
        }
    } else {
        console.log('❌ User with username "Prasad" not found. Searching by name...');
        const userByName = await prisma.user.findFirst({
            where: { name: { contains: 'Prasad Dissanayake' } }
        });

        if (userByName) {
            console.log('✅ Found user by name:', userByName.name, 'Current username:', userByName.username);
            if (userByName.username !== 'prasad') {
                await prisma.user.update({
                    where: { id: userByName.id },
                    data: { username: 'prasad' }
                });
                console.log('✅ Fixed username to "prasad"');
            } else {
                console.log('ℹ️ Username is already lowercase "prasad"');
            }
        } else {
            console.log('❌ User not found by name either.');
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
