import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Fixing user issues...\n');

    // Delete the duplicate super admin "Prasad" user
    console.log('1. Deleting duplicate super admin "Prasad" user...');
    try {
        const deletedUser = await prisma.user.delete({
            where: { username: 'prasad' }
        });
        console.log('✅ Deleted duplicate user:', deletedUser.username);
    } catch (error: any) {
        if (error.code === 'P2025') {
            console.log('ℹ️  User "prasad" not found (already deleted or never existed)');
        } else {
            console.error('❌ Error deleting user:', error.message);
        }
    }

    // Update password for "Prasad Dissanayake" (area coordinator)
    console.log('\n2. Updating password for "Prasad Dissanayake" (Area Coordinator)...');
    try {
        // Find user by email or name pattern
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: 'prasad@slt.lk' },
                    { name: { contains: 'Prasad Dissanayake' } }
                ]
            }
        });

        if (user) {
            console.log('✅ Found user:', user.name, '(', user.username, ')');

            // Update password to abcd1234
            const hashedPassword = await bcrypt.hash('abcd1234', 10);
            await prisma.user.update({
                where: { id: user.id },
                data: { password: hashedPassword }
            });

            console.log('✅ Password updated successfully!');
            console.log('\nLogin credentials:');
            console.log('Username:', user.username);
            console.log('Password: abcd1234');
            console.log('Role:', user.role);
        } else {
            console.log('❌ Could not find "Prasad Dissanayake" user');
            console.log('\nListing all users with "prasad" in name or username:');
            const users = await prisma.user.findMany({
                where: {
                    OR: [
                        { username: { contains: 'prasad', mode: 'insensitive' } },
                        { name: { contains: 'prasad', mode: 'insensitive' } }
                    ]
                }
            });
            users.forEach(u => {
                console.log(`- ${u.name} (${u.username}) - ${u.role}`);
            });
        }
    } catch (error: any) {
        console.error('❌ Error updating password:', error.message);
    }
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
