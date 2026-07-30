import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking active users in DB...");
    const users = await prisma.user.findMany({
        take: 5,
        select: {
            id: true,
            username: true,
            role: true,
            status: true
        }
    });
    console.log("Users in database:", users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
