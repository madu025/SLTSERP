import { prisma } from '../src/lib/prisma';

async function main() {
  const ids = ['cmqnerzlf0000siqgy0x76bc3', 'cmqn95a380000sisgqsige3xg'];
  for (const id of ids) {
    const project = await prisma.project.findUnique({
      where: { id },
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
      console.log(`Project ID ${id} not found.`);
      continue;
    }
    console.log(`========================================`);
    console.log(`Project ID: ${project.id}`);
    console.log(`Code: ${project.projectCode}`);
    console.log(`Name: ${project.name}`);
    console.log(`Status: ${project.status}`);
    console.log(`Workflow Instance ID: ${project.workflowInstance?.id || 'NONE'}`);
    console.log(`Current Stage ID: ${project.workflowInstance?.currentStageId || 'NONE'}`);
    if (project.workflowInstance?.stages) {
      project.workflowInstance.stages.forEach(s => {
        const isCurrent = s.id === project.workflowInstance?.currentStageId ? ' *** CURRENT ***' : '';
        console.log(`  - Seq ${s.sequence}: ${s.name} (Status: ${s.status})${isCurrent}`);
      });
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
