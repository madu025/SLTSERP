import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const routes = await prisma.gISRoute.findMany({
    select: {
      id: true,
      projectId: true,
      name: true,
      version: true,
      isActive: true,
      status: true,
      routeLength: true,
    }
  });
  console.log('All Routes in Database:');
  console.log(JSON.stringify(routes, null, 2));
}

run()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
