const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STAGE_SEQUENCE = [
  'Survey',
  'Permit',
  'Material',
  'Installation',
  'OTDR',
  'QA',
  'Closure'
];

async function main() {
  const targetStageName = process.argv[2];
  if (!targetStageName || !STAGE_SEQUENCE.includes(targetStageName)) {
    console.error("Please specify a valid stage name:", STAGE_SEQUENCE.join(', '));
    return;
  }

  console.log(`Setting active stage to: ${targetStageName}`);

  const targetIdx = STAGE_SEQUENCE.indexOf(targetStageName);

  // Update project status
  await prisma.project.update({
    where: { id: 'cmqhuhahi00jzsiyk6bovq9ix' },
    data: { status: 'IN_PROGRESS' }
  });

  // Fetch stages
  const project = await prisma.project.findUnique({
    where: { id: 'cmqhuhahi00jzsiyk6bovq9ix' },
    include: { workflowInstance: { include: { stages: true } } }
  });

  if (!project || !project.workflowInstance) {
    console.error("Project or workflow instance not found");
    return;
  }

  const stages = project.workflowInstance.stages;

  for (const s of stages) {
    const idx = STAGE_SEQUENCE.indexOf(s.name);
    let newStatus = 'PENDING';
    if (idx < targetIdx) {
      newStatus = 'COMPLETED';
    } else if (idx === targetIdx) {
      newStatus = 'IN_PROGRESS';
    }

    await prisma.projectStageInstance.update({
      where: { id: s.id },
      data: { status: newStatus }
    });
    console.log(`Updated Stage ${s.name} status to ${newStatus}`);
  }

  console.log("Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());