import http from 'http';
import fs from 'fs';

const TOKEN = fs.readFileSync('D:\\MyProject\\SLTSERP\\.auth\\fresh_token.txt', 'utf-8').trim();
const USER_ID = 'cmq7nq9860000sihs2dtstxg1';
const PROJECT_ID = 'cmqge3ykm0000sivcdor6thkw';
const BASE = 'http://localhost:3000';

function api(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { 'Cookie': `token=${TOKEN}` };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    const req = http.request(url.toString(), { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function completeTasks(tasks) {
  for (const task of tasks) {
    if (task.status !== 'COMPLETED') {
      console.log(`   📌 Completing task: ${task.name}...`);
      const res = await api('POST', `/api/projects/${PROJECT_ID}/workflow/tasks`, {
        action: 'update_task',
        taskId: task.id,
        status: 'COMPLETED',
        progress: 100
      });
      console.log(`      → ${res.status} ${res.status === 200 ? '✅' : '❌'} ${JSON.stringify(res.data).substring(0, 80)}`);
      await sleep(300);
    } else {
      console.log(`   📌 ${task.name}: Already COMPLETED ✅`);
    }
  }
}

async function completeChecklists(checklists) {
  for (const cl of checklists) {
    if (!cl.isCompleted) {
      console.log(`   ✅ Checklist: ${cl.label}...`);
      const res = await api('POST', `/api/projects/${PROJECT_ID}/workflow/tasks`, {
        action: 'update_checklist',
        checklistId: cl.id,
        isCompleted: true
      });
      console.log(`      → ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
      await sleep(200);
    }
  }
}

async function approveAll(approvals) {
  for (const ap of approvals) {
    if (ap.status !== 'APPROVED') {
      console.log(`   ✅ Approval Level ${ap.level} (${ap.role})...`);
      const res = await api('POST', `/api/projects/${PROJECT_ID}/workflow/approvals`, {
        approvalId: ap.id,
        status: 'APPROVED',
        userId: USER_ID,
        comments: 'Auto-approved during pipeline test'
      });
      console.log(`      → ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
      await sleep(200);
    }
  }
}

async function transitionStage(stage) {
  console.log(`\n   ➡️ Transitioning ${stage.name} → COMPLETED...`);
  const res = await api('POST', `/api/projects/${PROJECT_ID}/workflow/stages`, {
    stageId: stage.id,
    status: 'COMPLETED',
    userId: USER_ID
  });
  console.log(`      → ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
  if (res.status !== 200) {
    console.log(`      Error: ${JSON.stringify(res.data)}`);
  }
  await sleep(500);
}

async function processStage(stage) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${stage.sequence}. ${stage.name} — ${stage.status}`);
  console.log(`${'='.repeat(60)}`);

  if (stage.tasks && stage.tasks.length > 0) {
    console.log(`   🎯 Tasks (${stage.tasks.length}):`);
    await completeTasks(stage.tasks);
  }

  if (stage.checklists && stage.checklists.length > 0) {
    console.log(`   📋 Checklists (${stage.checklists.length}):`);
    await completeChecklists(stage.checklists);
  }

  if (stage.approvals && stage.approvals.length > 0) {
    console.log(`   👤 Approvals (${stage.approvals.length}):`);
    await approveAll(stage.approvals);
  }

  if (stage.status !== 'COMPLETED') {
    await transitionStage(stage);
  } else {
    console.log(`   ✅ ${stage.name} already COMPLETED`);
  }
}

async function addSampleMaterials() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📦 Adding Sample Materials to Project (Material Stage)');
  console.log(`${'='.repeat(60)}`);

  // Fetch available inventory items
  const invRes = await api('GET', '/api/inventory/items?take=10');
  let items = [];
  if (Array.isArray(invRes.data)) items = invRes.data;
  else if (invRes.data?.items) items = invRes.data.items;

  console.log(`\nAvailable inventory items: ${items.length}`);
  items.forEach(item => {
    console.log(`   📦 ${item.code || item.itemCode}: ${item.name}`);
  });

  // Try to add materials via project materials endpoint
  const materialPayload = {
    items: items.slice(0, 5).map(item => ({
      itemId: item.id,
      quantity: 10,
      unit: 'Nos'
    }))
  };

  // Try POST to a materials endpoint (may not exist - that's OK for demo)
  console.log(`\n📝 Attempting to assign materials to project...`);
  const matRes = await api('POST', `/api/projects/${PROJECT_ID}/materials`, materialPayload);
  console.log(`   → ${matRes.status}: ${JSON.stringify(matRes.data).substring(0, 100)}`);

  // Also try project-assets or boq endpoint if materials endpoint doesn't exist
  if (matRes.status === 404) {
    console.log(`   ℹ️ Materials endpoint not found — will try BOQ endpoint`);
    const boqRes = await api('POST', `/api/projects/${PROJECT_ID}/boq`, {
      items: items.slice(0, 3).map(item => ({
        inventoryItemId: item.id,
        itemCode: item.code || item.itemCode,
        itemName: item.name,
        quantity: 10,
        unitPrice: item.unitPrice || 0,
        totalPrice: 0
      }))
    });
    console.log(`   → BOQ: ${boqRes.status}: ${JSON.stringify(boqRes.data).substring(0, 100)}`);
  }
}

async function main() {
  console.log('============================================');
  console.log('🚀 Stage-by-Stage Workflow Pipeline Test');
  console.log(`Project: FOSP_SLTS_2026_001 (${PROJECT_ID})`);
  console.log(`User: ${USER_ID} (SUPER_ADMIN)`);
  console.log('============================================\n');

  // STEP 1: Fetch workflow
  console.log('📡 Fetching workflow...');
  const wf = await api('GET', `/api/projects/${PROJECT_ID}/workflow`);
  
  if (!wf.data || !wf.data.stages) {
    console.error('❌ Failed to fetch workflow:', JSON.stringify(wf.data).substring(0, 200));
    return;
  }

  console.log(`Workflow ID: ${wf.data.id}`);
  console.log(`Stages: ${wf.data.stages.length}\n`);

  // Print initial state
  console.log('📋 Current Workflow State:');
  for (const s of wf.data.stages) {
    console.log(`   ${s.sequence}. ${s.name} — ${s.status}`);
  }

  // STEP 2: Process each stage
  for (const stage of wf.data.stages) {
    await processStage(stage);
  }

  // STEP 3: Add materials if we reached Material stage or beyond
  await addSampleMaterials();

  // STEP 4: Final verification
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 FINAL WORKFLOW VERIFICATION');
  console.log(`${'='.repeat(60)}`);

  await sleep(2000);
  const wfFinal = await api('GET', `/api/projects/${PROJECT_ID}/workflow`);
  
  if (wfFinal.data?.stages) {
    let allCompleted = true;
    for (const stage of wfFinal.data.stages) {
      const icon = stage.status === 'COMPLETED' ? '✅' : '⏳';
      if (stage.status !== 'COMPLETED') allCompleted = false;
      console.log(`   ${icon} ${stage.sequence}. ${stage.name} — ${stage.status}`);
      if (stage.tasks) {
        for (const task of stage.tasks) {
          const tIcon = task.status === 'COMPLETED' ? '✅' : '⏳';
          console.log(`      ${tIcon} ${task.name}: ${task.status}`);
        }
      }
    }
    
    if (allCompleted) {
      console.log(`\n🎉 ALL STAGES COMPLETED SUCCESSFULLY!`);
    } else {
      console.log(`\n⚠️ Some stages still in progress`);
    }
  }

  console.log(`\n🔗 Open in browser: http://localhost:3000/projects/${PROJECT_ID}`);
  console.log('✅ Pipeline test complete!');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
