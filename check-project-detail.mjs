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
  // Get all projects
  const res = await api('/api/projects');
  const projects = res.data && Array.isArray(res.data) ? res.data : (res.data?.projects || []);
  
  // Find our project
  const ourProject = projects.find(p => 
    p.projectCode === 'FOSP_SLTS_2026_001' || 
    (p.name && p.name.includes('KL-SVK'))
  );
  
  if (ourProject) {
    console.log('Found project:');
    console.log(JSON.stringify(ourProject, null, 2));
    
    // Get full detail by ID
    const id = ourProject.id;
    if (id) {
      console.log(`\n--- Fetching detail for ID: ${id} ---`);
      const detailRes = await api(`/api/projects/${id}`);
      console.log(`Detail status: ${detailRes.status}`);
      console.log(JSON.stringify(detailRes.data, null, 2).substring(0, 3000));
    }
  } else {
    console.log('Full projects list:');
    console.log(JSON.stringify(projects, null, 2));
  }
}

main().catch(err => console.error('Error:', err.message));
