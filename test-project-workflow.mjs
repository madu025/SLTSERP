// End-to-end test: Create Project → Walk through all workflow stages → Verify progress
// 
// This simulates a real user creating project "FOSP_SLTS_2026_001" and completing
// every stage step-by-step (tasks, checklists, approvals, stage transitions)

const BASE = 'http://localhost:3000';
let COOKIE = '';

async function api(method, path, body = null) {
  const opts = { method, headers: {} };
  if (COOKIE) opts.headers['Cookie'] = COOKIE;
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const cookies = res.headers.getSetCookie?.() || res.headers.get('set-cookie')?.split(',') || [];
  for (const c of cookies) {
    const parts = c.split(';')[0];
    if (parts.startsWith('token=')) COOKIE = parts;
  }
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { status: res.status, data, cookie: COOKIE ? '✓' : '✗' };
}

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log('  FOSP_SLTS_2026_001 - COMPLETE WORKFLOW TEST');
  console.log('══════════════════════════════════════════════\n');

  // ═══════ STEP 1: LOGIN ═══════
  console.log('--- STEP 1: Login as Admin ---');
  let r = await api('POST', '/api/login', { username: 'admin', password: 'Admin@123' });
  console.log(`  Login: status=${r.status}, auth=${r.cookie}`);
  if (r.status !== 200) { console.log('  ❌ Login failed!'); return; }
  console.log('  ✅ Logged in as Super Admin\n');

  // ═══════ STEP 2: GET PROJECT TYPES ═══════
  console.log('--- STEP 2: Fetch Project Types ---');
  r = await api('GET', '/api/projects/types');
  const types = Array.isArray(r.data) ? r.data : [];
  console.log(`  Found ${types.length} project types:`, types.map(t => t.name).join(', '));
  const clusterType = types.find(t => t.name === 'CLUSTER_DEVELOPMENT');
  if (!clusterType) { console.log('  ❌ CLUSTER_DEVELOPMENT type not found!'); return; }
  console.log(`  ✅ Using: ${clusterType.name} (${clusterType.id})\n`);

  // ═══════ STEP 3: CHECK EXISTING PROJECT ═══════
  console.log('--- STEP 3: Check Existing Project ---');
  r = await api('GET', '/api/projects?projectCode=FOSP_SLTS_2026_001');
  let projectId;
  if (Array.isArray(r.data) && r.data.length > 0) {
    projectId = r.data[0].id;
    console.log(`  Found existing project: ${r.data[0].name} (${r.data[0].id})`);
    console.log(`  Status: ${r.data[0].status}, Progress: ${r.data[0].progress}%`);
    console.log('  ✅ Using existing project\n');
  } else {
    // CREATE
    console.log('  Creating new project...');
    r = await api('POST', '/api/projects', {
      projectCode: 'FOSP_SLTS_2026_001',
      name: 'KL-SVK-0567 Cluster Fiber Development',
      description: 'Greenfield FTTH cluster development - Kolonnawa area',
      type: 'OSP_FTTH',
      location: 'Kolonnawa, Sri Lanka',
      budget: '5000000',
      startDate: '2026-06-01',
      endDate: '2026-12-31',
      projectTypeId: clusterType.id,
    });
    if (r.status === 201 || r.status === 200) {
      projectId = r.data.id;
      console.log(`  Created: ${r.data.name} (${r.data.id})`);
      console.log(`  Status: ${r.data.status}, Progress: ${r.data.progress}%`);
      console.log('  ✅ Project created\n');
    } else {
      console.log(`  ❌ Create failed: ${JSON.stringify(r.data).substring(0, 200)}`);
      return;
    }
  }

  // ═══════ STEP 4: FETCH WORKFLOW ═══════
  console.log('--- STEP 4: Fetch Workflow Instance ---');
  r = await api('GET', `/api/projects/${projectId}/workflow`);
  if (r.status !== 200) {
    console.log(`  ❌ Failed: ${JSON.stringify(r.data).substring(0, 200)}`);
    return;
  }
  const workflow = r.data;
  const stages = workflow.stages || [];
  console.log(`  Workflow: ${stages.length} stages, currentStageId: ${workflow.currentStageId}`);
  stages.forEach((s, i) => {
    const marker = s.status === 'IN_PROGRESS' ? '▶' : s.status === 'COMPLETED' ? '✓' : '○';
    console.log(`    ${marker} Stage ${s.sequence}: ${s.name} [${s.status}] tasks:${s.tasks?.length || 0} checks:${s.checklists?.length || 0} approvals:${s.approvals?.length || 0}`);
  });
  console.log('');

  // ═══════ STEP 5: WALK THROUGH EACH STAGE ═══════
  for (const stage of stages) {
    if (stage.status === 'COMPLETED') {
      console.log(`--- Stage ${stage.sequence}: ${stage.name} [Already COMPLETED ✓] ---\n`);
      continue;
    }
    
    // Only process the current IN_PROGRESS stage
    if (stage.status !== 'IN_PROGRESS') continue;

    console.log(`═══════ STAGE ${stage.sequence}: ${stage.name} ═══════`);
    console.log(`  Gates: approval=${stage.reqApproval} checklist=${stage.reqChecklist} photos=${stage.reqPhotos} materials=${stage.reqMaterials} documents=${stage.reqDocuments} otdr=${stage.reqOTDR} gps=${stage.reqGPS}\n`);

    // 5a. Complete all tasks
    if (stage.tasks && stage.tasks.length > 0) {
      console.log(`  --- Completing ${stage.tasks.length} tasks ---`);
      for (const task of stage.tasks) {
        r = await api('POST', `/api/projects/${projectId}/workflow/tasks`, {
          action: 'update_task',
          taskId: task.id,
          status: 'COMPLETED',
          progress: 100
        });
        const icon = r.status === 200 ? '✅' : '❌';
        console.log(`    ${icon} Task: ${task.name} → COMPLETED`);
      }
    }

    // 5b. Complete all mandatory checklists (and add photos if required)
    if (stage.checklists && stage.checklists.length > 0) {
      console.log(`  --- Completing ${stage.checklists.length} checklist items ---`);
      for (const item of stage.checklists) {
        const photoUrl = stage.reqPhotos && item.isMandatory ? 'https://example.com/photo.jpg' : undefined;
        r = await api('POST', `/api/projects/${projectId}/workflow/tasks`, {
          action: 'update_checklist',
          checklistId: item.id,
          isCompleted: true,
          photoUrl
        });
        const icon = r.status === 200 ? '✅' : '❌';
        const withPhoto = photoUrl ? ' (with photo)' : '';
        console.log(`    ${icon} Checklist: ${item.label} → COMPLETED${withPhoto}`);
      }
    }

    // 5c. Approve all approvals
    if (stage.approvals && stage.approvals.length > 0) {
      console.log(`  --- Submitting ${stage.approvals.length} approvals ---`);
      for (const approval of stage.approvals) {
        r = await api('POST', `/api/projects/${projectId}/workflow/approvals`, {
          approvalId: approval.id,
          status: 'APPROVED',
          userId: 'system-test',
          comments: 'Passed gate check'
        });
        const icon = r.status === 200 ? '✅' : '❌';
        console.log(`    ${icon} Approval L${approval.level} (${approval.role}) → APPROVED`);
      }
    }

    // 5d. Validate stage completion (gates check)
    console.log(`\n  --- Validating stage gate completion ---`);
    r = await api('GET', `/api/projects/${projectId}/workflow`);
    if (r.status === 200) {
      const updatedStage = r.data.stages?.find(s => s.id === stage.id);
      if (updatedStage) {
        const incompleteTasks = updatedStage.tasks?.filter(t => t.status !== 'COMPLETED').length || 0;
        const incompleteChecks = updatedStage.checklists?.filter(c => c.isMandatory && !c.isCompleted).length || 0;
        const unapproved = updatedStage.approvals?.filter(a => a.status !== 'APPROVED').length || 0;
        console.log(`    Incomplete tasks: ${incompleteTasks}`);
        console.log(`    Incomplete mandatory checklists: ${incompleteChecks}`);
        console.log(`    Unapproved approvals: ${unapproved}`);
        
        if (incompleteTasks === 0 && incompleteChecks === 0 && unapproved === 0) {
          console.log('    ✅ All gates PASSED');
          
          // 5e. Transition stage to COMPLETED
          console.log(`  --- Transitioning stage to COMPLETED ---`);
          r = await api('POST', `/api/projects/${projectId}/workflow/stages`, {
            stageId: stage.id,
            status: 'COMPLETED',
            userId: 'system-test'
          });
          if (r.status === 200) {
            console.log(`    ✅ Stage ${stage.sequence} "${stage.name}" → COMPLETED`);
            
            // 5f. Check if next stage activated
            r = await api('GET', `/api/projects/${projectId}/workflow`);
            if (r.status === 200) {
              const nextStage = r.data.stages?.find(s => s.sequence === stage.sequence + 1);
              if (nextStage) {
                console.log(`    ▶ Next stage: ${nextStage.name} → ${nextStage.status}`);
              }
            }

            // 5g. Check project progress
            r = await api('GET', `/api/projects/${projectId}`);
            if (r.status === 200) {
              const progress = r.data.progress;
              const expected = Math.round((stage.sequence / stages.length) * 100);
              console.log(`    📊 Project Progress: ${progress}% (expected ~${expected}%)\n`);
            }
          } else {
            console.log(`    ❌ Transition failed: ${JSON.stringify(r.data)}\n`);
          }
        } else {
          console.log(`    ❌ Gates NOT passed\n`);
        }
      }
    }
  }

  // ═══════ STEP 6: FINAL VERIFICATION ═══════
  console.log('══════════════════════════════════════════════');
  console.log('  FINAL VERIFICATION');
  console.log('══════════════════════════════════════════════');
  
  r = await api('GET', `/api/projects/${projectId}`);
  if (r.status === 200) {
    const p = r.data;
    console.log(`  Project: ${p.name}`);
    console.log(`  Code: ${p.projectCode}`);
    console.log(`  Status: ${p.status}`);
    console.log(`  Progress: ${p.progress}%`);
    console.log(`  Budget: ${p.budget}`);
    console.log(`  Actual Cost: ${p.actualCost}`);
  }

  r = await api('GET', `/api/projects/${projectId}/workflow`);
  if (r.status === 200) {
    const stages = r.data.stages || [];
    const completed = stages.filter(s => s.status === 'COMPLETED').length;
    const inProgress = stages.filter(s => s.status === 'IN_PROGRESS').length;
    const pending = stages.filter(s => s.status === 'PENDING').length;
    console.log(`\n  Stage Summary: ${completed}/${stages.length} completed, ${inProgress} in-progress, ${pending} pending`);
    stages.forEach(s => {
      const icon = s.status === 'COMPLETED' ? '✅' : s.status === 'IN_PROGRESS' ? '▶️' : '⏳';
      console.log(`    ${icon} ${s.sequence}. ${s.name} → ${s.status}`);
    });
  }
  
  console.log('\n🎉 WORKFLOW TEST COMPLETE!');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });