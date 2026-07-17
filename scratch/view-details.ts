import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    console.log("=== SEARCHING USERS CONTAINING 'PRASAD' ===\n");
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: 'Prasad', mode: 'insensitive' } },
          { username: { contains: 'Prasad', mode: 'insensitive' } }
        ]
      }
    });

    console.log(`Found ${users.length} users:`);
    users.forEach((u, i) => {
      console.log(`[User ${i + 1}]`);
      console.log(`- ID: ${u.id}`);
      console.log(`- Name: ${u.name}`);
      console.log(`- Username: ${u.username}`);
      console.log(`- Employee ID: ${u.employeeId}`);
      console.log(`- Status: ${u.status}`);
      console.log("-----------------------------------------");
    });
  } catch (error) {
    console.error("Error executing query:", error);
  }
}

main().catch(console.error);
