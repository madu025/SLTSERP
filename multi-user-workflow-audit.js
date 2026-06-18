/**
 * SLTSERP Workflow Management & Security Audit
 * Representing:
 *   1. User "field-sup" (Field Supervisor - submits tasks and checklist items)
 *   2. User "pm-user" (Project Manager - handles Level 1 approvals)
 *   3. User "opmc-mgr" (OPMC Manager - handles Level 2 approvals)
 *   4. User "human-auditor" (System Auditor - performs gap, validation, and vulnerability checks)
 */

const http = require('http');

// Target Project ID
const PROJECT_ID = 'cmqhuhahi00jzsiyk6bovq9ix';
let sessionCookie = '';

// Helper function to make HTTP API calls (maintains cookie-based sessions)
function apiCall(method, path, body = null) {
  return new Promise((resolve) => {
    const dataStr = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
    };
    if (dataStr) {
      headers['Content-Length'] = Buffer.byteLength(dataStr);
    }
    if (sessionCookie) {
      headers['Cookie'] = sessionCookie;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: path,
        method: method,
        headers: headers,
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          const setCookieHeader = res.headers['set-cookie'];
          if (setCookieHeader) {
            sessionCookie = (Array.isArray(setCookieHeader) ? setCookieHeader : [])
              .map((c) => c.split(';')[0])
              .join('; ');
          }
          try {
            resolve({
              statusCode: res.statusCode,
              data: JSON.parse(responseData),
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              data: responseData,
            });
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve({
        statusCode: 500,
        data: { error: err.message },
      });
    });

    if (dataStr) {
      req.write(dataStr);
    }
    req.end();
  });
}

async function runAudit() {
  console.log('======================================================================');
  console.log('                 SLTSERP WORKFLOW MANAGEMENT AUDIT                    ');
  console.log('======================================================================');

  // --- Step 1: Authentication & Role Setup ---
  console.log('\n[Phase 1] Authenticating Admin user to inspect state...');
  const loginRes = await apiCall('POST', '/api/login', {
    username: 'admin',
    password: 'Admin@123',
  });

  if (loginRes.statusCode !== 200) {
    console.error('❌ Failed to authenticate. Audit terminated.');
    return;
  }
  console.log(`✅ Authenticated. Cookie set: ${!!sessionCookie}`);

  // --- Step 2: Extract Project and Workflow State ---
  console.log('\n[Phase 2] Extracting project and workflow details...');
  const projectState = await apiCall('GET', `/api/projects/${PROJECT_ID}`);
  const workflowState = await apiCall('GET', `/api/projects/${PROJECT_ID}/workflow`);

  if (projectState.statusCode !== 200 || workflowState.statusCode !== 200) {
    console.error('❌ Failed to retrieve project or workflow details.');
    return;
  }

  const project = projectState.data;
  const stages = workflowState.data.stages || [];

  console.log(`📋 Project Name: ${project.name}`);
  console.log(`📋 Current Project Progress: ${project.progress}%`);
  console.log(`📋 Current Project Status: ${project.status}`);
  console.log(`📋 Total Stages: ${stages.length}`);

  // --- Step 3: Run Gap & Integrity Analysis ---
  console.log('\n[Phase 3] Gap & State-Machine Integrity Checks...');
  const integrityAudit = [];

  const completedStagesCount = stages.filter((s) => s.status === 'COMPLETED').length;
  const inProgressStagesCount = stages.filter((s) => s.status === 'IN_PROGRESS').length;

  const calculatedProgress = Math.min(
    100,
    Math.round(
      (completedStagesCount / stages.length) * 100 +
        (inProgressStagesCount > 0 ? (1 / stages.length) * 50 : 0)
    )
  );

  console.log(`🔍 Progress Calculation Check:`);
  console.log(`   - Actual Completed Stages: ${completedStagesCount}`);
  console.log(`   - Actual In-Progress Stages: ${inProgressStagesCount}`);
  console.log(`   - Recalculated Progress: ${calculatedProgress}%`);
  console.log(`   - Database Stored Progress: ${project.progress}%`);

  const progressMismatch = calculatedProgress !== project.progress;
  integrityAudit.push({
    category: 'Integrity Check',
    title: 'Progress Database Sync',
    expected: `${calculatedProgress}%`,
    actual: `${project.progress}%`,
    pass: !progressMismatch,
    severity: progressMismatch ? 'CRITICAL' : 'LOW',
    message: progressMismatch
      ? 'CRITICAL MISMATCH: Project progress in database is manually overridden or bypassed stage recalculation rules!'
      : 'Progress matches stage completion calculation.',
  });

  // --- Step 4: Vulnerability & Transition Checks ---
  console.log('\n[Phase 4] Stage Gate Transition and Security Audit...');

  for (const stage of stages) {
    console.log(`\n  ▶️ Analyzing Stage ${stage.sequence}: "${stage.name}" (Status: ${stage.status})`);
    
    const tasks = stage.tasks || [];
    const checklists = stage.checklists || [];
    const approvals = stage.approvals || [];

    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const completedChecklists = checklists.filter((c) => c.isCompleted).length;
    const approvedApprovals = approvals.filter((a) => a.status === 'APPROVED').length;

    console.log(`    - Tasks: ${completedTasks}/${tasks.length} completed`);
    console.log(`    - Checklists: ${completedChecklists}/${checklists.length} completed`);
    console.log(`    - Approvals: ${approvedApprovals}/${approvals.length} approved`);

    // Gaps Check A: Completed stages with incomplete elements
    if (stage.status === 'COMPLETED') {
      const incompleteTasksCount = tasks.length - completedTasks;
      if (incompleteTasksCount > 0) {
        integrityAudit.push({
          category: 'Stage Validation Gate',
          title: `Stage "${stage.name}" Task Completeness`,
          expected: 'All tasks completed',
          actual: `${incompleteTasksCount} task(s) incomplete`,
          pass: false,
          severity: 'HIGH',
          message: `Stage completed but has ${incompleteTasksCount} incomplete tasks!`,
        });
      }

      // Check mandatory checklists
      const mandatoryUnchecked = checklists.filter((c) => c.isMandatory && !c.isCompleted);
      if (mandatoryUnchecked.length > 0) {
        integrityAudit.push({
          category: 'Stage Validation Gate',
          title: `Stage "${stage.name}" Checklist Completeness`,
          expected: 'All mandatory checklists checked',
          actual: `${mandatoryUnchecked.length} item(s) unchecked`,
          pass: false,
          severity: 'HIGH',
          message: `Bypass detected! Mandatory checklists for "${stage.name}" were left unchecked: ${mandatoryUnchecked.map(c => c.label).join(', ')}`,
        });
      }

      // Check mandatory photo proofs
      if (stage.reqPhotos) {
        const missingPhotos = checklists.filter((c) => c.isMandatory && !c.photoUrl);
        if (missingPhotos.length > 0) {
          integrityAudit.push({
            category: 'Security / Photo Proof Gate',
            title: `Stage "${stage.name}" Photo Proof Requirement`,
            expected: 'All mandatory checklists have photoUrl proof',
            actual: `${missingPhotos.length} item(s) missing photoUrl`,
            pass: false,
            severity: 'CRITICAL',
            message: `Bypass detected! Stage requires photos but mandatory items do not have photo proof uploaded.`,
          });
        }
      }

      // Check approvals
      if (stage.reqApproval) {
        const unapproved = approvals.filter((a) => a.status !== 'APPROVED');
        if (unapproved.length > 0) {
          integrityAudit.push({
            category: 'Security / Role Approval Gate',
            title: `Stage "${stage.name}" Approval Gate`,
            expected: 'All required approval levels signed off',
            actual: `${unapproved.length} level(s) pending`,
            pass: false,
            severity: 'CRITICAL',
            message: `Bypass detected! Stage completed without authorized signature for level(s): ${unapproved.map(a => `L${a.level} - ${a.role}`).join(', ')}`,
          });
        }
      }
    }

    // Gaps Check B: Under-the-hood direct transition vulnerability test
    if (stage.status === 'IN_PROGRESS') {
      console.log(`    🧪 Testing manual transition bypass for stage "${stage.name}"...`);
      // Attempting to transition the stage to COMPLETED with unchecked elements, incomplete tasks, or missing approvals.
      // This will demonstrate if the API endpoints correctly enforce validateStageCompletion or can be bypassed.
      const bypassResponse = await apiCall('POST', `/api/projects/${PROJECT_ID}/workflow/stages`, {
        stageId: stage.id,
        status: 'COMPLETED',
        userId: 'human-auditor',
      });

      const validationEnforced = bypassResponse.statusCode !== 200;
      console.log(`    🧪 Gate Enforcement Result: ${validationEnforced ? 'SECURE 🛡️ (Bypass rejected)' : 'VULNERABLE ⚠️ (Bypass allowed)'}`);
      if (validationEnforced) {
        console.log(`       Reason/Error returned: ${bypassResponse.data.error || JSON.stringify(bypassResponse.data)}`);
      }

      integrityAudit.push({
        category: 'State Machine Security',
        title: `Manual Complete Bypass Protection on "${stage.name}"`,
        expected: 'Bypass Rejected (HTTP 400/500)',
        actual: validationEnforced ? 'Bypass Rejected' : 'Bypass Allowed (HTTP 200)',
        pass: validationEnforced,
        severity: validationEnforced ? 'LOW' : 'CRITICAL',
        message: validationEnforced
          ? 'Workflow gate validators successfully blocked transitioning an incomplete stage.'
          : `CRITICAL VULNERABILITY: Stage transitioned without executing gate validators!`,
      });
    }
  }

  // --- Step 5: Multi-user Role simulation & Audit Output ---
  console.log('\n[Phase 5] Compiling and displaying Final Multi-User Workflow Audit Report...');
  console.log('======================================================================');
  console.log('                     FINAL WORKFLOW AUDIT REPORT                      ');
  console.log('======================================================================');
  
  let passes = 0;
  let fails = 0;

  integrityAudit.forEach((item, index) => {
    const statusIcon = item.pass ? '✅ PASS' : `❌ FAIL [${item.severity}]`;
    if (item.pass) passes++; else fails++;

    console.log(`\n  ${index + 1}. [${item.category}] - ${item.title}`);
    console.log(`     Status:   ${statusIcon}`);
    console.log(`     Expected: ${item.expected}`);
    console.log(`     Actual:   ${item.actual}`);
    console.log(`     Details:  ${item.message}`);
  });

  const totalChecks = passes + fails;
  const healthScore = Math.round((passes / totalChecks) * 100);

  console.log('\n======================================================================');
  console.log('                           HEALTH SCORE CARD                          ');
  console.log('======================================================================');
  console.log(`  Total Checks Conducted:  ${totalChecks}`);
  console.log(`  Passed Controls:         ${passes} ✅`);
  console.log(`  Failed Controls:         ${fails} ❌`);
  console.log(`  Overall System Score:    ${healthScore}%`);
  console.log('======================================================================\n');
}

runAudit().catch(console.error);