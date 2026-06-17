/**
 * Backfill Missing Workflow Checklist & Approval Templates + Instances
 * 
 * This script fixes projects that were imported by prior versions of GISImportService
 * which created workflow stage templates and instances WITHOUT checklist/approval
 * sub-templates and sub-instances.
 * 
 * What it does:
 * 1. For each WorkflowStageTemplate that requires checklist/approval but has none:
 *    - Creates default checklist templates and approval templates
 * 2. For each ProjectStageInstance that requires checklist/approval but has none:
 *    - Creates default checklist instances and approval instances
 * 
 * Usage: npx tsx scripts/backfill-workflow-templates.ts
 */

import { prisma } from '../src/lib/prisma';
import { logger } from '../src/lib/logger';

// ── Default generators (mirrors GISImportService) ──────────────────────────────

interface DefaultChecklistItem {
  label: string;
  isMandatory: boolean;
}

interface DefaultApprovalLevel {
  level: number;
  role: string;
}

function getDefaultChecklist(stageName: string, reqPhotos: boolean): DefaultChecklistItem[] {
  const items: DefaultChecklistItem[] = [
    { label: `${stageName} completed as per specification`, isMandatory: true },
    { label: `${stageName} documentation completed`, isMandatory: true },
    { label: `Safety compliance verified`, isMandatory: true },
    { label: `Quality standards met`, isMandatory: true },
    { label: `All measurements within tolerance`, isMandatory: false },
  ];
  if (reqPhotos) {
    items.push({ label: `Photos uploaded and verified`, isMandatory: true });
  }
  return items;
}

function getDefaultApprovals(): DefaultApprovalLevel[] {
  return [
    { level: 1, role: 'SUPERVISOR' },
    { level: 2, role: 'MANAGER' },
  ];
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function backfillTemplates() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  BACKFILL: Workflow Templates (Checklists & Approvals)');
  console.log('══════════════════════════════════════════════════════\n');

  const stageTemplates = await prisma.workflowStageTemplate.findMany({
    include: {
      checklistTemplates: true,
      approvalTemplates: true,
    },
  });

  console.log(`Found ${stageTemplates.length} stage templates to inspect.`);

  let templatesFixed = 0;
  let checklistsCreated = 0;
  let approvalsCreated = 0;

  for (const stage of stageTemplates) {
    let stageModified = false;

    // Backfill checklist templates
    if (stage.reqChecklist && stage.checklistTemplates.length === 0) {
      const items = getDefaultChecklist(stage.name, stage.reqPhotos);
      for (const item of items) {
        await prisma.workflowChecklistTemplate.create({
          data: {
            stageTemplateId: stage.id,
            label: item.label,
            isMandatory: item.isMandatory,
          },
        });
        checklistsCreated++;
      }
      stageModified = true;
      console.log(`  ✅ Stage "${stage.name}" (template): +${items.length} checklist templates`);
    }

    // Backfill approval templates
    if (stage.reqApproval && stage.approvalTemplates.length === 0) {
      const levels = getDefaultApprovals();
      for (const level of levels) {
        await prisma.workflowApprovalTemplate.create({
          data: {
            stageTemplateId: stage.id,
            level: level.level,
            role: level.role,
          },
        });
        approvalsCreated++;
      }
      stageModified = true;
      console.log(`  ✅ Stage "${stage.name}" (template): +${levels.length} approval templates`);
    }

    if (stageModified) templatesFixed++;
  }

  console.log(`\nTemplates: ${templatesFixed} fixed, ${checklistsCreated} checklists created, ${approvalsCreated} approvals created.\n`);
  return { templatesFixed, checklistsCreated, approvalsCreated };
}

async function backfillInstances() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  BACKFILL: Project Workflow Instances (Checklists & Approvals)');
  console.log('══════════════════════════════════════════════════════\n');

  const stageInstances = await prisma.projectStageInstance.findMany({
    include: {
      checklists: true,
      approvals: true,
      stageTemplate: true,
    },
  });

  console.log(`Found ${stageInstances.length} stage instances to inspect.`);

  let instancesFixed = 0;
  let checklistInstancesCreated = 0;
  let approvalInstancesCreated = 0;

  for (const stage of stageInstances) {
    let stageModified = false;

    // Backfill checklist instances
    if (stage.reqChecklist && stage.checklists.length === 0) {
      // Try to clone from template, or use defaults
      let items: { label: string; isMandatory: boolean }[] = [];

      if (stage.stageTemplate && stage.stageTemplate.checklistTemplates) {
        // Fetch fresh checklist templates
        const templates = await prisma.workflowChecklistTemplate.findMany({
          where: { stageTemplateId: stage.stageTemplate.id },
        });
        if (templates.length > 0) {
          items = templates.map(t => ({ label: t.label, isMandatory: t.isMandatory }));
        }
      }

      if (items.length === 0) {
        items = getDefaultChecklist(stage.name, stage.reqPhotos);
      }

      for (const item of items) {
        await prisma.projectChecklistInstance.create({
          data: {
            stageId: stage.id,
            label: item.label,
            isMandatory: item.isMandatory,
            isCompleted: stage.status === 'COMPLETED', // auto-check if stage already completed
          },
        });
        checklistInstancesCreated++;
      }
      stageModified = true;
      console.log(`  ✅ Stage "${stage.name}" (instance): +${items.length} checklist instances${stage.status === 'COMPLETED' ? ' [auto-completed]' : ''}`);
    }

    // Backfill approval instances
    if (stage.reqApproval && stage.approvals.length === 0) {
      let levels: { level: number; role: string }[] = [];

      if (stage.stageTemplate) {
        const templates = await prisma.workflowApprovalTemplate.findMany({
          where: { stageTemplateId: stage.stageTemplate.id },
        });
        if (templates.length > 0) {
          levels = templates.map(t => ({ level: t.level, role: t.role }));
        }
      }

      if (levels.length === 0) {
        levels = getDefaultApprovals();
      }

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
      console.log(`  ✅ Stage "${stage.name}" (instance): +${levels.length} approval instances${stage.status === 'COMPLETED' ? ' [auto-approved]' : ''}`);
    }

    if (stageModified) instancesFixed++;
  }

  console.log(`\nInstances: ${instancesFixed} fixed, ${checklistInstancesCreated} checklist instances created, ${approvalInstancesCreated} approval instances created.\n`);
  return { instancesFixed, checklistInstancesCreated, approvalInstancesCreated };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  WORKFLOW BACKFILL: Checklists & Approvals               ║');
  console.log('║  Fixes templates and instances missing gate requirements ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const templateResults = await backfillTemplates();
  const instanceResults = await backfillInstances();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  BACKFILL COMPLETE — Summary');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Templates fixed:         ${templateResults.templatesFixed}`);
  console.log(`  Checklist templates:     ${templateResults.checklistsCreated}`);
  console.log(`  Approval templates:      ${templateResults.approvalsCreated}`);
  console.log(`  Instances fixed:         ${instanceResults.instancesFixed}`);
  console.log(`  Checklist instances:     ${instanceResults.checklistInstancesCreated}`);
  console.log(`  Approval instances:      ${instanceResults.approvalInstancesCreated}`);
  console.log('══════════════════════════════════════════════════════\n');

  // Verify by counting
  const totalChecklistTemplates = await prisma.workflowChecklistTemplate.count();
  const totalApprovalTemplates = await prisma.workflowApprovalTemplate.count();
  const totalChecklistInstances = await prisma.projectChecklistInstance.count();
  const totalApprovalInstances = await prisma.projectApprovalInstance.count();

  console.log('  Verification (totals in database):');
  console.log(`    WorkflowChecklistTemplate:  ${totalChecklistTemplates}`);
  console.log(`    WorkflowApprovalTemplate:   ${totalApprovalTemplates}`);
  console.log(`    ProjectChecklistInstance:   ${totalChecklistInstances}`);
  console.log(`    ProjectApprovalInstance:    ${totalApprovalInstances}`);
  console.log('');
}

main()
  .catch((err) => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });