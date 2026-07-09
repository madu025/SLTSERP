import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = 'cmr3b0q2a00f5si6khytg417j';

async function main() {
  console.log(`Searching for GIS routes in project ${PROJECT_ID}...`);
  
  const routes = await prisma.gISRoute.findMany({
    where: { projectId: PROJECT_ID }
  });

  if (routes.length === 0) {
    console.log("No routes found for this project.");
    return;
  }

  console.log(`Found ${routes.length} routes. Deleting them...`);
  
  const deleteResult = await prisma.gISRoute.deleteMany({
    where: { projectId: PROJECT_ID }
  });

  console.log(`Successfully deleted ${deleteResult.count} routes and all cascading assets/BOQs.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
