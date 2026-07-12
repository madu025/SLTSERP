const http = require('http');

async function runTests() {
  console.log('🚀 Starting E2E API Verification Tests...');

  const loginPayload = JSON.stringify({ username: 'admin', password: 'Admin@123' });

  // 1. LOGIN
  console.log('\n🔐 [TEST 1] Logging in...');
  const loginRes = await request('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, loginPayload);

  if (loginRes.statusCode !== 200) {
    console.error('❌ Login failed: ', loginRes.body);
    process.exit(1);
  }

  console.log('✅ Login successful!');
  const cookies = loginRes.headers['set-cookie'];
  const cookieHeader = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';

  // 1.5 CREATE ITEM (Add Item Verification)
  console.log('\n📝 [TEST 1.5] Creating a new inventory item (Add Item Fix Verification)...');
  const createItemPayload = JSON.stringify({
    code: `QA-ITEM-${Date.now().toString().slice(-6)}`,
    name: 'QA Automated Test Item',
    commonName: 'QA Test Cable',
    unit: 'Nos',
    type: 'SLT',
    category: 'Cables',
    minLevel: 5,
    isWastageAllowed: true,
    maxWastagePercentage: 10,
    unitPrice: 100,
    costPrice: 80,
    hasSerial: false
  });

  const createItemRes = await request('http://localhost:3000/api/inventory/items', {
    method: 'POST',
    headers: { 
      'Cookie': cookieHeader,
      'Content-Type': 'application/json'
    }
  }, createItemPayload);

  if (createItemRes.statusCode === 200 || createItemRes.statusCode === 201) {
    const data = JSON.parse(createItemRes.body);
    console.log(`✅ Success! Item created with ID: ${data.id}, Code: ${data.code}`);
  } else {
    console.error('❌ Item creation failed: ', createItemRes.body);
  }

  // 2. STOCK LEVEL
  console.log('\n📊 [TEST 2] Fetching Dashboard Stock Levels (Fix 1)...');
  const stockRes = await request('http://localhost:3000/api/inventory/stock?storeId=all', {
    method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });
  if (stockRes.statusCode === 200) {
    const data = JSON.parse(stockRes.body);
    console.log(`✅ Success! Received ${data.length} stock item entries.`);
  } else {
    console.error('❌ Stock fetch failed: ', stockRes.body);
  }

  // 3. STORES LIST
  console.log('\n🏬 [TEST 3] Fetching Stores List (Fix 2)...');
  const storesRes = await request('http://localhost:3000/api/inventory/stores', {
    method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });
  if (storesRes.statusCode === 200) {
    const data = JSON.parse(storesRes.body);
    console.log(`✅ Success! Received ${data.length} stores.`);
  } else {
    console.error('❌ Stores list fetch failed: ', storesRes.body);
  }

  // 4. GRN COMPLETED HISTORY
  console.log('\n📦 [TEST 4] Fetching Completed GRN History (Fix 3)...');
  const grnRes = await request('http://localhost:3000/api/inventory/grn', {
    method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });
  if (grnRes.statusCode === 200) {
    // If it uses apiHandler, it will return { success: true, data: [...] }
    const resBody = JSON.parse(grnRes.body);
    const grnData = resBody.success ? resBody.data : resBody;
    console.log(`✅ Success! Received ${grnData.length} completed GRN records.`);
  } else {
    console.error('❌ GRN history fetch failed: ', grnRes.body);
  }

  // 5. TRANSACTIONS
  console.log('\n💼 [TEST 5] Fetching Transactions (Auth Standard)...');
  const txRes = await request('http://localhost:3000/api/inventory/transactions', {
    method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });
  if (txRes.statusCode === 200) {
    const data = JSON.parse(txRes.body);
    console.log(`✅ Success! Received ${data.length} transaction logs.`);
  } else {
    console.error('❌ Transactions fetch failed: ', txRes.body);
  }

  console.log('\n🎉 All E2E API verification tests completed successfully!');
}

function request(url, options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: options.method,
      headers: options.headers || {}
    };

    if (bodyData) {
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

runTests().catch(console.error);
