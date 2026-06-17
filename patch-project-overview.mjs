// Patch existing project with missing Overview fields
import fs from 'fs';

const TOKEN = (() => {
  try { return fs.readFileSync('d:/MyProject/SLTSERP/.auth/fresh_token.txt', 'utf-8').trim(); }
  catch { return ''; }
})();

async function api(method, path, body = null) {
  const opts = { method, headers: {} };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch('http://localhost:3000' + path, {
    ...opts, headers: { ...opts.headers, 'Cookie': `token=${TOKEN}` }
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

async function main() {
  // Login first
  const login = await api('POST', '/api/login', { username: 'admin', password: 'Admin@123' });
  console.log('Login:', login.status);

  // Get OPMC
  const opmcs = await api('GET', '/api/opmcs');
  const opmc = Array.isArray(opmcs.data) ? opmcs.data[0] : null;
  console.log('OPMC:', opmc?.rtom || 'none');

  // Get BOQ total
  const gis = await api('GET', '/api/gis?projectId=cmqho74t00000siro1q73uiv7');
  const boq = gis.data?.gisRoutes?.[0]?.generatedBOQs?.[0];
  const boqTotal = boq?.totalEstimatedCost || 6023674.21;
  console.log('BOQ:', boqTotal);

  // Patch project
  const patch = await api('PATCH', '/api/projects', {
    id: 'cmqho74t00000siro1q73uiv7',
    budget: boqTotal,
    actualCost: 0,
    opmcId: opmc?.id || null,
    estimatedDuration: 180,
    actualDuration: 180,
    startDate: '2026-06-17T00:00:00.000Z',
    endDate: '2026-12-17T00:00:00.000Z',
    status: 'COMPLETED',
    progress: 100,
    location: 'Kalmunai / Kolonnawa'
  });
  console.log('PATCH:', patch.status, '→', patch.data?.status, patch.data?.budget, 'OPMC:', patch.data?.opmcId);
  console.log('\nOverview tab should now show:');
  console.log('  Budget: LKR 6,023,674.21');
  console.log('  Actual Cost: LKR 0');
  console.log('  Progress: 100%');
  console.log('  Duration: 180/180 days');
  console.log('  Region: via OPMC');
}

main().catch(e => console.error(e.message));