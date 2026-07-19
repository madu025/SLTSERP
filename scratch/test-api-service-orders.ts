import * as fs from 'fs';
import * as path from 'path';

// Load .env BEFORE importing anything else so process.env.JWT_SECRET is set
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/^JWT_SECRET\s*=\s*(.*)$/m);
  if (match) {
    process.env.JWT_SECRET = match[1].trim().replace(/^["']|["']$/g, '');
  }
}

// Now safe to import
import { signJWT } from '../src/lib/auth';

async function test() {
  const token = await signJWT({ id: 'admin', role: 'SUPER_ADMIN' });

  const headers = {
    'Authorization': `Bearer ${token}`,
    'x-user-id': 'admin',
    'x-user-role': 'SUPER_ADMIN'
  };

  try {
    console.log("--- 1. Testing GET /api/service-orders without rtomId (Should return 400 Bad Request via apiHandler) ---");
    const res1 = await fetch('http://localhost:3000/api/service-orders', { headers });
    console.log("Status:", res1.status);
    console.log("Response:", await res1.json());

    console.log("\n--- 2. Testing GET /api/service-orders with valid rtomId (Should return 200 and data) ---");
    const res2 = await fetch('http://localhost:3000/api/service-orders?rtomId=cmqm18w180007sivoo65fxn2k', { headers });
    console.log("Status:", res2.status);
    const data = await res2.json();
    console.log("Retrieved count:", data.data?.serviceOrders?.length || 0);

    console.log("\n--- 3. Testing POST /api/service-orders (Should return 501 Not Implemented via apiHandler) ---");
    const res3 = await fetch('http://localhost:3000/api/service-orders', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        soNum: 'TEST12345',
        rtom: 'R-HK',
        voiceNumber: '0112345678',
        orderType: 'CREATE',
        serviceType: 'AB-FTTH',
        customerName: 'Test Customer',
        techContact: '0771234567',
        status: 'INSTALL_CLOSED',
        address: 'Test Address'
      })
    });
    console.log("Status:", res3.status);
    console.log("Response:", await res3.json());
  } catch (e) {
    console.error("Fetch Error:", e);
  }
}

test();
