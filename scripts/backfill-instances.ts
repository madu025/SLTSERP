import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function getDefaultChecklist(stageName: string, reqPhotos: boolean) {
  const items: { label: string; isMandatory: boolean }[] = [
    { label: stageName + ' completed as per specification', isMandatory: true },
    { label: stageName + ' documentation completed', isMandatory: true },
    { label: 'Safety compliance verified', isMandatory: true },
    { label: 'Quality standards met', isMandatory: true },
    { label: 'All measurements within tolerance', isMandatory: false },
  ];
  if (reqPhotos) {
    items.push({ label: 'Photos uploaded and verified', isMandatory: true });
  }
  return items;
}

function getDefaultApprovals() {
  return [
    { level: 1, role: 'SUPERVISOR' },
    { level: 2, role: 'MANAGER' },
  ];
}

async function main() {
  console.log('=== WORKFLOW BACKFILL: Instances (Checklists & Approvals) ===\n');

  const stageInstances = await prisma.projectStageInstance.findMany({
    include: { checklists: true, approvals: true },
  });

  console.log('Found ' + stageInstances.length + ' stage instances to inspect.\n');

  let instancesFixed = 0;
  let checklistInstancesCreated = 0;
  let approvalInstancesCreated = 0;

  for (const stage of stageInstances) {
    let stageModified = false;

    if (stage.reqChecklist && stage.checklists.length === 0) {
      const items = getDefaultChecklist(stage.name, stage.reqPhotos);
      for (const item of items) {
        await prisma.projectChecklistInstance.create({
          data: {
            stageId: stage.id,
            label: item.label,
            isMandatory: item.isMandatory,
            isCompleted: stage.status === 'COMPLETED',
          },
        });
        checklistInstancesCreated++;
      }
      stageModified = true;
      console.log('  [OK] "' + stage.name + '": +' + items.length + ' checklist instances' + (stage.status === 'COMPLETED' ? ' [auto-completed]' : ''));
    }

    if (stage.reqApproval && stage.approvals.length === 0) {
      const levels = getDefaultApprovals();
      for (const level of levels) {
        await prisma.projectApprovalInstance.create({
          data: {
            stageId: stage.id,
            level: level.level,
            role: level.role,
            status: stage.status === 'COMPLETED' ? 'APPROVED' : 'PENDING',
          },
        });
        approvalInstancesCreated++;
      }
      stageModified = true;
      console.log('  [OK] "' + stage.name + '": +' + levels.length + ' approval instances' + (stage.status === 'COMPLETED' ? ' [auto-approved]' : ''));
    }

    if (stageModified) instancesFixed++;
  }

  console.log('\n=========================================================');
  console.log('  BACKFILL COMPLETE - Summary');
  console.log('=========================================================');
  console.log('  Instances fixed:         ' + instancesFixed);
  console.log('  Checklist instances:     ' + checklistInstancesCreated);
  console.log('  Approval instances:      ' + approvalInstancesCreated);

  const tci = await prisma.projectChecklistInstance.count();
  const tai = await prisma.projectApprovalInstance.count();
  console.log('\n  Verification (totals in database):');
  console.log('    ProjectChecklistInstance:   ' + tci);
  console.log('    ProjectApprovalInstance:    ' + tai);
  console.log('');

  await prisma.disconnect();
}

main()
  .catch((err: any) => { console.error('[FAIL] Backfill failed:', err); process.exit(1); });