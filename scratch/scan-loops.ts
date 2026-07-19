import * as fs from 'fs';
import * as path from 'path';

const dirs = [
  'd:/MyProject/SLTSERP/src/services/inventory',
  'd:/MyProject/SLTSERP/src/services/finance',
  'd:/MyProject/SLTSERP/src/services/invoice',
  'd:/MyProject/SLTSERP/src/services/notification'
];

interface Issue {
  file: string;
  line: number;
  content: string;
  type: string;
}

const issues: Issue[] = [];

function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let inLoop = false;
  let loopStartLine = -1;
  let loopBraceCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Simple block/brace tracker
    if (inLoop) {
      if (line.includes('{')) loopBraceCount += (line.match(/{/g) || []).length;
      if (line.includes('}')) loopBraceCount -= (line.match(/}/g) || []).length;
      
      if (line.includes('await') && (line.includes('prisma') || line.includes('tx') || line.includes('Repository') || line.includes('Service'))) {
        issues.push({
          file: path.relative('d:/MyProject/SLTSERP', filePath),
          line: i + 1,
          content: line.trim(),
          type: `Database/Service call 'await' inside loop starting at line ${loopStartLine}`
        });
      }
      
      if (loopBraceCount <= 0) {
        inLoop = false;
      }
    }
    
    // Detect start of loop
    if (!inLoop) {
      if (
        (line.includes('for ') && line.includes('(')) ||
        line.includes('.forEach(') ||
        (line.includes('.map(') && line.includes('async'))
      ) {
        inLoop = true;
        loopStartLine = i + 1;
        loopBraceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        if (loopBraceCount <= 0 && line.includes('{')) {
          loopBraceCount = 1;
        }
      }
    }
  }
}

function scanDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      scanFile(fullPath);
    }
  }
}

for (const dir of dirs) {
  scanDir(dir);
}

fs.writeFileSync('d:/MyProject/SLTSERP/scratch/scan-results.json', JSON.stringify(issues, null, 2));
console.log(`Scan complete. Found ${issues.length} potential loop issues.`);
