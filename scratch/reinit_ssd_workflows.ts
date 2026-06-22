import { prisma } from '../src/lib/prisma';
import { WorkflowEngine } from '../src/services/WorkflowEngine';

async function main() {
  console.log('--- RE-INITIALIZING ALL PROJECT WORKFLOW INSTANCES ---');

  // 1. Fetch all projects
  const projects = await prisma.project.findMany({
    include: {
      projectType: true,
      workflowInstance: true
    }
  });

  console.log(`Found ${projects.length} projects in database.`);

  for (const project of projects) {
    console.log(`\nProcessing project: ${project.name} (${project.projectCode})`);

    // 2. Delete existing workflow instance if exists
    if (project.workflowInstance) {
      console.log(`Deleting existing workflow instance ID: ${project.workflowInstance.id}...`);
      
      // Delete cascade relations first (or Prisma will cascade if configured, but let's do it explicitly to be safe)
      const stageIds = await prisma.projectStageInstance.findMany({
        where: { projectWorkflowInstanceId: project.workflowInstance.id },
        select: { id: true }
      }).then(stages => stages.map(s => s.id));

      if (stageIds.length > 0) {
        await prisma.projectChecklistInstance.deleteMany({
          where: { stageId: { in: stageIds } }
        });
        await prisma.projectTaskInstance.deleteMany({
          where: { stageId: { in: stageIds } }
        });
        await prisma.projectApprovalInstance.deleteMany({
          where: { stageId: { in: stageIds } }
        });
        await prisma.projectStageInstance.deleteMany({
          where: { projectWorkflowInstanceId: project.workflowInstance.id }
        });
      }

      await prisma.projectWorkflowInstance.delete({
        where: { id: project.workflowInstance.id }
      });
      console.log('✅ Deleted old workflow instances.');
    }

    // 3. Find appropriate project type (default to SSD if not assigned)
    let projectTypeId = project.projectTypeId;
    if (!projectTypeId) {
      const ssdType = await prisma.projectType.findUnique({ where: { name: 'SSD' } });
      if (ssdType) {
        projectTypeId = ssdType.id;
        await prisma.project.update({
          where: { id: project.id },
          data: { projectTypeId: ssdType.id }
        });
        console.log(`Assigned SSD project type to project.`);
      } else {
        console.error('Could not find SSD project type.');
        continue;
      }
    }

    // 4. Initialize workflow using WorkflowEngine
    try {
      const newWf = await WorkflowEngine.initializeProjectWorkflow(project.id, projectTypeId);
      console.log(`✅ Successfully initialized new 5-stage workflow for project! Instance ID: ${newWf.id}`);
    } catch (err: any) {
      console.error(`❌ Failed to initialize workflow: ${err.message}`);
    }
  }

  console.log('\n🎉 ALL WORKFLOWS RE-INITIALIZED SUCCESSFULLY.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
