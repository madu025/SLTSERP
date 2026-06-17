/**
 * PROJECT WORKFLOW AUDIT via API
 * Audits project workflow through the REST API
 */
const http = require('http');

const PROJECT_ID = 'cmqhuhahi00jzsiyk6bovq9ix';

function api(path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let y = '';
      res.on('data', (c) => (y += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, cookies: res.headers['set-cookie'], data: JSON.parse(y) });
        } catch {
          resolve({ status: res.statusCode, cookies: res.headers['set-cookie'], data: y });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('===============================================================');
  console.log('  PROJECT WORKFLOW AUDIT (via API)');
  console.log('===============================================================\n');

  // 1. Login
  const login = await api('/api/login', { username: 'admin', password: 'Admin@123' });
  const cookie = (Array.isArray(login.cookies) ? login.cookies.join(';') : login.cookies || '').split(';')[0];

  // 2. Get project details
  const projectRes = await api('/api/projects/' + PROJECT_ID);
  const project = projectRes.data;
  if (!project || projectRes.status !== 200) {
    console.log('X Project not found! Status: ' + projectRes.status);
    console.log('Response: ' + JSON.stringify(project));
    return;
  }

  console.log('Project: ' + (project.projectCode || 'N/A') + ' - ' + (project.name || 'N/A'));
  console.log('  Type: ' + (project.type || 'N/A'));
  console.log('  Status: ' + (project.status || 'N/A'));
  console.log('  Progress: ' + (project.progress || 0) + '%\n');

  // 3. Get workflow
  const wfRes = await api('/api/projects/' + PROJECT_ID + '/workflow');
  const wf = wfRes.data;
  if (!wf || wfRes.status !== 200) {
    console.log('X Workflow API failed! Status: ' + wfRes.status);
    console.log('Response: ' + JSON.stringify(wf));
    return;
  }

  const stages = wf.stages || wf.data?.stages || [];
  console.log('-- Workflow Stages: ' + stages.length + ' -----------------------\n');

  if (stages.length === 0) {
    console.log('X NO STAGES FOUND! Workflow was not initialized properly.\n');
    console.log('Full workflow response:\n' + JSON.stringify(wf, null, 2));
    return;
  }

  let totalTasks = 0;
  let completedTasks = 0;
  let completedStages = 0;
  let issues = [];

  for (const stage of stages) {
    const tasks = stage.tasks || [];
    const checklists = stage.checklists || stage.checklistItems || [];
    const approvals = stage.approvals || [];
    const photos = stage.photos || [];

    const completedTasksInStage = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'completed').length;
    const allTasksDone = completedTasksInStage === tasks.length && tasks.length > 0;
    const stageStatus = (stage.status || '').toUpperCase();

    if (stageStatus === 'COMPLETED') completedStages++;
    completedTasks += completedTasksInStage;
    totalTasks += tasks.length;

    console.log('  Stage ' + (stage.sequence || '?') + ': ' + (stage.name || 'Unnamed'));
    console.log('    Status: ' + stage.status + (stageStatus === 'COMPLETED' ? ' [DONE]' : ' [PENDING]'));
    console.log('    Tasks: ' + tasks.length + ' (' + completedTasksInStage + ' completed)');
    console.log('    Checklist Items: ' + checklists.length + ' (' + checklists.filter((c) => c.isChecked || c.checked).length + ' checked)');
    console.log('    Approvals: ' + approvals.length + ' (' + approvals.filter((a) => (a.status || '').toUpperCase() === 'APPROVED').length + ' approved)');
    console.log('    Photos: ' + photos.length);

    // --- AUDIT CHECKS ---

    // Check 1: Stage marked COMPLETED but tasks not all done
    if (stageStatus === 'COMPLETED' && !allTasksDone && tasks.length > 0) {
      issues.push('Stage "' + stage.name + '" marked COMPLETED but ' + (tasks.length - completedTasksInStage) + ' tasks incomplete');
    }

    // Check 2: All tasks done but stage not COMPLETED
    if (allTasksDone && stageStatus !== 'COMPLETED') {
      issues.push('Stage "' + stage.name + '" all tasks done but stage status is ' + stage.status + ' (should be COMPLETED)');
    }

    // Check 3: Stage requires checklist but has none
    if (stage.reqChecklist && checklists.length === 0) {
      issues.push('Stage "' + stage.name + '" requires checklist but has 0 items');
    }

    // Check 4: Stage requires approval but has none
    if (stage.reqApproval && approvals.length === 0) {
      issues.push('Stage "' + stage.name + '" requires approval but has 0 approval records');
    }

    // Check 5: Mandatory checklist items not checked
    const mandatoryUnchecked = checklists.filter((c) => (c.isMandatory || c.mandatory) && !(c.isChecked || c.checked));
    if (mandatoryUnchecked.length > 0 && stageStatus === 'COMPLETED') {
      issues.push('Stage "' + stage.name + '" COMPLETED but ' + mandatoryUnchecked.length + ' mandatory checklist items unchecked');
    }

    // Check 6: Approvals pending but stage completed
    const pendingApprovals = approvals.filter((a) => (a.status || '').toUpperCase() !== 'APPROVED');
    if (pendingApprovals.length > 0 && stageStatus === 'COMPLETED') {
      issues.push('Stage "' + stage.name + '" COMPLETED but ' + pendingApprovals.length + ' approvals pending');
    }

    // Print task details
    for (const task of tasks) {
      const ts = (task.status || '').toUpperCase();
      const icon = ts === 'COMPLETED' ? '[Y]' : ts === 'IN_PROGRESS' ? '[~]' : '[ ]';
      console.log('    ' + icon + ' Task: ' + (task.name || task.title || 'Unnamed') + ' [' + task.status + ']');
    }
    console.log('');
  }

  // 4. Summary
  console.log('===============================================================');
  console.log('  AUDIT SUMMARY');
  console.log('===============================================================\n');

  console.log('  Total Stages: ' + stages.length + ' (' + completedStages + ' completed)');
  console.log('  Total Tasks: ' + totalTasks + ' (' + completedTasks + ' completed)');
  console.log('  Issues Found: ' + issues.length + '\n');

  if (issues.length > 0) {
    console.log('  -- ISSUES --------------------------------------------------\n');
    issues.forEach((issue, i) => console.log('  ' + (i + 1) + '. ' + issue));
    console.log('');
  } else {
    console.log('  OK - NO ISSUES FOUND. Workflow is properly configured!\n');
  }

  // 5. Workflow completion percentage
  const stageCompletion = stages.length > 0 ? Math.round((completedStages / stages.length) * 100) : 0;
  const taskCompletion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  console.log('  Stage Completion: ' + stageCompletion + '%');
  console.log('  Task Completion: ' + taskCompletion + '%');
  console.log('  Project Progress Field: ' + (project.progress || 0) + '%');

  if (stageCompletion !== (project.progress || 0)) {
    console.log('  ! MISMATCH: Stage completion (' + stageCompletion + '%) != Project progress (' + (project.progress || 0) + '%)');
  } else {
    console.log('  OK - Stage completion matches project progress');
  }

  // 6. Overall workflow status check
  console.log('\n  -- OVERALL WORKFLOW STATUS --------------------------------\n');
  const wfStatus = (wf.status || wf.workflowStatus || '').toUpperCase();
  console.log('  Workflow Status: ' + (wf.status || 'N/A'));
  console.log('  Current Stage: ' + (wf.currentStage || wf.currentStageId || 'N/A'));

  if (stageCompletion === 100 && (project.status || '').toUpperCase() !== 'COMPLETED') {
    issues.push('All stages completed but project status is "' + project.status + '" (should be COMPLETED)');
  }

  if (stageCompletion < 100 && (project.status || '').toUpperCase() === 'COMPLETED') {
    issues.push('Project marked COMPLETED but only ' + stageCompletion + '% of stages are done');
  }

  // Re-print issues if we found more
  if (issues.length > 0) {
    console.log('\n  -- ALL ISSUES (FINAL) -------------------------------------\n');
    issues.forEach((issue, i) => console.log('  ' + (i + 1) + '. ' + issue));
  } else {
    console.log('\n  OK - ALL CHECKS PASSED!');
  }

  console.log('\n===============================================================\n');
}

main().catch((e) => console.error('Audit failed:', e));