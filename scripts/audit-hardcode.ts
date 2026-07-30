import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(__dirname, '../src');

// Common hardcode patterns
const patterns = {
  // Passwords, secrets, tokens (e.g. password: '...', apiKey="...")
  credentials: /(password|passwd|pwd|secret|api_key|apikey|token)["']?\s*[:=]\s*["']([^"']+)["']/i, 
  // Hardcoded QField fallback or generic username fallback
  specificCredentials: /(username|user)["']?\s*[:=]\s*["']admin["']/i,
  // Localhost URLs
  localhost: /http:\/\/localhost(:\d+)?/gi,
  // MongoDB ObjectIds (24 hex chars) or UUIDs
  hardcodedIds: /["'][0-9a-fA-F]{24}["']|["'][0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}["']/i, 
};

const EXCLUDED_DIRS = ['node_modules', '.next', 'dist', 'build', '.git'];
// Exclude files that naturally have generated UUIDs or are tests, and UI documentation pages that show localhosts
const EXCLUDED_FILES = ['.test.ts', '.spec.ts', 'mock', 'seed.ts', 'admin/monitoring/page.tsx', 'login/page.tsx'];

function isExcludedFile(filePath: string) {
  // Normalize path separators to forward slash for cross-platform matching
  const normalizedPath = filePath.replace(/\\/g, '/');
  return EXCLUDED_FILES.some(ex => normalizedPath.toLowerCase().includes(ex.toLowerCase()));
}

function walkDir(dir: string, callback: (filePath: string) => void) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (EXCLUDED_DIRS.includes(file)) continue;
    
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else {
      if (
        (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) &&
        !isExcludedFile(filePath)
      ) {
        callback(filePath);
      }
    }
  }
}

let totalIssues = 0;

console.log('================================================');
console.log('🚀 Starting SLTSERP Hardcode Audit...');
console.log('================================================\n');

walkDir(SRC_DIR, (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    // Skip imports and comments to reduce false positives
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('import ') || trimmed.startsWith('export *')) return;
    
    let matched = false;

    if (patterns.credentials.test(line) || patterns.specificCredentials.test(line)) {
      // Avoid false positive on types/interfaces (e.g., password?: string)
      if (!trimmed.includes('?: string') && !trimmed.includes(': string')) {
        console.log(`[🔴 CREDENTIAL] ${filePath}:${lineNumber}`);
        console.log(`  => ${trimmed.substring(0, 100)}`);
        matched = true;
      }
    }
    
    if (!matched && patterns.localhost.test(line)) {
      console.log(`[🟡 LOCALHOST] ${filePath}:${lineNumber}`);
      console.log(`  => ${trimmed.substring(0, 100)}`);
      matched = true;
    }

    if (!matched && patterns.hardcodedIds.test(line)) {
      console.log(`[🔵 HARDCODED_ID] ${filePath}:${lineNumber}`);
      console.log(`  => ${trimmed.substring(0, 100)}`);
      matched = true;
    }

    if (matched) totalIssues++;
  });
});

console.log(`\n================================================`);
console.log(`✅ Audit Complete. Total Potential Issues: ${totalIssues}`);
console.log(`================================================`);

if (totalIssues > 0) {
  process.exit(1);
}
