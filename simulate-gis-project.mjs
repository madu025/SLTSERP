// ============================================================================
// E2E Simulation Test: KL-SVK-0567 GIS Project — Full Lifecycle
// ============================================================================
// 1. Login as admin
// 2. Upload GeoJSON files from KL-SVK-0567/GeoJSON/
// 3. Process GIS data (creates project, routes, BOQ, workflow)
// 4. Walk through ALL workflow stages step-by-step
// 5. Final verification — project COMPLETED with all GIS data intact
// ============================================================================
// Run: node simulate-gis-project.mjs
// Prerequisites: Next.js dev server running on localhost:3000
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const STATS = { tasks: 0, checklists: 0, approvals: 0, stages: 0 };

// ─── Helpers ────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function log(emoji, msg) {
  console.log(`[${ts()}] ${emoji}  ${msg}`);
}

function banner(text) {
  const line = '═'.repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${text}`);
  console.log(`${line}\n`);
}

function stepBanner(n, text) {
  const pad = n < 10 ? '0' : '';
  console.log(`\n┌──────────────────────────────────────────────────────────┐`);
  console.log(`│  STEP ${pad}${n}: ${text.padEnd(49)}│`);
  console.log(`└──────────────────────────────────────────────────────────┘`);
}

// ─── API Client ─────────────────────────────────────────────────────────────

async function api(method, path, body = null) {
  const opts = { method, headers: {} };
  if (AUTH_COOKIE) opts.headers['Cookie'] = AUTH_COOKIE;
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
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

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.clear();
  banner('KL-SVK-0567 GIS PROJECT — FULL LIFECYCLE SIMULATION');
  log('📁', `GeoJSON directory: ${GEOJSON_DIR}`);
  log('🌐', `Server: ${BASE_URL}`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Login
  // ═══════════════════════════════════════════════════════════════════════
  stepBanner(1, 'Login as Admin');
  log('🔑', `Authenticating as "${ADMIN_CREDS.username}"...`);
  let r = await api('POST', '/api/login', ADMIN_CREDS);
  if (r.status !== 200) {
    log('❌', `Login failed (${r.status}): ${JSON.stringify(r.data)}`);
    process.exit(1);
  }
  log('✅', `Logged in as ${r.data.user?.role || 'Admin'} — ${r.data.user?.username}`);
  log('🍪', `Auth cookie acquired`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Upload GeoJSON Files
  // ═══════════════════════════════════════════════════════════════════════
  stepBanner(2, 'Upload GIS Files (GeoJSON)');
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
    log('📄', `${fileName}  —  ${(content.length / 1024).toFixed(1)} KB`);
    // Log a few feature hints
    try {
      const parsed = JSON.parse(content);
      const featCount = parsed.features?.length || parsed.geometries?.length || '?';
      log('   ', `  → ${featCount} feature(s)`);
    } catch {}
  }
  console.log();

  log('📤', `Uploading ${files.length} files to /api/gis/upload...`);
  r = await api('POST', '/api/gis/upload', {
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
  log('✅', `Upload successful! Import ID: ${IMPORT_ID}`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Process GIS Data → Project Created
  // ═══════════════════════════════════════════════════════════════════════
  stepBanner(3, 'Process GIS Data (Create Project + BOQ + Workflow)');
  log('⚙️', 'Processing GIS pipeline (parse → validate → project → BOQ → workflow)...');
  log('⏳', 'This may take 10-30 seconds...');

  const startTime = Date.now();
  r = await api('POST', '/api/gis/process', { importId: IMPORT_ID });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (r.status !== 200) {
    log('❌', `Processing failed (${r.status}): ${JSON.stringify(r.data).substring(0, 500)}`);
    process.exit(1);
  }

  const result = r.data.result;
  PROJECT_ID = result.projectId;
  PROJECT_CODE = result.projectCode;

  console.log();
  log('🎉', `PROCESSING COMPLETE in ${elapsed}s`);
  console.log('   ┌──────────────────────────────────────────────────────┐');
  console.log(`   │  Project ID:      ${PROJECT_ID.padEnd(35)}│`);
  console.log(`   │  Project Code:    ${PROJECT_CODE.padEnd(35)}│`);
  console.log(`   │  Project Name:    ${(result.projectName || 'N/A').padEnd(35)}│`);
  console.log(`   │  Type:            ${(result.projectType || 'FTTH').padEnd(35)}│`);
  console.log(`   │  Confidence:      ${String(result.confidence || 'N/A').padEnd(35)}│`);
  console.log(`   │  Assets Created:  ${String(result.assetsCreated || 0).padEnd(35)}│`);
  console.log(`   │  Survey Tasks:    ${String(result.surveyTasksCreated || 0).padEnd(35)}│`);
  console.log(`   │  Permits:         ${String(result.permitsCreated || 0).padEnd(35)}│`);
  console.log(`   │  BOQ Total:       LKR ${((result.boq?.totalEstimatedCost || 0)).toLocaleString().padEnd(28)}│`);
  console.log(`   │  Route Length:    ${((result.analytics?.totalRouteLength || 0) / 1000).toFixed(3)} km`.padEnd(54) + '│');
  if (result.stagesCreated) console.log(`   │  Stages Created:  ${String(result.stagesCreated).padEnd(35)}│`);
  if (result.tasksCreated) console.log(`   │  Tasks Created:   ${String(result.tasksCreated).padEnd(35)}│`);
  console.log('   └──────────────────────────────────────────────────────┘');

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Verify GIS Data
  // ═══════════════════════════════════════════════════════════════════════
  stepBanner(4, 'Verify GIS Map Data');
  r = await api('GET', `/api/gis?projectId=${PROJECT_ID}`);
  if (r.status !== 200) {
    log('⚠️', `GIS data fetch returned ${r.status}`);
  } else {
    const gisData = r.data;
    const routes = gisData.gisRoutes || [];
    const assets = gisData.assets || [];
    log('🗺️', `GIS Routes: ${routes.length}`);
    if (routes.length > 0) {
      let totalPoles = 0, totalClosures = 0, totalCables = 0, totalRoads = 0;
      for (const route of routes) {
        totalPoles += route.poles?.length || 0;
        totalClosures += route.closures?.length || 0;
        totalCables += route.cableSegments?.length || 0;
        totalRoads += route.roadSegments?.length || 0;
      }
      log('📡', `Total Poles: ${totalPoles}`);
      log('🔗', `Total Closures: ${totalClosures} (FDPs + Fiber Joints)`);
      log('🔌', `Total Cable Segments: ${totalCables}`);
      log('🛣️', `Total Road Segments: ${totalRoads}`);
    }
    log('📍', `Project Assets: ${assets.length}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 5: Fetch Workflow & Walk Through All Stages
  // ═══════════════════════════════════════════════════════════════════════
  stepBanner(5, 'Walk Through Workflow Stages');

  r = await api('GET', `/api/projects/${PROJECT_ID}/workflow`);
  if (r.status !== 200) {
    log('⚠️', `Workflow fetch returned ${r.status}: ${JSON.stringify(r.data).substring(0, 300)}`);
    log('ℹ️', 'Skipping workflow walk-through. Project may not have a workflow.');
  } else {
    const workflow = r.data;
    let stages = workflow.stages || [];

    if (stages.length === 0) {
      log('⚠️', 'No workflow stages found. Project may be using a different completion model.');
    }

    log('📋', `Workflow has ${stages.length} stage(s)`);
    stages.forEach((s, i) => {
      const icon = s.status === 'COMPLETED' ? '✅' : s.status === 'IN_PROGRESS' ? '▶️' : '⏳';
      log(`   ${icon} Stage ${s.sequence}: ${s.name} [${s.status}]`);
    });
    console.log();

    // Walk through stages
    for (let stageIdx = 0; stageIdx < stages.length; stageIdx++) {
      // Re-fetch workflow to get latest state
      r = await api('GET', `/api/projects/${PROJECT_ID}/workflow`);
      if (r.status !== 200) break;
      stages = r.data.stages || [];
      const stage = stages[stageIdx];
      if (!stage) break;

      if (stage.status === 'COMPLETED') {
        log('⏭️', `Stage ${stage.sequence} "${stage.name}" — already COMPLETED, skipping`);
        STATS.stages++;
        continue;
      }

      if (stage.status !== 'IN_PROGRESS') {
        log('⏸️', `Stage ${stage.sequence} "${stage.name}" is ${stage.status} — stopping walk-through`);
        break;
      }

      console.log(`\n  ╔════════════════════════════════════════════════════════╗`);
      console.log(`  ║  STAGE ${stage.sequence}: ${stage.name.padEnd(42)}║`);
      console.log(`  ║  Gates: approval=${stage.reqApproval} checklist=${stage.reqChecklist} photos=${stage.reqPhotos} ║`);
      console.log(`  ╚════════════════════════════════════════════════════════╝`);

      // 5a. Complete Tasks
      const tasks = stage.tasks || [];
      if (tasks.length > 0) {
        log('📝', `Completing ${tasks.length} task(s)...`);
        for (const task of tasks) {
          if (task.status === 'COMPLETED') { STATS.tasks++; continue; }
          r = await api('POST', `/api/projects/${PROJECT_ID}/workflow/tasks`, {
            action: 'update_task',
            taskId: task.id,
            status: 'COMPLETED',
            progress: 100,
          });
          if (r.status === 200) {
            STATS.tasks++;
            log('   ✅', `Task: "${task.name}" → COMPLETED`);
          } else {
            log('   ⚠️', `Task "${task.name}" update returned ${r.status}`);
          }
        }
      }

      // 5b. Complete Checklists
      const checklists = stage.checklists || [];
      if (checklists.length > 0) {
        log('☑️', `Completing ${checklists.length} checklist item(s)...`);
        for (const item of checklists) {
          if (item.isCompleted) { STATS.checklists++; continue; }
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
            STATS.checklists++;
            log('   ✅', `Checklist: "${item.label}" → COMPLETED${photoTag}`);
          } else {
            log('   ⚠️', `Checklist "${item.label}" update returned ${r.status}`);
          }
        }
      }

      // 5c. Submit Approvals
      const approvals = stage.approvals || [];
      if (approvals.length > 0) {
        log('✍️', `Submitting ${approvals.length} approval(s)...`);
        for (const approval of approvals) {
          if (approval.status === 'APPROVED') { STATS.approvals++; continue; }
          r = await api('POST', `/api/projects/${PROJECT_ID}/workflow/approvals`, {
            approvalId: approval.id,
            status: 'APPROVED',
            userId: 'simulation-test',
            comments: `Auto-approved in simulation at L${approval.level}`,
          });
          if (r.status === 200) {
            STATS.approvals++;
            log('   ✅', `Approval L${approval.level} (${approval.role}) → APPROVED`);
          } else {
            log('   ⚠️', `Approval L${approval.level} returned ${r.status}: ${JSON.stringify(r.data).substring(0, 100)}`);
          }
        }
      }

      // 5d. Verify Gates
      r = await api('GET', `/api/projects/${PROJECT_ID}/workflow`);
      const updatedStages = r.status === 200 ? (r.data.stages || []) : [];
      const updatedStage = updatedStages.find(s => s.id === stage.id);
      if (updatedStage) {
        const incTasks = (updatedStage.tasks || []).filter(t => t.status !== 'COMPLETED').length;
        const incChecks = (updatedStage.checklists || []).filter(c => c.isMandatory && !c.isCompleted).length;
        const unapproved = (updatedStage.approvals || []).filter(a => a.status !== 'APPROVED').length;
        const allGreen = incTasks === 0 && incChecks === 0 && unapproved === 0;

        log('🔍', `Gate check: tasks=${incTasks} checks=${incChecks} approvals=${unapproved} → ${allGreen ? 'ALL GREEN ✅' : 'GAPS FOUND ❌'}`);

        // 5e. Transition Stage
        if (allGreen) {
          log('🔄', `Transitioning Stage ${stage.sequence} → COMPLETED...`);
          r = await api('POST', `/api/projects/${PROJECT_ID}/workflow/stages`, {
            stageId: stage.id,
            status: 'COMPLETED',
            userId: 'simulation-test',
          });
          if (r.status === 200) {
            STATS.stages++;
            log('   ✅', `Stage ${stage.sequence} "${stage.name}" → COMPLETED`);

            // Check if next stage activated
            r = await api('GET', `/api/projects/${PROJECT_ID}/workflow`);
            if (r.status === 200) {
              const nx = (r.data.stages || []).find(s => s.sequence === stage.sequence + 1);
              if (nx) log('   ▶️', `Next stage: ${nx.name} → ${nx.status}`);
            }
          } else {
            log('   ⚠️', `Stage transition returned ${r.status}: ${JSON.stringify(r.data).substring(0, 150)}`);
          }
        }
      }

      // Check project progress
      r = await api('GET', `/api/projects/${PROJECT_ID}`);
      if (r.status === 200 && r.data.progress !== undefined) {
        log('📊', `Project progress: ${r.data.progress}%`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 6: Final Verification
  // ═══════════════════════════════════════════════════════════════════════
  stepBanner(6, 'Final Verification');

  // Project details
  r = await api('GET', `/api/projects/${PROJECT_ID}`);
  if (r.status === 200) {
    const p = r.data;
    console.log('   ┌──────────────────────────────────────────────────────┐');
    console.log(`   │  PROJECT SUMMARY                                     │`);
    console.log('   ├──────────────────────────────────────────────────────┤');
    console.log(`   │  Name:        ${(p.name || 'N/A').padEnd(38)}│`);
    console.log(`   │  Code:        ${(p.projectCode || PROJECT_CODE).padEnd(38)}│`);
    console.log(`   │  Status:      ${(p.status || 'N/A').padEnd(38)}│`);
    console.log(`   │  Progress:    ${String(p.progress || 0).padEnd(38)}│`);
    console.log(`   │  Type:        ${(p.type || 'N/A').padEnd(38)}│`);
    console.log(`   │  Location:    ${(p.location || 'N/A').padEnd(38)}│`);
    console.log('   └──────────────────────────────────────────────────────┘');
  }

  // Workflow stages summary
  r = await api('GET', `/api/projects/${PROJECT_ID}/workflow`);
  if (r.status === 200) {
    const stages = r.data.stages || [];
    const completed = stages.filter(s => s.status === 'COMPLETED').length;
    const inProgress = stages.filter(s => s.status === 'IN_PROGRESS').length;
    const pending = stages.filter(s => s.status === 'PENDING').length;
    console.log(`\n  📊 Stage Summary: ${completed}/${stages.length} COMPLETED, ${inProgress} IN_PROGRESS, ${pending} PENDING`);
    stages.forEach(s => {
      const icon = s.status === 'COMPLETED' ? '✅' : s.status === 'IN_PROGRESS' ? '▶️' : '⏳';
      console.log(`     ${icon} Stage ${s.sequence}: ${s.name} → ${s.status}`);
    });
  }

  // GIS data summary
  r = await api('GET', `/api/gis?projectId=${PROJECT_ID}`);
  if (r.status === 200) {
    const gis = r.data;
    const routes = gis.gisRoutes || [];
    let tp = 0, tc = 0, tcs = 0, trs = 0, tl = 0;
    for (const rt of routes) {
      tp += rt.poles?.length || 0;
      tc += rt.closures?.length || 0;
      tcs += rt.cableSegments?.length || 0;
      trs += rt.roadSegments?.length || 0;
      tl += rt.routeLength || 0;
    }
    console.log(`\n  🗺️  GIS Data Summary:`);
    console.log(`     Routes: ${routes.length}  |  Poles: ${tp}  |  Closures: ${tc}`);
    console.log(`     Cable Segments: ${tcs}  |  Road Segments: ${trs}  |  Assets: ${(gis.assets || []).length}`);
    console.log(`     Total Route Length: ${(tl / 1000).toFixed(3)} km`);
    console.log(`     Surveys: ${(gis.surveys || []).length}  |  Permits: ${(gis.permits || []).length}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('  🎉  SIMULATION COMPLETE!');
  console.log('═'.repeat(60));
  console.log(`\n  🌐  GIS Map View:  ${BASE_URL}/projects/${PROJECT_ID}/gis`);
  console.log(`  📋  Project Page:  ${BASE_URL}/projects/${PROJECT_ID}`);
  console.log(`  🆔  Project ID:    ${PROJECT_ID}`);
  console.log(`  📦  Project Code:  ${PROJECT_CODE}`);
  console.log(`\n  📊  Simulation Stats:`);
  console.log(`      Tasks Completed:    ${STATS.tasks}`);
  console.log(`      Checklists Done:    ${STATS.checklists}`);
  console.log(`      Approvals Granted:  ${STATS.approvals}`);
  console.log(`      Stages Advanced:    ${STATS.stages}`);
  console.log();
}

main().catch(err => {
  console.error(`\n[${ts()}] 💥 FATAL ERROR:`, err.message);
  console.error(err.stack);
  process.exit(1);
});