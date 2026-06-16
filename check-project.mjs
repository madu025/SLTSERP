import http from 'http';
import fs from 'fs';

const TOKEN = fs.readFileSync('D:\\MyProject\\SLTSERP\\.auth\\fresh_token.txt', 'utf-8').trim();
const BASE = 'http://localhost:3000';

function api(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const req = http.request(url.toString(), {
      method: 'GET',
      headers: { 'Cookie': `token=${TOKEN}` },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('📋 Checking projects...\n');
  
  // Get all projects
  const res = await api('/api/projects');
  console.log(`Status: ${res.status}`);
  
  if (res.data && Array.isArray(res.data)) {
    console.log(`\nTotal projects: ${res.data.length}`);
    res.data.forEach(p => {
      console.log(`  - ${p.projectCode || p.code || 'N/A'}: ${p.name || p.title || 'N/A'} (${p.type || p.status || 'N/A'})`);
    });
  } else if (res.data && res.data.projects) {
    console.log(`\nTotal projects: ${res.data.projects.length}`);
    res.data.projects.forEach(p => {
      console.log(`  - ${p.projectCode || p.code}: ${p.name}`);
    });
  } else {
    console.log(`Response:`, JSON.stringify(res.data, null, 2).substring(0, 2000));
  }
  
  // Check the process result
  console.log('\n--- Checking GIS session ---');
  const gisRes = await api('/api/gis?sessionId=GIS-1781599108580-a20peg');
  console.log(`GIS status: ${gisRes.status}`);
  if (gisRes.data) {
    console.log(JSON.stringify(gisRes.data, null, 2).substring(0, 3000));
  }
}

main().catch(err => console.error('Error:', err.message));
