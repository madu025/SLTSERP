import { prisma } from '../src/lib/prisma';

async function main() {
  const projectId = 'cmqnerzlf0000siqgy0x76bc3';
  console.log(`Checking workflow details for project ID: ${projectId}`);
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workflowInstance: {
        include: {
          stages: {
            orderBy: { sequence: 'asc' }
          }
        }
      }
    }
  });

  if (!project) {
    console.error('Project not found');
    return;
  }

  console.log(`Project: ${project.name}`);
  console.log(`Status: ${project.status}`);
  console.log(`Workflow Instance exists: ${!!project.workflowInstance}`);
  
  if (project.workflowInstance) {
    console.log(`Workflow Instance ID: ${project.workflowInstance.id}`);
    console.log(`Current Stage ID in DB: ${project.workflowInstance.currentStageId}`);
    console.log('Stages:');
    project.workflowInstance.stages.forEach(s => {
      console.log(`- Sequence ${s.sequence}: ${s.name} [Status: ${s.status}]`);
    });
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
