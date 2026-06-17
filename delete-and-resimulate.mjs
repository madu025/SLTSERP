// Delete old project and re-run simulation to verify fixes
import { execSync } from 'child_process';

console.log('========================================');
console.log('  DELETE OLD PROJECT + RE-SIMULATE');
console.log('========================================\n');

// Step 1: Delete the old project via API
console.log('--- Step 1: Delete old project ---');
try {
  const token = execSync('node -e "fetch(\'http://localhost:3000/api/login\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({username:\'admin\',password:\'Admin@123\'})}).then(r=>{const c=r.headers.get(\'set-cookie\')||\'\';const t=c.match(/token=([^;]+)/)?.[1]||\'\';return fetch(\'http://localhost:3000/api/projects?id=cmqho74t00000siro1q73uiv7\',{method:\'DELETE\',headers:{\'Cookie\':\'token=\'+t}})}).then(r=>r.json()).then(console.log)"', { encoding: 'utf-8', stdio: 'pipe', timeout: 10000 });
  console.log('Delete result:', token.trim());
} catch (e) {
  console.log('Delete attempt:', e.message.substring(0, 100));
}

// Wait a moment
await new Promise(r => setTimeout(r, 2000));

// Step 2: Run the simulation
console.log('\n--- Step 2: Re-run simulation ---');
try {
  const result = execSync('node simulate-gis-project.mjs', { 
    encoding: 'utf-8', 
    stdio: 'pipe', 
    timeout: 120000,
    cwd: process.cwd()
  });
  console.log(result);
} catch (e) {
  if (e.stdout) console.log(e.stdout);
  if (e.stderr) console.error(e.stderr);
  if (!e.stdout && !e.stderr) console.error(e.message);
}