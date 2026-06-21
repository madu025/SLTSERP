import { prisma } from '../src/lib/prisma';
import { WorkflowEngine } from '../src/services/WorkflowEngine';

async function main() {
  console.log('Fetching all projects without workflows...');
  
  const projects = await prisma.project.findMany({
    include: {
      workflowInstance: true
    }
  });

  const projectsWithoutWf = projects.filter(p => !p.workflowInstance);
  console.log(`Found ${projectsWithoutWf.length} projects without active workflows.`);

  if (projectsWithoutWf.length === 0) {
    console.log('All projects already have workflow instances initialized!');
    return;
  }

  // Get project types
  const projectTypes = await prisma.projectType.findMany();
  if (projectTypes.length === 0) {
    console.error('No project types found in database! Run seed-workflows first.');
    return;
  }

  // Use 'SSD' or first type as fallback
  const defaultType = projectTypes.find(t => t.name === 'SSD') || projectTypes[0];
  console.log(`Using default project type: ${defaultType.name} (${defaultType.id})`);

  for (const project of projectsWithoutWf) {
    console.log(`Initializing workflow for project: ${project.name} (${project.projectCode})...`);
    
    const typeId = project.projectTypeId || defaultType.id;
    
    // Assign project type if null
    if (!project.projectTypeId) {
      await prisma.project.update({
        where: { id: project.id },
        data: { projectTypeId: typeId }
      });
      console.log(`Assigning type ${defaultType.name} to ${project.projectCode}`);
    }

    try {
      const wf = await WorkflowEngine.initializeProjectWorkflow(project.id, typeId);
      console.log(`✓ Initialized workflow instance: ${wf.id}`);
    } catch (err: unknown) {
      console.error(`✗ Failed to initialize workflow for ${project.projectCode}:`, (err as Error).message);
    }
  }

  console.log('Workflow initialization complete for all projects!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
