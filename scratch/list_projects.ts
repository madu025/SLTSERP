import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Listing all projects in database...');
  const projects = await prisma.project.findMany({
    include: {
      workflowInstance: true,
      projectType: true
    }
  });

  console.log(`Total projects: ${projects.length}`);
  projects.forEach(p => {
    console.log(`- ID: ${p.id}`);
    console.log(`  Code: ${p.projectCode}`);
    console.log(`  Name: ${p.name}`);
    console.log(`  Type: ${p.projectType?.name || 'NULL'}`);
    console.log(`  Workflow Instance: ${p.workflowInstance ? 'Initialized (' + p.workflowInstance.id + ')' : 'NONE'}`);
    console.log('--------------------------------------------------');
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
