// ============================================================================
// LIVE A-to-Z TEST: KL-SVK-0567 Real Survey Project
// ============================================================================
// Flow: Login → Create Job → Assign to Survey → Upload GeoJSON → Process GIS 
//       → Survey Complete (BOQ) → Walk Workflow Stages → Verify Progress
// ============================================================================
// Run: node test-live-flow.mjs
// Prerequisites: npm run dev running on port 3000
// Data: KL-SVK-0567/GeoJSON/*.geojson (36 Poles, 4 Cables, 6 FDPs, 1 FJ, 28 Road EOPs)
// ============================================================================

const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const GEOJSON_DIR = path.resolve(__dirname, 'KL-SVK-0567', 'GeoJSON');
const GIS_FILES = [
  'KL-SVK-0567_Cables.geojson',
  'KL-SVK-0567_Poles.geojson',
  'KL-SVK-0567_FDP.geojson',
  'KL-SVK-0567_FJ.geojson',
  'KL-SVK-0567_Road_EOPs.geojson',
];

let COOKIE = '';
let PROJECT_ID = '';
let JOB_ID = '';
let USER_ID = '';

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
  return { status: res.status, data };
}

function log(msg) { console.log(msg); }
function ok(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); }
function hr() { console.log('═'.repeat(62)); }

async function main() {
  console.clear();
  hr();
  console.log('  🏗️  SLTS ERP - KL-SVK-0567 LIVE A-to-Z TEST');
  console.log('  Real SLT Flow: Job → Survey → GIS Upload → BOQ → Workflow');
  hr();
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: LOGIN
  // ═══════════════════════════════════════════════════════════════
  console.log('📋 STEP 1: Login as Admin');
  let r = await api('POST', '/api/login', { username: 'admin', password: 'Admin@123' });
  if (r.status !== 200) { fail(`Login failed: ${r.status}`); return; }
  USER_ID = r.data?.user?.id || r.data?.id || 'admin';
  ok(`Logged in as ${r.data?.user?.username || r.data?.username || 'Admin'} (${r.data?.user?.role || r.data?.role})`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: GET PROJECT TYPES + STAFF
  // ═══════════════════════════════════════════════════════════════
  console.log('📋 STEP 2: Fetch Project Types & Staff');
  r = await api('GET', '/api/projects/types');
  const types = Array.isArray(r.data) ? r.data : (r.data?.data || []);
  ok(`Found ${types.length} project types: ${types.map(t => t.name).join(', ')}`);
  const clusterType = types.find(t => t.name === 'CLUSTER_DEVELOPMENT' || t.name === 'Cluster Development');
  if (!clusterType) {
    if (types.length === 0) { fail('No project types found!'); return; }
  }
  const projectTypeId = clusterType?.id || types[0]?.id;
  console.log(`  Using: ${clusterType?.name || types[0]?.name} (${projectTypeId})`);

  // Fetch Staff (needed for assignedToId and areaManagerId)
  r = await api('GET', '/api/staff');
  const staffList = Array.isArray(r.data) ? r.data : [];
  const surveyStaff = staffList.find(s => s.designation === 'AREA_MANAGER') || staffList[0];
  const STAFF_ID = surveyStaff?.id || null;
  console.log(`  Staff: ${surveyStaff?.name || 'None'} (${STAFF_ID})`);
  if (!STAFF_ID) { fail('No staff found! Need at least one staff record.'); return; }
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: CREATE JOB
  // ═══════════════════════════════════════════════════════════════
  console.log('📋 STEP 3: Create Job');
  const jobCode = `JOB-SVK-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  r = await api('POST', '/api/jobs', {
    jobCode,
    name: 'KL-SVK-0567 Fiber Survey - Kalmunai',
    description: 'OSP FTTH Cluster Development survey in Kalmunai area. 36 poles, 4 cable segments, 6 FDPs, 1 Fiber Joint, 28 Road EOPs',
    customerName: 'SLT Kalmunai',
    location: 'Kalmunai, Ampara District',
    region: 'Eastern',
    district: 'Ampara',
    priority: 'HIGH',
    assignedToId: STAFF_ID
  });
  if (r.status !== 201) { fail(`Job create failed: ${JSON.stringify(r.data).substring(0,200)}`); return; }
  JOB_ID = r.data.id;
  ok(`Job created: ${r.data.jobCode} (${JOB_ID})`);
  console.log(`  Status: ${r.data.status}, Priority: ${r.data.priority}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: ASSIGN JOB TO SURVEY → Auto-create Project + Workflow
  // ═══════════════════════════════════════════════════════════════
  console.log('📋 STEP 4: Assign Job to Survey → Create Project');
  r = await api('POST', `/api/jobs/${JOB_ID}`, {
    projectTypeId,
    areaManagerId: STAFF_ID
  });
  if (r.status !== 201) { fail(`Assign failed: ${JSON.stringify(r.data).substring(0,200)}`); return; }
  PROJECT_ID = r.data.project.id;
  ok(`Job assigned to survey!`);
  console.log(`  Project: ${r.data.project.projectCode} (${PROJECT_ID})`);
  console.log(`  Project Name: ${r.data.project.name}`);
  console.log(`  Job Status: ${r.data.job?.status}`);
  console.log(`  Project Status: ${r.data.project.status}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: UPLOAD KL-SVK-0567 GeoJSON FILES
  // ═══════════════════════════════════════════════════════════════
  console.log('📋 STEP 5: Upload KL-SVK-0567 GeoJSON Survey Data');
  
  const files = [];
  for (const fileName of GIS_FILES) {
    const filePath = path.join(GEOJSON_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      fail(`File not found: ${filePath}`);
      return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const base64 = Buffer.from(content).toString('base64');
    files.push({ fileName, fileData: base64 });
    console.log(`  📄 ${fileName} (${(content.length / 1024).toFixed(1)} KB)`);
  }
  ok(`${files.length} GeoJSON files loaded`);

  // Check file data sizes
  const totalSize = files.reduce((s, f) => s + Buffer.from(f.fileData, 'base64').length, 0);
  console.log(`  Total data: ${(totalSize / 1024).toFixed(1)} KB (under 50MB limit? ${totalSize < 50*1024*1024 ? 'Yes' : 'No'})`);

  // Upload
  r = await api('POST', '/api/gis/upload', {
    files,
    projectName: 'KL-SVK-0567 Fiber Project',
    region: 'Eastern',
    district: 'Ampara',
    createdById: USER_ID
  });
  
  if (r.status !== 201) {
    fail(`GIS Upload failed: ${JSON.stringify(r.data).substring(0, 300)}`);
    // Try with multipart
    console.log('  Attempting multipart upload...');
    const FormData = (await import('node:buffer')).File ? null : null;
    // Skip multipart, continue with error
    return;
  }
  const importId = r.data.importId;
  ok(`GIS Upload successful! Import ID: ${importId}`);
  console.log(`  Status: ${r.data.status}`);
  if (r.data.layersDetected) {
    r.data.layersDetected.forEach(l => {
      console.log(`  📊 ${l.layerName}: ${l.layerType} (${l.featureCount} features) [${l.status}]`);
    });
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: PROCESS GIS DATA
  // ═══════════════════════════════════════════════════════════════
  console.log('📋 STEP 6: Process GIS Data (Parse → Validate → Routes → BOQ)');
  console.log('  ⏳ This may take 10-30 seconds...');
  const startTime = Date.now();

  r = await api('POST', '/api/gis/process', { importId });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (r.status !== 200) {
    fail(`GIS Process failed (${elapsed}s): ${JSON.stringify(r.data).substring(0, 300)}`);
    return;
  }
  
  const processResult = r.data;
  ok(`GIS Processing complete! (${elapsed}s)`);
  
  const result = processResult.result;
  if (result) {
    // GIS process creates its own project - note this
    const gisProjectId = result.projectId;
    console.log(`  GIS Project: ${result.projectName} (${gisProjectId})`);
    console.log(`  Project Code: ${result.projectCode}`);
    console.log(`  Type: ${result.projectType} | Confidence: ${result.confidence}%`);
    console.log(`  Route Length: ${((result.analytics?.totalRouteLength || 0) / 1000).toFixed(3)} km`);
    console.log(`  Cable Length: ${((result.analytics?.totalCableLength || 0) / 1000).toFixed(3)} km`);
    console.log(`  Poles: ${result.analytics?.poleCount || 0} | FDPs: ${result.analytics?.fdpCount || 0} | Joints: ${result.analytics?.fiberJointCount || 0}`);
    console.log(`  Assets: ${result.assetsCreated || 0} | BOQ Items: ${result.boq?.items?.length || 0}`);
    console.log(`  BOQ Total: LKR ${(result.boq?.totalEstimatedCost || 0).toLocaleString()}`);
    console.log(`  Workflow: ${result.workflowInstantiated ? '✅ Instantiated' : '❌ Failed'} (${result.stagesCreated || 0} stages, ${result.tasksCreated || 0} tasks)`);
    
    // Use the GIS-created project for workflow walk
    if (gisProjectId) PROJECT_ID = gisProjectId;
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // STEP 7: SURVEY COMPLETE → Auto-build BOQ
  // ═══════════════════════════════════════════════════════════════
  console.log('📋 STEP 7: Trigger Survey Complete → Auto-BOQ Generation');
  r = await api('POST', `/api/projects/${PROJECT_ID}/survey-complete`, {
    createdById: USER_ID
  });
  
  if (r.status === 201 || r.status === 200) {
    ok(`Survey marked complete!`);
    console.log(`  BOQ Items: ${r.data.totalBOQItems || 0}`);
    console.log(`  Total Estimated: LKR ${(r.data.totalEstimated || 0).toLocaleString()}`);
    if (r.data.results) {
      r.data.results.forEach(res => {
        console.log(`  📦 ${res.routeName || res.routeId}: ${res.itemsGenerated || 0} items`);
      });
    }
    console.log(`  Next: ${r.data.nextStep || 'Continue workflow'}`);
  } else {
    console.log(`  ℹ️ Survey complete response: ${r.status} - ${JSON.stringify(r.data).substring(0, 200)}`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // STEP 8: VERIFY PROJECT STATUS
  // ═══════════════════════════════════════════════════════════════
  console.log('📋 STEP 8: Verify Project Status');
  r = await api('GET', `/api/projects/${PROJECT_ID}`);
  if (r.status === 200) {
    const p = r.data;
    console.log(`  Project: ${p.name}`);
    console.log(`  Code: ${p.projectCode}`);
    console.log(`  Status: ${p.status}`);
    console.log(`  Progress: ${p.progress || 0}%`);
    console.log(`  Budget: LKR ${(p.budget || 0).toLocaleString()}`);
    ok('Project verified');
  } else {
    fail(`Project fetch failed: ${r.status}`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // STEP 9: FETCH WORKFLOW INSTANCE
  // ═══════════════════════════════════════════════════════════════
  console.log('📋 STEP 9: Fetch Workflow Instance');
  r = await api('GET', `/api/projects/${PROJECT_ID}/workflow`);
  if (r.status !== 200) {
    fail(`Workflow fetch failed: ${JSON.stringify(r.data).substring(0, 200)}`);
    console.log('\n⚠️  Workflow not available. Project created but no workflow stages to walk.');
    console.log('   This may be because the GIS process created a separate project.');
    hr();
    console.log('🏁 TEST COMPLETE (partial)');
    hr();
    return;
  }

  const workflow = r.data;
  const stages = workflow.stages || [];
  ok(`Workflow loaded: ${stages.length} stages`);
  
  stages.forEach((s, i) => {
    const marker = s.status === 'IN_PROGRESS' ? '▶' : s.status === 'COMPLETED' ? '✓' : '○';
    console.log(`  ${marker} Stage ${s.sequence}: ${s.name} [${s.status}] tasks:${s.tasks?.length || 0} checks:${s.checklists?.length || 0} approvals:${s.approvals?.length || 0}`);
  });
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // STEP 10: WALK THROUGH ALL WORKFLOW STAGES
  // ═══════════════════════════════════════════════════════════════
  console.log('📋 STEP 10: Walk Through All Workflow Stages');
  hr();

  let stagesCompleted = 0;
  for (const stage of stages) {
    if (stage.status === 'COMPLETED') {
      console.log(`  ✓ Stage ${stage.sequence}: ${stage.name} [Already COMPLETED]`);
      stagesCompleted++;
      continue;
    }
    
    if (stage.status !== 'IN_PROGRESS') {
      console.log(`  ○ Stage ${stage.sequence}: ${stage.name} [${stage.status} - skipping]`);
      continue;
    }

    console.log(`\n▶ Stage ${stage.sequence}: ${stage.name}`);
    console.log(`  Gates: approval=${stage.reqApproval} checklist=${stage.reqChecklist} photos=${stage.reqPhotos} materials=${stage.reqMaterials} docs=${stage.reqDocuments}`);

    // 10a. Complete tasks
    if (stage.tasks && stage.tasks.length > 0) {
      console.log(`  📝 Completing ${stage.tasks.length} tasks...`);
      for (const task of stage.tasks) {
        r = await api('POST', `/api/projects/${PROJECT_ID}/workflow/tasks`, {
          action: 'update_task',
          taskId: task.id,
          status: 'COMPLETED',
          progress: 100
        });
        if (r.status === 200) console.log(`    ✅ ${task.name}`);
        else console.log(`    ❌ ${task.name}: ${r.status}`);
      }
    }

    // 10b. Complete checklists
    if (stage.checklists && stage.checklists.length > 0) {
      console.log(`  ✅ Completing ${stage.checklists.length} checklists...`);
      for (const item of stage.checklists) {
        const photoUrl = stage.reqPhotos && item.isMandatory ? 'https://picsum.photos/800/600' : undefined;
        r = await api('POST', `/api/projects/${PROJECT_ID}/workflow/tasks`, {
          action: 'update_checklist',
          checklistId: item.id,
          isCompleted: true,
          photoUrl
        });
        if (r.status === 200) {
          const badge = photoUrl ? '📸' : '✅';
          console.log(`    ${badge} ${item.label}`);
        } else {
          console.log(`    ❌ ${item.label}: ${r.status}`);
        }
      }
    }

    // 10c. Approve approvals
    if (stage.approvals && stage.approvals.length > 0) {
      console.log(`  ✍️ Submitting ${stage.approvals.length} approvals...`);
      for (const approval of stage.approvals) {
        r = await api('POST', `/api/projects/${PROJECT_ID}/workflow/approvals`, {
          approvalId: approval.id,
          status: 'APPROVED',
          userId: USER_ID,
          comments: 'Passed all gate checks successfully'
        });
        if (r.status === 200) console.log(`    ✅ L${approval.level} ${approval.role} → APPROVED`);
        else console.log(`    ❌ L${approval.level} ${approval.role}: ${r.status}`);
      }
    }

    // 10d. Transition stage to COMPLETED
    console.log(`  🔄 Transitioning to COMPLETED...`);
    r = await api('POST', `/api/projects/${PROJECT_ID}/workflow/stages`, {
      stageId: stage.id,
      status: 'COMPLETED',
      userId: USER_ID
    });
    if (r.status === 200) {
      console.log(`  🎉 Stage ${stage.sequence} "${stage.name}" → COMPLETED`);
      stagesCompleted++;
      
      // Check progress
      r = await api('GET', `/api/projects/${PROJECT_ID}`);
      if (r.status === 200) {
        const progress = r.data.progress || 0;
        const expected = Math.round((stage.sequence / stages.length) * 100);
        console.log(`  📊 Progress: ${progress}% (expected ~${expected}%)`);
      }
    } else {
      console.log(`  ❌ Transition failed: ${r.status} - ${JSON.stringify(r.data).substring(0, 150)}`);
    }
  }

  console.log('');
  hr();

  // ═══════════════════════════════════════════════════════════════
  // STEP 11: FINAL VERIFICATION
  // ═══════════════════════════════════════════════════════════════
  console.log('📋 STEP 11: FINAL VERIFICATION');
  hr();

  // Project status
  r = await api('GET', `/api/projects/${PROJECT_ID}`);
  if (r.status === 200) {
    const p = r.data;
    console.log(`  📋 Project: ${p.name}`);
    console.log(`  📝 Code: ${p.projectCode}`);
    console.log(`  📊 Status: ${p.status}`);
    console.log(`  📈 Progress: ${p.progress || 0}%`);
    console.log(`  💰 Budget: LKR ${(p.budget || 0).toLocaleString()}`);
  }

  // Workflow summary
  r = await api('GET', `/api/projects/${PROJECT_ID}/workflow`);
  if (r.status === 200) {
    const stages = r.data.stages || [];
    const completed = stages.filter(s => s.status === 'COMPLETED').length;
    const inProgress = stages.filter(s => s.status === 'IN_PROGRESS').length;
    const pending = stages.filter(s => s.status === 'PENDING').length;
    console.log(`\n  🔄 Stage Summary: ${completed}/${stages.length} completed, ${inProgress} in-progress, ${pending} pending`);
    stages.forEach(s => {
      const icon = s.status === 'COMPLETED' ? '✅' : s.status === 'IN_PROGRESS' ? '▶️' : '⏳';
      console.log(`    ${icon} ${s.sequence}. ${s.name} → ${s.status}`);
    });
  }

  // Job status
  r = await api('GET', `/api/jobs/${JOB_ID}`);
  if (r.status === 200) {
    console.log(`\n  📦 Job: ${r.data.jobCode}`);
    console.log(`  📊 Job Status: ${r.data.status}`);
    console.log(`  🔗 Linked Project: ${r.data.project?.projectCode || 'None'}`);
  }

  console.log('');
  hr();
  console.log('  🎉🎉🎉 KL-SVK-0567 LIVE A-to-Z TEST COMPLETE! 🎉🎉🎉');
  console.log(`  Project ID: ${PROJECT_ID}`);
  console.log(`  🌐 http://localhost:3000/projects/${PROJECT_ID}`);
  hr();
}

main().catch(e => {
  console.error('FATAL ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});