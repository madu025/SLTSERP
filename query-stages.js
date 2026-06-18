const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const project = await prisma.project.findUnique({
    where: { id: 'cmqhuhahi00jzsiyk6bovq9ix' },
    include: {
      workflowInstance: {
        include: {
          stages: true
        }
      }
    }
  });
  if (!project) {
    console.log("Project not found!");
    return;
  }
  console.log("Project status:", project.status);
  console.log("Stages:");
  project.workflowInstance.stages.forEach(s => {
    console.log(`- ID: ${s.id}, Name: ${s.name}, Status: ${s.status}`);
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());