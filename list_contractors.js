const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const contractors = await prisma.contractor.findMany({
    select: { id: true, name: true, status: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(contractors, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
