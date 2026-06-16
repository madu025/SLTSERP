import http from 'http';
import fs from 'fs';

const BASE = 'http://localhost:3000';

function api(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { ...options.headers };
    if (options.body) headers['Content-Type'] = 'application/json';
    
    const req = http.request(url.toString(), {
      method: options.method || 'GET',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        let token = null;
        if (setCookie) {
          const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
          const match = cookieStr.match(/token=([^;]+)/);
          if (match) token = match[1];
        }
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), token });
        } catch {
          resolve({ status: res.statusCode, data, token });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  console.log('🔑 Logging in as admin...');
  
  const loginRes = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'admin',
      password: 'Admin@123',
    }),
  });
  
  console.log(`Login status: ${loginRes.status}`);
  console.log(`Login response:`, JSON.stringify(loginRes.data, null, 2));
  
  if (loginRes.token) {
    console.log(`\n✅ Got new token!`);
    console.log(`First 30 chars: ${loginRes.token.substring(0, 30)}...`);
    
    fs.writeFileSync('D:\\MyProject\\SLTSERP\\.auth\\fresh_token.txt', loginRes.token);
    console.log('✅ Token saved to .auth/fresh_token.txt');
    
    // Test with health
    const healthRes = await api('/api/health', {
      headers: { 'Cookie': `token=${loginRes.token}` },
    });
    console.log(`\nHealth check with new token: ${healthRes.status}`);
    console.log(`Response:`, JSON.stringify(healthRes.data, null, 2));
  } else {
    console.log('\n❌ Login failed - no token received');
  }
}

main().catch(err => console.error('Error:', err.message));
