import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== STARTING WORKFLOW & PROGRESS REMEDIATION ===');

  // Fetch all projects with active workflow instances
  const projects = await prisma.project.findMany({
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

  console.log(`Found ${projects.length} total projects in database.`);

  let repairedCount = 0;

  for (const project of projects) {
    const hasWorkflow = project.workflowInstance?.stages && project.workflowInstance.stages.length > 0;
    if (!hasWorkflow) {
      console.log(`Project ${project.projectCode} (${project.id}) has no workflow. Skipping.`);
      continue;
    }

    const stages = project.workflowInstance.stages;
    const totalStages = stages.length;
    const completedStages = stages.filter(s => s.status === 'COMPLETED').length;
    const inProgressStages = stages.filter(s => s.status === 'IN_PROGRESS').length;

    // Progress = completed stages % + partial credit for in-progress stage
    const computedProgress = Math.min(100, Math.round(
      ((completedStages / totalStages) * 100) + 
      (inProgressStages > 0 ? (1 / totalStages) * 50 : 0)
    ));

    const currentProgress = project.progress;

    if (currentProgress !== computedProgress) {
      console.log(`[DISCREPANCY] Project ${project.projectCode} (${project.name})`);
      console.log(`  Current Progress: ${currentProgress}%`);
      console.log(`  Computed Progress: ${computedProgress}% (Completed stages: ${completedStages}/${totalStages}, In Progress: ${inProgressStages})`);
      
      const updateData = { progress: computedProgress };
      
      // Auto-sync project status based on progress
      if (computedProgress >= 100) {
        updateData.status = 'COMPLETED';
        if (!project.endDate) {
          updateData.endDate = new Date();
        }
      } else if (computedProgress > 0 && project.status === 'PLANNING') {
        updateData.status = 'IN_PROGRESS';
      }

      await prisma.project.update({
        where: { id: project.id },
        data: updateData
      });

      console.log(`  -> Fixed project progress and status successfully!`);
      repairedCount++;
    } else {
      console.log(`[OK] Project ${project.projectCode} is in sync at ${currentProgress}%`);
    }
  }

  console.log(`\n=== REMEDIATION COMPLETE ===`);
  console.log(`Total projects checked: ${projects.length}`);
  console.log(`Total projects repaired: ${repairedCount}`);
}

main()
  .catch(err => {
    console.error('Error during remediation:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });