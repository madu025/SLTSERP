/**
 * Project Module Frontend Fix Script
 * Fixes:
 * 1. alert() → toast.error() / toast.success() / toast.warning()
 * 2. console.log/error/warn → removed
 * 3. status.replace('_', ' ') → replace(/_/g, ' ')
 * 4. Adds sonner import where missing
 *
 * Usage: node scripts/fix-project-components.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const COMPONENT_DIRS = [
  path.join(ROOT, 'src', 'components', 'projects'),
];
const PAGE_FILES = [
  path.join(ROOT, 'src', 'app', 'projects', '[id]', 'page.tsx'),
  path.join(ROOT, 'src', 'app', 'projects', 'page.tsx'),
];

// ─── Alert → toast classification ────────────────────────────────────────────
// Keywords that indicate success
const SUCCESS_KEYWORDS = ['success', 'submitted', 'commissioned'];
// Keywords that indicate validation / warning
const VALIDATION_KEYWORDS = ['required', 'fill', 'please select', 'coming soon'];

function classifyAlert(alertText) {
  const lower = alertText.toLowerCase();
  if (SUCCESS_KEYWORDS.some(k => lower.includes(k))) return 'success';
  if (VALIDATION_KEYWORDS.some(k => lower.includes(k))) return 'warning';
  return 'error';
}

// ─── Fix a single file ────────────────────────────────────────────────────────
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  let needsSonner = false;
  const fileName = path.basename(filePath);

  // ── 1. Replace alert() calls ──────────────────────────────────────────────
  const alertRegex = /alert\(([^)]+)\)/g;
  const alertMatches = [...content.matchAll(alertRegex)];

  if (alertMatches.length > 0) {
    content = content.replace(alertRegex, (match, arg) => {
      const type = classifyAlert(arg);
      needsSonner = true;
      changed = true;
      if (type === 'success') return `toast.success(${arg})`;
      if (type === 'warning') return `toast.error(${arg})`; // warnings as error for now
      return `toast.error(${arg})`;
    });
    console.log(`  [ALERT→TOAST] ${fileName}: ${alertMatches.length} alerts replaced`);
  }

  // ── 2. Remove console.log / console.error / console.warn lines ───────────
  const consoleRegex = /^\s*console\.(log|error|warn|debug)\([^)]*\);\s*\n?/gm;
  const consoleMatches = [...content.matchAll(consoleRegex)];
  if (consoleMatches.length > 0) {
    content = content.replace(consoleRegex, '');
    changed = true;
    console.log(`  [CONSOLE] ${fileName}: ${consoleMatches.length} console calls removed`);
  }

  // Some console calls span multiple lines — handle those too
  const multilineConsole = /^\s*console\.(log|error|warn|debug)\([\s\S]*?\);\s*\n/gm;
  const mlMatches = [...content.matchAll(multilineConsole)];
  if (mlMatches.length > 0) {
    content = content.replace(multilineConsole, '');
    changed = true;
    console.log(`  [CONSOLE-ML] ${fileName}: ${mlMatches.length} multiline console calls removed`);
  }

  // ── 3. Fix replace('_', ' ') → replace(/_/g, ' ') ────────────────────────
  const replaceUnderscoreRegex = /\.replace\(['"]_['"]\s*,\s*['"]\s*['"]\)/g;
  const replaceMatches = [...content.matchAll(replaceUnderscoreRegex)];
  if (replaceMatches.length > 0) {
    content = content.replace(replaceUnderscoreRegex, `.replace(/_/g, ' ')`);
    changed = true;
    console.log(`  [REPLACE] ${fileName}: ${replaceMatches.length} replace() patterns fixed`);
  }

  // ── 4. Add sonner import if needed and not already present ────────────────
  if (needsSonner && !content.includes("from 'sonner'")) {
    // Find the last import line and add after it
    const lastImportMatch = [...content.matchAll(/^import .+;?\s*$/gm)].pop();
    if (lastImportMatch) {
      const insertPos = lastImportMatch.index + lastImportMatch[0].length;
      content = content.slice(0, insertPos) + `\nimport { toast } from 'sonner';` + content.slice(insertPos);
      changed = true;
      console.log(`  [IMPORT] ${fileName}: Added sonner import`);
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  return false;
}

// ─── Main ────────────────────────────────────────────────────────────────────
function main() {
  let totalFixed = 0;
  let totalFiles = 0;

  // Process component directories
  for (const dir of COMPONENT_DIRS) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
    for (const file of files) {
      const filePath = path.join(dir, file);
      totalFiles++;
      process.stdout.write(`Processing ${file}... `);
      const fixed = fixFile(filePath);
      if (fixed) {
        totalFixed++;
        console.log('✅');
      } else {
        console.log('(no changes)');
      }
    }
  }

  // Process page files
  for (const filePath of PAGE_FILES) {
    if (fs.existsSync(filePath)) {
      totalFiles++;
      const fileName = path.basename(path.dirname(filePath)) + '/' + path.basename(filePath);
      process.stdout.write(`Processing ${fileName}... `);
      const fixed = fixFile(filePath);
      if (fixed) {
        totalFixed++;
        console.log('✅');
      } else {
        console.log('(no changes)');
      }
    }
  }

  console.log(`\n📊 Summary: ${totalFixed}/${totalFiles} files modified`);
}

main();
