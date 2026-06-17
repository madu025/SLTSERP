// ============================================================================
// COMPREHENSIVE SIMULATION + CROSS-TAB AUDIT
// ============================================================================
// Deepseek Prompt Engineering Principles Applied:
//   1. Sequential atomic phases with clear boundaries
//   2. Deterministic pass/fail assertions per tab
//   3. Full cleanup before re-run (no state leakage)
//   4. Detailed diagnostic hints on failure
//   5. Final report card with pass/fail counts
// ============================================================================
// Run: node simulate-and-audit.mjs
// Prerequisites: Next.js dev server running on localhost:3000
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ──────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const GEOJSON_DIR = path.join(__dirname, 'KL-SVK-0567', 'GeoJSON');

const GIS_FILES = [
  'KL-SVK-0567_Cables.geojson',
  'KL-SVK-0567_Poles.geojson',
  'KL-SVK-0567_FDP.geojson',
  'KL-SVK-0567_FJ.geojson',
  'KL-SVK-0567_Road_EOPs.geojson',
];

const ADMIN_CREDS = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASS || 'Admin@123',
};

// ─── State ──────────────────────────────────────────────────────────────────

let AUTH_COOKIE = '';
let PROJECT_ID = '';
let PROJECT_CODE = '';
let IMPORT_ID = '';

// ─── Audit Results ──────────────────────────────────────────────────────────

const AUDIT = []; // { tab, check, expected, actual, pass }

function record(tab, check, expected, actual, pass) {
  AUDIT.push({ tab, check, expected, actual, pass });
  const icon = pass ? '✅' : '❌';
  console.log(`     ${icon} ${check}: expected="${expected}", actual="${actual}"`);
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function log(emoji, msg) {
  console.log(`[${ts()}] ${emoji}  ${msg}`);
}

function banner(text) {
  const line = '═'.repeat(64);
  console.log(`\n${line}`);
  console.log(`  ${text}`);
  console.log(`${line}\n`);
}

function phaseBanner(n, text) {
  const line = '━'.repeat(64);
  console.log(`\n${line}`);
  console.log(`  PHASE ${n}: ${text}`);
  console.log(`${line}`);
}

// ─── API Client ─────────────────────────────────────────────────────────────

async function api(method, path, body = null, isFormData = false) {
  const opts = { method, headers: {} };
  if (AUTH_COOKIE) opts.headers['Cookie'] = AUTH_COOKIE;
  if (body) {
    if (isFormData) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);

  // Capture cookie from Set-Cookie header
  const rawCookies = res.headers.getSetCookie?.() || [];
  if (rawCookies.length === 0) {
    const sc = res.headers.get('set-cookie');
    if (sc) rawCookies.push(...sc.split(','));
  }
  for (const c of rawCookies) {
    const parts = c.split(';')[0];
    if (parts.startsWith('token=')) AUTH_COOKIE = parts;
  }

  let data;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

// ─── Phase 0: Cleanup ──────────────────────────────────────────────────────

async function phase0_cleanup() {
  phaseBanner(0, 'CLEANUP — Delete ALL existing projects');

  // Fetch all projects
  log('🔍', 'Fetching all projects...');
  let r = await api('GET', '/api/projects');
  
  // Try alternative endpoint if needed
  if (r.status !== 200) {
    log('⚠️', `/api/projects returned ${r.status}, trying /api/projects?all=true...`);
    r = await api('GET', '/api/projects?all=true');
  }

  if (r.status !== 200) {
    log('⚠️', `Cannot list projects (${r.status}), skipping cleanup`);
    console.log(`     Response: ${JSON.stringify(r.data).substring(0, 500)}`);
    return;
  }

  let projects = [];
  if (Array.isArray(r.data)) {
    projects = r.data;
  } else if (r.data.projects && Array.isArray(r.data.projects)) {
    projects = r.data.projects;
  } else if (r.data.data && Array.isArray(r.data.data)) {
    projects = r.data.data;
  } else if (Array.isArray(r.data.items)) {
    projects = r.data.items;
  } else {
    log('⚠️', `Unexpected project list format, skipping cleanup`);
    console.log(`     Keys: ${Object.keys(r.data).join(', ')}`);
    return;
  }

  log('📋', `Found ${projects.length} project(s)`);

  // Delete each project
  let deleted = 0;
  for (const p of projects) {
    const pid = p.id || p.projectId;
    if (!pid) continue;
    log('🗑️', `Deleting project: ${p.name || p.projectCode || pid}...`);
    const dr = await api('DELETE', `/api/projects?id=${pid}`);
    if (dr.status === 200 || dr.status === 204) {
      deleted++;
      log('   ✅', 'Deleted');
    } else {
      log('   ⚠️', `Delete returned ${dr.status}: ${JSON.stringify(dr.data).substring(0, 100)}`);
    }
  }

  log('✅', `Cleanup complete: ${deleted}/${projects.length} projects deleted`);

  // Verify 0 projects remain
  r = await api('GET', '/api/projects');
  let remaining = [];
  if (Array.isArray(r.data)) remaining = r.data;
  else if (r.data.projects) remaining = r.data.projects;
  else if (r.data.data) remaining = r.data.data;
  else if (r.data.items) remaining = r.data.items;
  log('🔍', `Post-cleanup check: ${remaining.length} project(s) remaining`);
}

// ─── Phase 1: Login ────────────────────────────────────────────────────────

async function phase1_login() {
  phaseBanner(1, 'AUTHENTICATION');
  log('🔑', `Logging in as "${ADMIN_CREDS.username}"...`);
  const r = await api('POST', '/api/login', ADMIN_CREDS);
  if (r.status !== 200) {
    log('❌', `Login failed (${r.status})`);
    process.exit(1);
  }
  log('✅', `Authenticated as ${r.data.user?.role || '?'} — ${r.data.user?.username}`);
}

// ─── Phase 2: Upload GeoJSON ───────────────────────────────────────────────

async function phase2_upload() {
  phaseBanner(2, 'UPLOAD GEOJSON FILES');

  const files = [];
  for (const fileName of GIS_FILES) {
    const filePath = path.join(GEOJSON_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      log('⚠️', `File not found: ${filePath} — skipping`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    files.push({
      fileName,
      fileData: Buffer.from(content).toString('base64'),
    });
    const sizeKB = (content.length / 1024).toFixed(1);
    let featureHint = '';
    try {
      const parsed = JSON.parse(content);
      const fc = parsed.features?.length || parsed.geometries?.length || '?';
      featureHint = ` (${fc} features)`;
    } catch {}
    log('📄', `${fileName} — ${sizeKB} KB${featureHint}`);
  }

  log('📤', `Uploading ${files.length} files...`);
  const r = await api('POST', '/api/gis/upload', {
    files,
    projectName: 'KL-SVK-0567 Cluster Fiber Development',
    region: 'Western',
    district: 'Kolonnawa',
    createdById: 'simulation-test',
  });

  if (r.status !== 201) {
    log('❌', `Upload failed (${r.status}): ${JSON.stringify(r.data).substring(0, 500)}`);
    process.exit(1);
  }

  IMPORT_ID = r.data.importId;
  log('✅', `Upload successful — Import ID: ${IMPORT_ID}`);
}

// ─── Phase 3: Process GIS Pipeline ──────────────────────────────────────────

async function phase3_process() {
  phaseBanner(3, 'PROCESS GIS PIPELINE');

  log('⚙️', 'Processing (parse → validate → project → BOQ → assets → workflow)...');
  log('⏳', 'This may take 10-30 seconds...');

  const startTime = Date.now();
  const r = await api('POST', '/api/gis/process', { importId: IMPORT_ID });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (r.status !== 200) {
    log('❌', `Processing failed (${r.status}): ${JSON.stringify(r.data).substring(0, 500)}`);
    process.exit(1);
  }

  const result = r.data.result;
  PROJECT_ID = result.projectId;
  PROJECT_CODE = result.projectCode;

  console.log();
  log('🎉', `Pipeline complete in ${elapsed}s`);
  console.log('   ┌──────────────────────────────────────────────────────────┐');
  console.log(`   │  Project ID:      ${(PROJECT_ID || 'N/A').padEnd(35)}│`);
  console.log(`   │  Project Code:    ${(PROJECT_CODE || 'N/A').padEnd(35)}│`);
  console.log(`   │  Type:            ${(result.projectType || 'N/A').padEnd(35)}│`);
  console.log(`   │  BOQ Items:       ${String(result.boq?.items?.length || 0).padEnd(35)}│`);
  console.log(`   │  BOQ Total:       LKR ${((result.boq?.totalEstimatedCost || 0)).toLocaleString().padEnd(28)}│`);
  console.log(`   │  Assets:          ${String(result.assetsCreated || 0).padEnd(35)}│`);
  console.log(`   │  Survey Tasks:    ${String(result.surveyTasksCreated || 0).padEnd(35)}│`);
  console.log(`   │  Permits:         ${String(result.permitsCreated || 0).padEnd(35)}│`);
  console.log(`   │  Stages Created:  ${String(result.stagesCreated || 0).padEnd(35)}│`);
  console.log(`   │  Tasks Created:   ${String(result.tasksCreated || 0).padEnd(35)}│`);
  console.log(`   │  Workflow:        ${result.workflowInstantiated ? '✅ YES' : '❌ NO'}`.padEnd(54) + '│');
  console.log('   └──────────────────────────────────────────────────────────┘');
}

// ─── Phase 4: Walk Through All Workflow Stages ──────────────────────────────

async function phase4_walkWorkflow() {
  phaseBanner(4, 'WALK WORKFLOW STAGES');

  let r = await api('GET', `/api/projects/${PROJECT_ID}/workflow`);
  if (r.status !== 200) {
    log('⚠️', `Workflow fetch returned ${r.status}, skipping walk-through`);
    return;
  }

  let stages = r.data.stages || [];
  log('📋', `Workflow has ${stages.length} stage(s)`);
  stages.forEach((s) => {
    const icon = s.status === 'COMPLETED' ? '✅' : s.status === 'IN_PROGRESS' ? '▶️' : '⏳';
    log(`   ${icon} Stage ${s.sequence}: ${s.name} [${s.status}]`);
  });

  for (let stageIdx = 0; stageIdx < stages.length; stageIdx++) {
    r = await api('GET', `/api/projects/${PROJECT_ID}/workflow`);
    if (r.status !== 200) break;
    stages = r.data.stages || [];
    const stage = stages[stageIdx];
    if (!stage) break;

    if (stage.status === 'COMPLETED') {
      log('⏭️', `Stage ${stage.sequence} "${stage.name}" — already COMPLETED`);
      continue;
    }

    if (stage.status !== 'IN_PROGRESS') {
      log('⏸️', `Stage ${stage.sequence} "${stage.name}" is ${stage.status} — stopping`);
      break;
    }

    log('🔄', `Processing Stage ${stage.sequence}: "${stage.name}" (approval=${stage.reqApproval} checklist=${stage.reqChecklist} photos=${stage.reqPhotos})`);

    // Complete tasks
    const tasks = stage.tasks || [];
    for (const task of tasks) {
      if (task.status === 'COMPLETED') continue;
      r = await api('POST', `/api/projects/${PROJECT_ID}/workflow/tasks`, {
        action: 'update_task',
        taskId: task.id,
        status: 'COMPLETED',
        progress: 100,
      });
      if (r.status === 200) {
        log('   ✅', `Task "${task.name}" → COMPLETED`);
      } else {
        log('   ⚠️', `Task "${task.name}" failed (${r.status})`);
      }
    }

    // Complete checklists
    const checklists = stage.checklists || [];
    for (const item of checklists) {
      if (item.isCompleted) continue;
      const photoUrl = stage.reqPhotos && item.isMandatory
        ? 'https://simulation.test/photo-placeholder.jpg'
        : undefined;
      r = await api('POST', `/api/projects/${PROJECT_ID}/workflow/tasks`, {
        action: 'update_checklist',
        checklistId: item.id,
        isCompleted: true,
        photoUrl,
      });
      const photoTag = photoUrl ? ' 📸' : '';
      if (r.status === 200) {
        log('   ✅', `Checklist "${item.label}" → COMPLETED${photoTag}`);
      } else {
        log('   ⚠️', `Checklist "${item.label}" failed (${r.status})`);
      }
    }

    // Approve
    const approvals = stage.approvals || [];
    for (const approval of approvals) {
      if (approval.status === 'APPROVED') continue;
      r = await api('POST', `/api/projects/${PROJECT_ID}/workflow/approvals`, {
        approvalId: approval.id,
        status: 'APPROVED',
        userId: 'simulation-test',
        comments: `Auto-approved in simulation (L${approval.level})`,
      });
      if (r.status === 200) {
        log('   ✅', `Approval L${approval.level} (${approval.role}) → APPROVED`);
      } else {
        log('   ⚠️', `Approval L${approval.level} failed (${r.status})`);
      }
    }

    // Gate check
    r = await api('GET', `/api/projects/${PROJECT_ID}/workflow`);
    const updatedStages = r.status === 200 ? (r.data.stages || []) : [];
    const updatedStage = updatedStages.find(s => s.id === stage.id);
    if (updatedStage) {
      const incTasks = (updatedStage.tasks || []).filter(t => t.status !== 'COMPLETED').length;
      const incChecks = (updatedStage.checklists || []).filter(c => c.isMandatory && !c.isCompleted).length;
      const unapproved = (updatedStage.approvals || []).filter(a => a.status !== 'APPROVED').length;
      const allGreen = incTasks === 0 && incChecks === 0 && unapproved === 0;

      log('🔍', `Gate: tasks=${incTasks} checks=${incChecks} approvals=${unapproved} → ${allGreen ? 'GREEN ✅' : 'BLOCKED ❌'}`);

      if (allGreen) {
        r = await api('POST', `/api/projects/${PROJECT_ID}/workflow/stages`, {
          stageId: stage.id,
          status: 'COMPLETED',
          userId: 'simulation-test',
        });
        if (r.status === 200) {
          log('   🎯', `Stage ${stage.sequence} "${stage.name}" → COMPLETED`);
        } else {
          log('   ⚠️', `Stage transition failed (${r.status}): ${JSON.stringify(r.data).substring(0, 150)}`);
        }
      }
    }

    // Show progress
    r = await api('GET', `/api/projects/${PROJECT_ID}`);
    if (r.status === 200 && r.data.progress !== undefined) {
      log('📊', `Project progress: ${r.data.progress}%`);
    }
  }

  log('✅', 'Workflow walk-through complete');
}

// ─── Phase 5: Cross-Tab Audit ──────────────────────────────────────────────

async function phase5_audit() {
  banner('CROSS-TAB DATA AUDIT');

  // ─── 5a: Project Overview ─────────────────────────────────────────
  console.log('\n  ┌───────────────────────────┐');
  console.log('  │  TAB: Project Overview    │');
  console.log('  └───────────────────────────┘');

  const pr = await api('GET', `/api/projects/${PROJECT_ID}`);
  if (pr.status !== 200) {
    log('❌', `Cannot fetch project (${pr.status})`);
    record('Overview', 'Project API', '200', String(pr.status), false);
    return;
  }
  const p = pr.data;

  // Check 1: Status
  record('Overview', 'Status = COMPLETED', 'COMPLETED', p.status || 'null', p.status === 'COMPLETED');

  // Check 2: Progress
  const progOk = p.progress >= 100;
  record('Overview', 'Progress = 100%', '100', String(p.progress || 0), progOk);

  // Check 3: Budget
  const budgetOk = p.budget && Number(p.budget) > 0;
  record('Overview', 'Budget > 0', '> 0', String(p.budget || 'null'), budgetOk);

  // Check 4: Start Date
  const startOk = !!p.startDate;
  record('Overview', 'Start Date set', 'non-null', p.startDate || 'null', startOk);

  // Check 5: End Date
  const endOk = !!p.endDate;
  record('Overview', 'End Date set', 'non-null', p.endDate || 'null', endOk);

  // Check 6: Actual Cost
  const costOk = p.actualCost !== null && p.actualCost !== undefined;
  record('Overview', 'Actual Cost set', 'non-null', String(p.actualCost ?? 'null'), costOk);

  // Check 7: Estimated Duration
  const durOk = p.estimatedDuration > 0;
  record('Overview', 'Estimated Duration > 0', '> 0', String(p.estimatedDuration || 'null'), durOk);

  // ─── 5b: BOQ & Material ──────────────────────────────────────────
  console.log('\n  ┌───────────────────────────┐');
  console.log('  │  TAB: BOQ & Material      │');
  console.log('  └───────────────────────────┘');

  // BOQ items are included in project detail response as boqItems
  let boqItems = p.boqItems || [];
  if (boqItems.length === 0) {
    // Fallback: try separate BOQ API
    const boqR = await api('GET', `/api/projects/boq?projectId=${PROJECT_ID}`);
    if (boqR.status === 200) {
      boqItems = Array.isArray(boqR.data) ? boqR.data : (boqR.data.items || boqR.data.boqItems || []);
    }
  }
  if (boqItems.length === 0) {
    // Fallback: try GIS data
    const gisR = await api('GET', `/api/gis?projectId=${PROJECT_ID}`);
    if (gisR.status === 200 && gisR.data.boqItems) {
      boqItems = gisR.data.boqItems;
    }
  }

  const boqOk = boqItems.length > 0;
  record('BOQ', 'BOQ Items ≥ 1', '≥ 1', String(boqItems.length), boqOk);

  // ─── 5c: Milestones ──────────────────────────────────────────────
  console.log('\n  ┌───────────────────────────┐');
  console.log('  │  TAB: Milestones          │');
  console.log('  └───────────────────────────┘');

  // Milestones are included in project detail response
  let milestones = p.milestones || [];
  if (milestones.length === 0) {
    const msR = await api('GET', `/api/projects/milestones?projectId=${PROJECT_ID}`);
    if (msR.status === 200) {
      milestones = Array.isArray(msR.data) ? msR.data : (msR.data.milestones || msR.data.items || []);
    }
  }

  const msOk = milestones.length > 0;
  record('Milestones', 'Milestones ≥ 1', '≥ 1', String(milestones.length), msOk);
  if (milestones.length > 0) {
    record('Milestones', `Count: ${milestones.length}`, '≥ 1', String(milestones.length), true);
  }

  // ─── 5d: Workflow Pipeline ───────────────────────────────────────
  console.log('\n  ┌───────────────────────────┐');
  console.log('  │  TAB: Workflow Pipeline   │');
  console.log('  └───────────────────────────┘');

  const wfR = await api('GET', `/api/projects/${PROJECT_ID}/workflow`);
  if (wfR.status === 200) {
    const stages = wfR.data.stages || [];
    const completedStages = stages.filter(s => s.status === 'COMPLETED');
    const totalTasks = stages.reduce((sum, s) => sum + (s.tasks?.length || 0), 0);
    const completedTasks = stages.reduce((sum, s) => sum + (s.tasks || []).filter(t => t.status === 'COMPLETED').length, 0);

    const allStagesCompleted = stages.length > 0 && completedStages.length === stages.length;
    record('Workflow', 'All stages COMPLETED', 'ALL', `${completedStages.length}/${stages.length}`, allStagesCompleted);
    record('Workflow', 'Stage count', '7', String(stages.length), stages.length >= 7);

    if (totalTasks > 0) {
      const allTasksOk = completedTasks >= totalTasks;
      record('Workflow', 'All tasks completed', `${totalTasks}/${totalTasks}`, `${completedTasks}/${totalTasks}`, allTasksOk);
    }
  } else {
    record('Workflow', 'Workflow API accessible', '200', String(wfR.status), false);
  }

  // ─── 5e: GIS Map ─────────────────────────────────────────────────
  console.log('\n  ┌───────────────────────────┐');
  console.log('  │  TAB: GIS Map             │');
  console.log('  └───────────────────────────┘');

  const gisR = await api('GET', `/api/gis?projectId=${PROJECT_ID}`);
  if (gisR.status === 200) {
    const gis = gisR.data;
    const routes = gis.gisRoutes || [];
    let tp = 0, tc = 0, tcs = 0;
    for (const rt of routes) {
      tp += rt.poles?.length || 0;
      tc += rt.closures?.length || 0;
      tcs += rt.cableSegments?.length || 0;
    }
    const assets = gis.assets || [];
    const surveys = gis.surveys || [];
    const permits = gis.permits || [];

    record('GIS', 'Routes ≥ 1', '≥ 1', String(routes.length), routes.length >= 1);
    record('GIS', 'Poles ≥ 1', '≥ 1', String(tp), tp >= 1);
    record('GIS', 'Closures ≥ 1', '≥ 1', String(tc), tc >= 1);
    record('GIS', 'Cable Segments ≥ 1', '≥ 1', String(tcs), tcs >= 1);
    record('GIS', 'Assets ≥ 1', '≥ 1', String(assets.length), assets.length >= 1);
    record('GIS', 'Surveys ≥ 1', '≥ 1', String(surveys.length), surveys.length >= 1);
    record('GIS', 'Permits ≥ 1', '≥ 1', String(permits.length), permits.length >= 1);
  } else {
    record('GIS', 'GIS API accessible', '200', String(gisR.status), false);
  }

  // ─── 5f: Data Link Consistency Checks ────────────────────────────
  console.log('\n  ┌───────────────────────────┐');
  console.log('  │  DATA LINK CONSISTENCY    │');
  console.log('  └───────────────────────────┘');

  // Check: Budget = BOQ total
  const boqTotalFromItems = boqItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const budgetFromProject = Number(p.budget) || 0;
  const budgetSynced = boqTotalFromItems > 0 ? Math.abs(budgetFromProject - boqTotalFromItems) < 1 : true;
  record('Link', 'Budget ≈ BOQ Total', 'synced',
    `budget=${budgetFromProject}, BOQ=${boqTotalFromItems}`,
    budgetSynced);

  // Check: Progress 100 → Status COMPLETED
  if (p.progress >= 100) {
    record('Link', 'Progress≥100 → COMPLETED', 'COMPLETED', p.status, p.status === 'COMPLETED');
  }

  // Check: Status COMPLETED → endDate set
  if (p.status === 'COMPLETED') {
    record('Link', 'COMPLETED → endDate set', 'set', !!p.endDate ? 'set' : 'null', !!p.endDate);
  }
}

// ─── Phase 6: Report Card ──────────────────────────────────────────────────

async function phase6_report() {
  banner('FINAL REPORT CARD');

  const passed = AUDIT.filter(a => a.pass).length;
  const failed = AUDIT.filter(a => !a.pass).length;
  const total = AUDIT.length;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  console.log();
  console.log('  ┌───────────────────────────────────────────────────────────┐');
  console.log('  │  CROSS-TAB AUDIT RESULTS                                  │');
  console.log('  ├───────────────────────────────────────────────────────────┤');
  console.log(`  │  Total Checks:    ${String(total).padStart(4)}                                       │`);
  console.log(`  │  ✅ Passed:       ${String(passed).padStart(4)}                                       │`);
  console.log(`  │  ❌ Failed:       ${String(failed).padStart(4)}                                       │`);
  console.log(`  │  📊 Score:        ${String(pct).padStart(4)}%                                      │`);
  console.log('  ├───────────────────────────────────────────────────────────┤');
  console.log('  │                                                           │');
  console.log('  │  DETAIL BY CHECK:                                         │');
  console.log('  │                                                           │');

  for (const a of AUDIT) {
    const icon = a.pass ? '✅' : '❌';
    console.log(`  │  ${icon} [${a.tab.padEnd(14)}] ${a.check.padEnd(36)}│`);
  }

  console.log('  │                                                           │');
  console.log('  ├───────────────────────────────────────────────────────────┤');
  console.log('  │  FAILURES (if any):                                       │');

  const failures = AUDIT.filter(a => !a.pass);
  if (failures.length === 0) {
    console.log('  │     🎉  ALL CHECKS PASSED!                                │');
  } else {
    for (const f of failures) {
      console.log(`  │  ❌ [${f.tab}] ${f.check}                                  │`);
      console.log(`  │     Expected: ${f.expected}                                 │`);
      console.log(`  │     Actual:   ${f.actual}                                   │`);
    }
  }

  console.log('  │                                                           │');
  console.log('  └───────────────────────────────────────────────────────────┘');

  console.log();
  if (pct === 100) {
    console.log('  🎉🎉🎉  PERFECT SCORE — ALL CROSS-TAB DATA LINKS VERIFIED!  🎉🎉🎉');
  } else if (pct >= 80) {
    console.log(`  ✅  ${pct}% — Most data links synced. ${failed} check(s) need attention.`);
  } else {
    console.log(`  ⚠️  ${pct}% — ${failed} data link(s) broken. Review failures above.`);
  }

  console.log();
  console.log(`  🌐  GIS Map View:   ${BASE_URL}/projects/${PROJECT_ID}/gis`);
  console.log(`  📋  Project Page:   ${BASE_URL}/projects/${PROJECT_ID}`);
  console.log(`  🆔  Project ID:     ${PROJECT_ID}`);
  console.log(`  📦  Project Code:   ${PROJECT_CODE}`);
  console.log();
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.clear();
  banner('COMPREHENSIVE SIMULATION + CROSS-TAB AUDIT');
  log('🌐', `Server: ${BASE_URL}`);
  log('📁', `GeoJSON: ${GEOJSON_DIR}`);
  log('👤', `User: ${ADMIN_CREDS.username}`);
  console.log();

  try {
    await phase1_login();
    await phase0_cleanup();
    await phase2_upload();
    await phase3_process();
    await phase4_walkWorkflow();
    await phase5_audit();
    await phase6_report();
  } catch (err) {
    console.error(`\n💥 FATAL ERROR: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

main();