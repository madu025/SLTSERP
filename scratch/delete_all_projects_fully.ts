import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('--- STARTING WIPE OF ALL PROJECTS AND DEPENDENT WORKFLOWS ---');

  const projects = await prisma.project.findMany({
    select: { id: true, name: true, projectCode: true, gisMapping: true }
  });

  console.log(`Found ${projects.length} projects to delete.`);

  for (const project of projects) {
    console.log(`\nDeleting project: ${project.name} (${project.projectCode}) [ID: ${project.id}]`);

    // 1. Delete from QFieldCloud first if mapped
    if (project.gisMapping) {
      const gisMapping = project.gisMapping as Record<string, unknown>;
      const qfieldProjectId = gisMapping?.qfieldProjectId as string;
      if (qfieldProjectId) {
        try {
          const { QFieldCloudSyncService } = await import('../src/services/qfieldcloud-sync.service');
          const syncService = new QFieldCloudSyncService();
          await syncService.deleteQFieldProject(qfieldProjectId);
          console.log(`✅ Deleted QFieldCloud project ${qfieldProjectId} from cloud server.`);
        } catch (qfieldErr) {
          const err = qfieldErr as Error;
          console.error(`⚠️ Failed to delete QFieldCloud project ${qfieldProjectId}:`, err.message || err);
        }
      }
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Delete all dependent child instances first to prevent foreign key errors

        // 1. Workflow relations
        const workflowInstance = await tx.projectWorkflowInstance.findUnique({
          where: { projectId: project.id },
          select: { id: true }
        });

        if (workflowInstance) {
          const stageIds = await tx.projectStageInstance.findMany({
            where: { projectWorkflowInstanceId: workflowInstance.id },
            select: { id: true }
          }).then(stages => stages.map(s => s.id));

          if (stageIds.length > 0) {
            await tx.projectChecklistInstance.deleteMany({ where: { stageId: { in: stageIds } } });
            await tx.projectTaskInstance.deleteMany({ where: { stageId: { in: stageIds } } });
            await tx.projectApprovalInstance.deleteMany({ where: { stageId: { in: stageIds } } });
            await tx.projectStageInstance.deleteMany({ where: { projectWorkflowInstanceId: workflowInstance.id } });
          }
          await tx.projectWorkflowInstance.delete({ where: { id: workflowInstance.id } });
        }

        // 2. Clear all other relations mapped to Project
        await tx.projectBOQItem.deleteMany({ where: { projectId: project.id } });
        await tx.projectExpense.deleteMany({ where: { projectId: project.id } });
        await tx.projectMilestone.deleteMany({ where: { projectId: project.id } });
        await tx.projectTask.deleteMany({ where: { projectId: project.id } });
        await tx.timesheet.deleteMany({ where: { projectId: project.id } });
        await tx.projectDocument.deleteMany({ where: { projectId: project.id } });
        await tx.projectRisk.deleteMany({ where: { projectId: project.id } });
        await tx.projectPermit.deleteMany({ where: { projectId: project.id } });
        await tx.surveyPoint.deleteMany({ where: { projectId: project.id } });
        await tx.mobileSurveySession.deleteMany({ where: { projectId: project.id } });
        await tx.surveyRequest.deleteMany({ where: { projectId: project.id } });
        await tx.dailyProgress.deleteMany({ where: { projectId: project.id } });
        await tx.pATSession.deleteMany({ where: { projectId: project.id } });
        await tx.projectPayment.deleteMany({ where: { projectId: project.id } });
        await tx.gISRoute.deleteMany({ where: { projectId: project.id } });
        await tx.gISAuditLog.deleteMany({ where: { projectId: project.id } }).catch(() => {}); // catch if table name different
        await tx.projectAsset.deleteMany({ where: { projectId: project.id } });
        await tx.hSESafetyLog.deleteMany({ where: { projectId: project.id } }).catch(() => {});
        await tx.oTDRTest.deleteMany({ where: { projectId: project.id } }).catch(() => {});
        await tx.fieldTask.deleteMany({ where: { projectId: project.id } });
        await tx.projectChangeRequest.deleteMany({ where: { projectId: project.id } });

        // Finally delete the project itself
        await tx.project.delete({
          where: { id: project.id }
        });
      });

      console.log(`✅ Project "${project.name}" fully deleted.`);
    } catch (err) {
      const error = err as Error;
      console.error(`❌ Failed to delete project ${project.projectCode}:`, error.message || error);
    }
  }

  console.log('\n🎉 ALL PROJECTS DELETED SUCCESSFULLY.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
