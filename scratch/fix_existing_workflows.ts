import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Finding all existing "Survey & Feasibility" stage instances...');
  
  // Find all stage instances with the name "Survey & Feasibility"
  const stages = await prisma.projectStageInstance.findMany({
    where: {
      name: {
        equals: 'Survey & Feasibility',
        mode: 'insensitive'
      }
    }
  });

  console.log(`Found ${stages.length} "Survey & Feasibility" stage instances. Modifying them...`);

  let modifiedCount = 0;
  for (const stage of stages) {
    // Disable checklist and photos requirements
    await prisma.projectStageInstance.update({
      where: { id: stage.id },
      data: {
        reqChecklist: false,
        reqPhotos: false
      }
    });

    // Delete associated checklist instances for this stage to clean up the UI
    const deleteRes = await prisma.projectChecklistInstance.deleteMany({
      where: { stageId: stage.id }
    });

    console.log(`Updated stage ${stage.id} (Project Workflow ID: ${stage.projectWorkflowInstanceId}). Deleted ${deleteRes.count} checklist items.`);
    modifiedCount++;
  }

  console.log(`Successfully updated ${modifiedCount} existing stage instances!`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
