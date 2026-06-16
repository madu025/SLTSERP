import http from 'http';
import fs from 'fs';

const TOKEN = fs.readFileSync('D:\\MyProject\\SLTSERP\\.auth\\fresh_token.txt', 'utf-8').trim();

http.get('http://localhost:3000/api/projects', {
  headers: { 'Cookie': `token=${TOKEN}` }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const projects = JSON.parse(data);
    console.log(JSON.stringify(projects, null, 2));
    // Find OSP FTTH project
    if (Array.isArray(projects)) {
      const osp = projects.find(p => p.code && p.code.includes('FOSP'));
      if (osp) {
        console.log(`\n✅ Latest OSP Project: ${osp.code} | ID: ${osp.id}`);
        fs.writeFileSync('D:\\MyProject\\SLTSERP\\.auth\\project_id.txt', osp.id, 'utf-8');
      } else if (projects.length > 0) {
        const last = projects[projects.length - 1];
        console.log(`\n📌 Latest Project: ${last.name || last.code} | ID: ${last.id}`);
        fs.writeFileSync('D:\\MyProject\\SLTSERP\\.auth\\project_id.txt', last.id, 'utf-8');
      }
    }
  });
}).on('error', e => console.error('Error:', e.message));
