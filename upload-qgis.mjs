// QGIS Upload Script - Uses fetch with cookie auth
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read fresh token
const TOKEN = fs.readFileSync('D:\\MyProject\\SLTSERP\\.auth\\fresh_token.txt', 'utf-8').trim();
console.log(`Using token: ${TOKEN.substring(0, 30)}...`);

const BASE = 'http://localhost:3000';

async function api(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { 'Cookie': `token=${TOKEN}`, ...(options.headers || {}) };
    if (options.body) headers['Content-Type'] = 'application/json';
    
    const req = http.request(url.toString(), {
      method: options.method || 'GET',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  // STEP 1: Upload
  console.log('\n📤 STEP 1: Uploading QGIS files...');
  
  const geoJSONDir = path.join(__dirname, 'KL-SVK-0567', 'GeoJSON');
  const files = [
    'KL-SVK-0567_Cables.geojson',
    'KL-SVK-0567_Poles.geojson', 
    'KL-SVK-0567_FDP.geojson',
    'KL-SVK-0567_FJ.geojson',
    'KL-SVK-0567_Road_EOPs.geojson'
  ];
  
  const fileData = files.map(f => {
    const fullPath = path.join(geoJSONDir, f);
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { fileName: f, fileData: Buffer.from(content).toString('base64') };
  });
  
  console.log(`Uploading ${fileData.length} GeoJSON files...`);
  const uploadRes = await api('/api/gis/upload', {
    method: 'POST',
    body: JSON.stringify({
      files: fileData,
      projectName: 'KL-SVK-0567 Fiber Project',
      region: 'Eastern',
      district: 'Kalmunai',
      createdById: 'cmq7nq9860000sihs2dtstxg1',
    }),
  });
  
  console.log(`Upload: ${uploadRes.status}`);
  console.log(JSON.stringify(uploadRes.data, null, 2));
  
  if (!uploadRes.data.importId) {
    console.log('\n❌ Upload failed - no importId');
    return;
  }
  
  const importId = uploadRes.data.importId;
  console.log(`\n✅ Import ID: ${importId}`);
  
  // STEP 2: Process
  console.log('\n⚙️  STEP 2: Processing GIS import...');
  const processRes = await api('/api/gis/process', {
    method: 'POST',
    body: JSON.stringify({ importId }),
  });
  
  console.log(`Process: ${processRes.status}`);
  console.log(JSON.stringify(processRes.data, null, 2));
  
  if (processRes.status === 200) {
    console.log('\n✅✅✅ PROJECT CREATED SUCCESSFULLY!');
    const r = processRes.data.result || processRes.data;
    console.log(`   Project Code: ${r.projectCode || 'N/A'}`);
    console.log(`   Project ID: ${r.projectId || 'N/A'}`);
  }
}

main().catch(err => console.error('Error:', err.message));
