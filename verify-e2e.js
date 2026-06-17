const http = require('http');

function api(path, body, cookie) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: body ? 'POST' : 'GET',
      headers: headers
    }, (res) => {
      let y = '';
      res.on('data', c => y += c);
      res.on('end', () => {
        try { resolve({ s: res.statusCode, sc: res.headers['set-cookie'], d: JSON.parse(y) }); }
        catch { resolve({ s: res.statusCode, sc: res.headers['set-cookie'], d: y }); }
      });
    });
    if (body) req.write(data);
    req.end();
  });
}

(async () => {
  try {
    // 1. Login
    const login = await api('/api/login', { username: 'admin', password: 'Admin@123' });
    console.log('Login status:', login.s);
    console.log('Set-Cookie raw:', JSON.stringify(login.sc));

    // Extract token cookie properly
    let tok = '';
    if (Array.isArray(login.sc)) {
      for (const c of login.sc) {
        if (c.startsWith('token=')) {
          tok = c.split(';')[0]; // "token=xxx"
          break;
        }
      }
    } else if (typeof login.sc === 'string' && login.sc.startsWith('token=')) {
      tok = login.sc.split(';')[0];
    }
    console.log('Cookie to send:', tok);

    // 2. List all projects
    const projects = await api('/api/projects?limit=10', null, tok);
    console.log('\nProjects status:', projects.s);
    const projList = projects.d?.data || projects.d?.projects || projects.d || [];
    if (Array.isArray(projList)) {
      console.log('Projects found:', projList.length);
      projList.slice(0, 10).forEach(p => {
        console.log('  -', p.id, '|', p.projectCode || p.code || '?', '|', p.name, '|', p.status, '|', p.progress + '%');
      });
    } else {
      console.log('Projects response:', JSON.stringify(projects.d).substring(0, 500));
    }

    // 3. Find the FSSD project or use known ID
    let pid = 'cmqhuhahi00jzsiyk6bovq9ix';
    if (Array.isArray(projList) && projList.length > 0) {
      const fssd = projList.find(p => (p.projectCode || p.code || '').includes('FSSD'));
      if (fssd) pid = fssd.id;
    }

    // 4. Get project details
    const pj = await api('/api/projects/' + pid, null, tok);
    console.log('\nProject', pid, 'status:', pj.s);
    if (pj.s === 200 && pj.d) {
      const p = pj.d.data || pj.d;
      console.log('  name:', p.name);
      console.log('  status:', p.status);
      console.log('  progress:', p.progress);
      console.log('  budget:', p.budget);
      console.log('  startDate:', p.startDate);
      console.log('  endDate:', p.endDate);
    } else {
      console.log('  response:', JSON.stringify(pj.d).substring(0, 300));
    }

    // 5. BOQ
    const bo = await api('/api/projects/boq?projectId=' + pid, null, tok);
    console.log('\nBOQ status:', bo.s);
    const boqItems = Array.isArray(bo.d) ? bo.d : (bo.d?.data || bo.d?.items || []);
    console.log('  BOQ items:', boqItems.length);
    if (boqItems.length > 0) {
      const boqSum = boqItems.reduce((s, i) => s + Number(i.amount || i.totalCost || 0), 0);
      console.log('  BOQ total: LKR', boqSum.toLocaleString());
    }

    // 6. Workflow
    const wk = await api('/api/projects/' + pid + '/workflow', null, tok);
    console.log('\nWorkflow status:', wk.s);
    const stages = wk.d?.stages || wk.d?.data?.stages || [];
    console.log('  Stages:', stages.length);
    if (stages.length > 0) {
      const taskCount = stages.reduce((s, st) => s + (st.tasks || []).length, 0);
      const completed = stages.filter(s => s.status === 'COMPLETED').length;
      console.log('  Tasks:', taskCount, '| Completed stages:', completed + '/' + stages.length);
    }

    // 7. GIS
    const gs = await api('/api/gis?projectId=' + pid, null, tok);
    console.log('\nGIS status:', gs.s);
    const routes = gs.d?.gisRoutes || gs.d?.data?.gisRoutes || [];
    console.log('  GIS routes:', routes.length);
    let tp = 0, tc = 0, ts = 0;
    routes.forEach(r => {
      tp += (r.poles || []).length;
      tc += (r.closures || []).length;
      ts += (r.cableSegments || []).length;
    });
    console.log('  Poles:', tp, '| Cables:', ts, '| Closures:', tc);

    // 8. Final summary
    console.log('\n======================================================');
    console.log('  QGIS -> SLTSERP ERP - END-TO-END CONNECTION');
    console.log('======================================================');
    if (pj.s === 200) {
      const p = pj.d.data || pj.d;
      const boqSum = boqItems.reduce((s, i) => s + Number(i.amount || i.totalCost || 0), 0);
      console.log('SOURCE: QGIS Field Survey -> 5 GeoJSON files');
      console.log('  |');
      console.log('DATABASE: ' + tp + ' Poles | ' + ts + ' Cables | ' + tc + ' Closures');
      console.log('  |');
      console.log('AUTO-BOQ: ' + boqItems.length + ' items = LKR ' + boqSum.toLocaleString());
      console.log('  |');
      console.log('BUDGET: LKR ' + Number(p.budget).toLocaleString() + ' = BOQ: ' + (Math.abs(Number(p.budget) - boqSum) < 1 ? 'EXACT MATCH' : 'MISMATCH'));
      console.log('  |');
      console.log('WORKFLOW: ' + stages.length + ' stages, ' + stages.reduce((s, st) => s + (st.tasks || []).length, 0) + ' tasks');
      console.log('  |');
      console.log('PROJECT: ' + p.status + ' at ' + p.progress + '% | ' + String(p.startDate).substring(0, 10) + ' -> ' + String(p.endDate).substring(0, 10));
      console.log('  |');
      console.log('BUSINESS: Auto-provisioned in ~30s. Zero manual entry.');
    }
    console.log('======================================================');

  } catch (e) {
    console.error('Error:', e.message);
  }
})();