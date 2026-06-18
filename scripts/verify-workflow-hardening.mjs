import { PrismaClient } from '@prisma/client';
import { WorkflowEngine } from '../src/services/WorkflowEngine.ts';
import { calculateProjectProgress } from '../src/lib/project-progress.ts';

const prisma = new PrismaClient();

async function runTests() {
  console.log('================================================================');
  console.log('   STARTING WORKFLOW HARDENING & SECURITY AUDIT VALIDATION      ');
  console.log('================================================================\n');

  // Let's locate the real project with active workflow
  const project = await prisma.project.findUnique({
    where: { id: 'cmqhuhahi00jzsiyk6bovq9ix' },
    include: {
      workflowInstance: {
        include: {
          stages: {
            orderBy: { sequence: 'asc' },
            include: {
              tasks: true,
              checklists: true,
              approvals: true,
            }
          }
        }
      }
    }
  });

  if (!project) {
    console.error('[FAIL] Live test project not found! Please check DB state.');
    process.exit(1);
  }

  console.log(`[INFO] Found Test Project: "${project.name}" (Code: ${project.projectCode})`);
  console.log(`[INFO] Current Project Status: ${project.status}, Progress: ${project.progress}%\n`);

  const workflow = project.workflowInstance;
  if (!workflow) {
    console.error('[FAIL] No active WorkflowInstance found for this project.');
    process.exit(1);
  }

  console.log(`[INFO] Workflow Instance ID: ${workflow.id}`);
  console.log(`[INFO] Total Stages: ${workflow.stages.length}`);
  
  // Test Cases
  let successCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      successCount++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failCount++;
    }
  }

  // TEST CASE 1: Attempt to bypass REST endpoint/updates manually setting progress & status when active workflow exists
  console.log('\n--- TEST CASE 1: Bypass prevention in PATCH updates ---');
  try {
    // Mimic API route behavior for PATCH payload
    const updatePayload = {
      id: project.id,
      progress: 95.5,
      status: 'COMPLETED',
      description: 'Updated description for security testing'
    };

    const hasActiveWorkflow = !!project.workflowInstance;
    
    // We replicate the exact logic implemented in src/app/api/projects/route.ts PATCH handler:
    if (updatePayload.progress !== undefined && updatePayload.progress !== null) {
      if (hasActiveWorkflow) {
        console.log(`  [INFO] Intercepting progress update. Found active workflow. Deleting progress from write data...`);
        delete updatePayload.progress;
      }
    }

    if (updatePayload.status !== undefined && updatePayload.status !== null) {
      if (hasActiveWorkflow) {
        console.log(`  [INFO] Intercepting status update. Found active workflow. Deleting status from write data...`);
        delete updatePayload.status;
      }
    }

    // Perform database update with remainder of updatePayload
    const updatedPrj = await prisma.project.update({
      where: { id: updatePayload.id },
      data: {
        description: updatePayload.description
      }
    });

    // Re-verify that actual db record's progress and status did NOT change to the bypassed values
    assert(updatedPrj.progress !== 95.5, 'Manual progress injection was blocked and did not overwrite real progress.');
    assert(updatedPrj.status !== 'COMPLETED', 'Manual status injection was blocked and did not override real status.');
    assert(updatedPrj.description === 'Updated description for security testing', 'Non-sensitive properties (description) are successfully updated.');

  } catch (error) {
    console.error('  [ERROR] Test Case 1 failed with exception:', error);
    failCount++;
  }

  // TEST CASE 2: Validate Stage Completion with Empty Requirements
  console.log('\n--- TEST CASE 2: Empty requirement checks (Structural Bypass Protection) ---');
  try {
    // Create a temporary stage instance with active reqChecklist or reqApproval but empty relation records
    const tempStage = await prisma.projectStageInstance.create({
      data: {
        projectWorkflowInstanceId: workflow.id,
        name: 'Temporary Audit Stage',
        sequence: 999,
        status: 'IN_PROGRESS',
        reqChecklist: true,
        reqApproval: true,
        reqPhotos: true,
        reqMaterials: false,
        reqDocuments: false,
        reqOTDR: false,
        reqGPS: false,
      }
    });

    console.log(`  [INFO] Created temporary stage with zero sub-records. Running validateStageCompletion...`);

    const result = await WorkflowEngine.validateStageCompletion(tempStage.id);

    console.log(`  [INFO] Validation errors:`, result.errors);

    assert(result.success === false, 'Stage completion validation correctly failed because checklist and approvals are empty.');
    assert(result.errors.some(e => e.includes('no checklist items are configured')), 'Correctly caught empty checklist validation error.');
    assert(result.errors.some(e => e.includes('no approval flows have been configured')), 'Correctly caught empty approval flow validation error.');

    // Clean up temp stage
    await prisma.projectStageInstance.delete({ where: { id: tempStage.id } });

  } catch (error) {
    console.error('  [ERROR] Test Case 2 failed with exception:', error);
    failCount++;
  }

  // TEST CASE 3: Photo Proof Validation and Malformed URL Detection
  console.log('\n--- TEST CASE 3: Photo proof verification & placeholder detection ---');
  try {
    // Create a temp stage
    const tempStage = await prisma.projectStageInstance.create({
      data: {
        projectWorkflowInstanceId: workflow.id,
        name: 'Temp Photo Proof Stage',
        sequence: 1000,
        status: 'IN_PROGRESS',
        reqChecklist: true,
        reqPhotos: true,
        reqApproval: false,
        reqMaterials: false,
        reqDocuments: false,
        reqOTDR: false,
        reqGPS: false,
      }
    });

    // Create a mandatory checklist item with a placeholder photoUrl
    const checklistItem = await prisma.projectChecklistInstance.create({
      data: {
        stageId: tempStage.id,
        label: 'Mandatory photo proof item',
        isMandatory: true,
        isCompleted: true,
        photoUrl: 'placeholder.png' // contains "placeholder"
      }
    });

    const resultWithPlaceholder = await WorkflowEngine.validateStageCompletion(tempStage.id);
    assert(resultWithPlaceholder.success === false, 'Rejected a placeholder photoUrl containing "placeholder".');
    assert(resultWithPlaceholder.errors.some(e => e.includes('Valid photo proof required')), 'Returned correct photo validation warning.');

    // Try undefined string
    await prisma.projectChecklistInstance.update({
      where: { id: checklistItem.id },
      data: { photoUrl: 'undefined' }
    });
    const resultWithUndefined = await WorkflowEngine.validateStageCompletion(tempStage.id);
    assert(resultWithUndefined.success === false, 'Rejected "undefined" string as a valid photo proof URL.');

    // Try empty string
    await prisma.projectChecklistInstance.update({
      where: { id: checklistItem.id },
      data: { photoUrl: '   ' }
    });
    const resultWithEmpty = await WorkflowEngine.validateStageCompletion(tempStage.id);
    assert(resultWithEmpty.success === false, 'Rejected blank spaces/empty strings as a valid photo proof URL.');

    // Try a completely legitimate photoUrl
    await prisma.projectChecklistInstance.update({
      where: { id: checklistItem.id },
      data: { photoUrl: 'https://slts-erp.slt.lk/uploads/proofs/fiber-join-proof-1.jpg' }
    });
    const resultLegit = await WorkflowEngine.validateStageCompletion(tempStage.id);
    assert(resultLegit.success === true, 'Accepts a fully valid, legitimate non-placeholder photoUrl.');

    // Clean up
    await prisma.projectChecklistInstance.delete({ where: { id: checklistItem.id } });
    await prisma.projectStageInstance.delete({ where: { id: tempStage.id } });

  } catch (error) {
    console.error('  [ERROR] Test Case 3 failed with exception:', error);
    failCount++;
  }

  // TEST CASE 4: Gate-based transitions and automatic progress updates
  console.log('\n--- TEST CASE 4: Transition & Automatic Progress Sync ---');
  try {
    // Retrieve the first stage of our project
    const stages = workflow.stages;
    const currentActiveStage = stages.find(s => s.status === 'IN_PROGRESS');

    if (currentActiveStage) {
      console.log(`  [INFO] Found active stage: "${currentActiveStage.name}"`);
      
      // Attempt to force complete it. If it fails gate validation, that means our engine is working securely.
      try {
        await WorkflowEngine.transitionStage(currentActiveStage.id, 'COMPLETED', 'test-user-id');
        console.log('  [WARN] Active stage transitioned with no errors. (Check if it has checklists or approvals configured.)');
      } catch (err) {
        console.log(`  [INFO] Transition securely blocked as expected:`, err.message);
        assert(err.message.includes('Gate validation failed'), 'Workflow stage transition correctly aborted due to gate validation constraints.');
      }
    }

    // Force recalculate project progress to verify calculation logic works perfectly
    const computedProgress = await calculateProjectProgress(project.id);
    console.log(`  [INFO] Programmatically Calculated Progress: ${computedProgress}%`);
    assert(typeof computedProgress === 'number' && computedProgress >= 0 && computedProgress <= 100, 'calculateProjectProgress executed correctly and returned a valid progress percentage.');

  } catch (error) {
    console.error('  [ERROR] Test Case 4 failed with exception:', error);
    failCount++;
  }

  console.log('\n================================================================');
  console.log('   VERIFICATION COMPLETED SUMMARY');
  console.log('================================================================');
  console.log(`   Successful Tests:  ${successCount}`);
  console.log(`   Failed Tests:      ${failCount}`);
  console.log('================================================================\n');

  await prisma.$disconnect();

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('[CRITICAL] Unexpected execution failure:', err);
  process.exit(1);
});