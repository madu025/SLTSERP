import { prisma } from '@/lib/prisma';

/**
 * Calculate and update project progress based on workflow stage completion
 * Progress is calculated as: completed stages / total stages * 100
 * Also auto-updates project status based on progress
 */
export async function calculateProjectProgress(projectId: string): Promise<number> {
  // Get the project's workflow instance with all stages
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

  if (!project?.workflowInstance?.stages || project.workflowInstance.stages.length === 0) {
    // No workflow - keep existing progress or set to 0
    return project?.progress || 0;
  }

  const stages = project.workflowInstance.stages;
  const totalStages = stages.length;
  const completedStages = stages.filter(s => s.status === 'COMPLETED').length;
  
  // Also count in-progress stages as partially complete (50%)
  const inProgressStages = stages.filter(s => s.status === 'IN_PROGRESS').length;
  
  // Progress = completed stages % + partial credit for in-progress stage
  const progress = Math.min(100, Math.round(
    ((completedStages / totalStages) * 100) + 
    (inProgressStages > 0 ? (1 / totalStages) * 50 : 0)
  ));

  // Auto-sync project status based on progress
  const updateData: any = { progress };
  
  if (progress >= 100) {
    updateData.status = 'COMPLETED';
    const p = project as any;
    if (!p.actualEndDate) {
      updateData.actualEndDate = new Date();
    }
  } else if (progress > 0 && project.status === 'PLANNING') {
    updateData.status = 'IN_PROGRESS';
  }

  await prisma.project.update({
    where: { id: projectId },
    data: updateData
  });

  return progress;
}

/**
 * Recalculate progress after a workflow stage change
 */
export async function updateProjectProgressOnStageChange(projectId: string): Promise<void> {
  await calculateProjectProgress(projectId);
}

/**
 * Update progress when BOQ is generated (initial planning progress)
 */
export async function updateProgressOnBOQGenerate(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workflowInstance: {
        include: {
          stages: { orderBy: { sequence: 'asc' } }
        }
      }
    }
  });

  if (!project) return;

  // If project has a workflow, use stage-based calculation
  if (project.workflowInstance?.stages?.length) {
    await calculateProjectProgress(projectId);
    return;
  }

  // Otherwise, set milestone-based progress
  // BOQ generation = ~10% if no workflow
  const currentProgress = project.progress || 0;
  const newProgress = Math.max(currentProgress, 10);
  
  await prisma.project.update({
    where: { id: projectId },
    data: { progress: newProgress }
  });
}