import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';
import { POST as loginPOST } from '../src/app/api/auth/agent-login/route';
import { POST as syncPOST } from '../src/app/api/assets/sync/route';
import { POST as registerPOST } from '../src/app/api/assets/register/route';
import { GET as versionGET } from '../src/app/api/agent/version/route';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log("=== STARTING AGENT SYNC INTEGRATION VERIFICATION (REVISED) ===\n");

  const testSerial = 'TEST-SR-9337';

  // 0. Clean database
  console.log("[SETUP] Cleaning up test database records...");
  
  // Clean logs first
  await prisma.assetSyncLog.deleteMany({});
  
  // Clean test assets
  await prisma.iTAsset.deleteMany({
    where: { serialNumber: testSerial }
  });
  
  // Clean test user
  await prisma.user.deleteMany({
    where: { employeeId: 'EMP-001' }
  });

  const testIp = '127.0.0.1';
  let isRedisOnline = false;

  try {
    const pingResult = await Promise.race([
      redis.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
    ]);
    isRedisOnline = pingResult === 'PONG';
    console.log("[SETUP] Redis is ONLINE. Live rate limiting tests will run.");
  } catch (err) {
    console.log("[SETUP] Redis is OFFLINE. Rate limiting tests will be simulated/skipped.");
  }

  if (isRedisOnline) {
    try {
      await redis.del(`ratelimit:agent:${testIp}`);
    } catch (e) {
      console.warn("Failed to delete rate limit key:", e);
    }
  }

  // Test data constants
  const validApiKey = 'slts-agent-secure-sync-key-2026';
  const invalidApiKey = 'wrong-api-key-here';

  // ==========================================
  // TEST 1: POST /api/auth/agent-login (Invalid Auth)
  // ==========================================
  console.log("\n[TEST 1] POST /api/auth/agent-login (Invalid Auth)");
  const loginReq1 = new Request('http://localhost/api/auth/agent-login', {
    method: 'POST',
    body: JSON.stringify({ apiKey: invalidApiKey }),
    headers: { 'Content-Type': 'application/json', 'x-real-ip': testIp, 'Host': 'localhost' }
  });
  const loginRes1 = await loginPOST(loginReq1, {});
  const loginData1 = await loginRes1.json();
  console.log("Response Status:", loginRes1.status);
  console.log("Response Body:", loginData1);
  if (loginRes1.status === 401 && loginData1.success === false && loginData1.message === 'Invalid credentials') {
    console.log("✅ TEST 1 PASSED");
  } else {
    console.error("❌ TEST 1 FAILED");
  }

  // ==========================================
  // TEST 2: POST /api/auth/agent-login (Valid Auth)
  // ==========================================
  console.log("\n[TEST 2] POST /api/auth/agent-login (Valid Auth)");
  const loginReq2 = new Request('http://localhost/api/auth/agent-login', {
    method: 'POST',
    body: JSON.stringify({ apiKey: validApiKey }),
    headers: { 'Content-Type': 'application/json', 'x-real-ip': testIp, 'Host': 'localhost' }
  });
  const loginRes2 = await loginPOST(loginReq2, {});
  const loginData2 = await loginRes2.json();
  console.log("Response Status:", loginRes2.status);
  console.log("Response Body:", loginData2);
  const token = loginData2.token;
  if (loginRes2.status === 200 && loginData2.success === true && token && loginData2.expiresIn === 86400) {
    console.log("✅ TEST 2 PASSED");
  } else {
    console.error("❌ TEST 2 FAILED");
  }

  // ==========================================
  // TEST 3: POST /api/assets/sync (No Auth)
  // ==========================================
  console.log("\n[TEST 3] POST /api/assets/sync (No/Invalid Auth)");
  const syncReq1 = new Request('http://localhost/api/assets/sync', {
    method: 'POST',
    body: JSON.stringify({
      computerName: "LAPTOP-TEST",
      serialNumber: testSerial,
      osVersion: "Windows 11",
      employeeUsername: "Prasad",
      employeeNumber: "EMP-001",
      ipAddress: "10.0.0.1",
      macAddress: "00:1B:44:11:3A:B7"
    }),
    headers: { 'Content-Type': 'application/json', 'x-real-ip': testIp, 'Host': 'localhost' }
  });
  const syncRes1 = await syncPOST(syncReq1, {});
  const syncData1 = await syncRes1.json();
  console.log("Response Status:", syncRes1.status);
  console.log("Response Body:", syncData1);
  if (syncRes1.status === 401 && syncData1.success === false) {
    console.log("✅ TEST 3 PASSED");
  } else {
    console.error("❌ TEST 3 FAILED");
  }

  // ==========================================
  // TEST 4: POST /api/assets/sync (Unregistered 404)
  // ==========================================
  console.log("\n[TEST 4] POST /api/assets/sync (Unregistered 404)");
  const syncReq2 = new Request('http://localhost/api/assets/sync', {
    method: 'POST',
    body: JSON.stringify({
      computerName: "LAPTOP-TEST",
      serialNumber: testSerial,
      osVersion: "Windows 11",
      employeeUsername: "Prasad",
      employeeNumber: "EMP-001",
      ipAddress: "10.0.0.1",
      macAddress: "00:1B:44:11:3A:B7"
    }),
    headers: { 
      'Content-Type': 'application/json', 
      'x-real-ip': testIp,
      'Authorization': `Bearer ${token}`,
      'Host': 'localhost'
    }
  });
  const syncRes2 = await syncPOST(syncReq2, {});
  const syncData2 = await syncRes2.json();
  console.log("Response Status:", syncRes2.status);
  console.log("Response Body:", syncData2);
  if (syncRes2.status === 404 && syncData2.success === false && syncData2.requiresRegistration === true) {
    console.log("✅ TEST 4 PASSED");
  } else {
    console.error("❌ TEST 4 FAILED");
  }

  // ==========================================
  // TEST 5: POST /api/assets/register (Success 201)
  // ==========================================
  console.log("\n[TEST 5] POST /api/assets/register (Success 201)");
  const regReq = new Request('http://localhost/api/assets/register', {
    method: 'POST',
    body: JSON.stringify({
      computerName: "LAPTOP-TEST",
      serialNumber: testSerial,
      osVersion: "Windows 11",
      employeeUsername: "Prasad",
      employeeNumber: "EMP-001",
      department: "IT",
      location: "Head Office",
      brand: "Lenovo",
      model: "ThinkPad T14"
    }),
    headers: { 
      'Content-Type': 'application/json', 
      'x-real-ip': testIp,
      'Authorization': `Bearer ${token}`,
      'Host': 'localhost'
    }
  });
  const regRes = await registerPOST(regReq, {});
  const regData = await regRes.json();
  console.log("Response Status:", regRes.status);
  console.log("Response Body:", regData);
  if (regRes.status === 201 && regData.success === true && regData.assetId.startsWith('AGENT-')) {
    console.log("✅ TEST 5 PASSED");
  } else {
    console.error("❌ TEST 5 FAILED");
  }

  // ==========================================
  // TEST 6: POST /api/assets/sync (Registered, Unassigned)
  // ==========================================
  console.log("\n[TEST 6] POST /api/assets/sync (Registered, Unassigned)");
  const syncReq3 = new Request('http://localhost/api/assets/sync', {
    method: 'POST',
    body: JSON.stringify({
      computerName: "LAPTOP-TEST-UPDATED",
      serialNumber: testSerial,
      osVersion: "Windows 11 Home",
      employeeUsername: "Prasad",
      employeeNumber: "EMP-001",
      ipAddress: "10.0.0.99",
      macAddress: "00:1B:44:11:3A:B7",
      brand: "Lenovo",
      model: "ThinkPad T14 Gen 4"
    }),
    headers: { 
      'Content-Type': 'application/json', 
      'x-real-ip': testIp,
      'Authorization': `Bearer ${token}`,
      'Host': 'localhost'
    }
  });
  const syncRes3 = await syncPOST(syncReq3.clone(), {});
  const syncData3 = await syncRes3.json();
  console.log("Response Status:", syncRes3.status);
  console.log("Response Body:", syncData3);
  if (
    syncRes3.status === 200 && 
    syncData3.success === true && 
    syncData3.employeeStatus === 'unknown' &&
    syncData3.assignedEmployeeName === null
  ) {
    console.log("✅ TEST 6 PASSED");
  } else {
    console.error("❌ TEST 6 FAILED");
  }

  // ==========================================
  // TEST 7: POST /api/assets/sync (Assigned, Active Employee)
  // ==========================================
  console.log("\n[TEST 7] POST /api/assets/sync (Assigned, Active Employee)");
  // Create an employee in DB (User table) and assign to the ITAsset
  console.log("Seeding employee (User) and assigning to ITAsset...");
  const emp = await prisma.user.create({
    data: {
      email: "prasad_test@slt.lk",
      username: "prasad_test",
      password: "somehashedpassword",
      role: "ENGINEER",
      name: "Prasad Fernando",
      employeeId: "EMP-001",
      status: "active"
    }
  });
  
  await prisma.iTAsset.update({
    where: { serialNumber: testSerial },
    data: {
      assignedUserId: emp.id,
      pendingAssignmentReview: false
    }
  });

  const syncRes4 = await syncPOST(syncReq3.clone(), {});
  const syncData4 = await syncRes4.json();
  console.log("Response Status:", syncRes4.status);
  console.log("Response Body:", syncData4);
  if (
    syncRes4.status === 200 && 
    syncData4.success === true && 
    syncData4.employeeStatus === 'active' &&
    syncData4.assignedEmployeeName === 'Prasad Fernando' &&
    syncData4.assignedEmployeeNumber === 'EMP-001'
  ) {
    console.log("✅ TEST 7 PASSED");
  } else {
    console.error("❌ TEST 7 FAILED");
  }

  // ==========================================
  // TEST 8: POST /api/assets/sync (Assigned, Resigned Employee)
  // ==========================================
  console.log("\n[TEST 8] POST /api/assets/sync (Assigned, Resigned Employee)");
  // Update employee status to resigned
  console.log("Updating employee status to 'resigned' in DB...");
  await prisma.user.update({
    where: { id: emp.id },
    data: { status: 'resigned' }
  });

  const syncRes5 = await syncPOST(syncReq3.clone(), {});
  const syncData5 = await syncRes5.json();
  console.log("Response Status:", syncRes5.status);
  console.log("Response Body:", syncData5);
  if (
    syncRes5.status === 200 && 
    syncData5.success === true && 
    syncData5.employeeStatus === 'resigned' &&
    syncData5.assignedEmployeeName === 'Prasad Fernando' &&
    syncData5.assignedEmployeeNumber === 'EMP-001'
  ) {
    console.log("✅ TEST 8 PASSED");
  } else {
    console.error("❌ TEST 8 FAILED");
  }

  // Verify sync logs in database
  const itAssetRecord = await prisma.iTAsset.findUnique({ where: { serialNumber: testSerial } });
  const syncLogs = await prisma.assetSyncLog.findMany({
    where: { assetId: itAssetRecord?.id }
  });
  console.log("\nSync logs recorded in DB:", syncLogs.length);
  if (syncLogs.length === 3) {
    console.log("✅ Sync log audit trail verified");
  } else {
    console.error("❌ Sync log mismatch: expected 3, found", syncLogs.length);
  }

  // ==========================================
  // TEST 9: GET /api/agent/version
  // ==========================================
  console.log("\n[TEST 9] GET /api/agent/version");
  const versionReq = new Request('http://localhost/api/agent/version', {
    method: 'GET',
    headers: { 
      'x-real-ip': testIp,
      'Authorization': `Bearer ${token}`,
      'Host': 'localhost'
    }
  });
  const versionRes = await versionGET(versionReq, {});
  const versionData = await versionRes.json();
  console.log("Response Status:", versionRes.status);
  console.log("Response Body:", versionData);
  
  // Verify SHA256 of the mock file matches
  const exePath = path.join(process.cwd(), 'public', 'downloads', 'SLTERPAgent.exe');
  const fileBuffer = fs.readFileSync(exePath);
  const realHash = crypto.createHash('sha256').update(fileBuffer).digest('hex').toLowerCase();
  
  if (
    versionRes.status === 200 && 
    versionData.latestVersion === '1.0.1' &&
    versionData.sha256 === realHash &&
    versionData.mandatory === true &&
    versionData.downloadUrl.includes('localhost')
  ) {
    console.log("✅ TEST 9 PASSED");
  } else {
    console.error("❌ TEST 9 FAILED");
  }

  // ==========================================
  // TEST 10: Rate Limiting Verification
  // ==========================================
  if (isRedisOnline) {
    console.log("\n[TEST 10] Rate Limiting (Brute-force protection)");
    await redis.del(`ratelimit:agent:${testIp}`); // reset IP rate limit
    
    let rateLimited = false;
    for (let i = 0; i < 12; i++) {
      const r = new Request('http://localhost/api/auth/agent-login', {
        method: 'POST',
        body: JSON.stringify({ apiKey: invalidApiKey }),
        headers: { 'Content-Type': 'application/json', 'x-real-ip': testIp, 'Host': 'localhost' }
      });
      const res = await loginPOST(r, {});
      if (res.status === 429) {
        console.log(`Request ${i + 1} was rate limited (status 429)`);
        rateLimited = true;
        break;
      }
    }
    
    if (rateLimited) {
      console.log("✅ TEST 10 PASSED");
    } else {
      console.error("❌ TEST 10 FAILED");
    }
  } else {
    console.log("\n[TEST 10] Rate Limiting (Skipped - Redis offline)");
  }

  // Cleanup
  console.log("\n[CLEANUP] Cleaning up verification data...");
  await prisma.assetSyncLog.deleteMany({});
  await prisma.iTAsset.deleteMany({ where: { serialNumber: testSerial } });
  await prisma.user.deleteMany({ where: { employeeId: 'EMP-001' } });
  
  if (isRedisOnline) {
    await redis.del(`ratelimit:agent:${testIp}`);
  }
  
  // Close redis connection
  redis.disconnect();

  console.log("\n=== VERIFICATION SUITE FINISHED ===");
}

runTest().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
