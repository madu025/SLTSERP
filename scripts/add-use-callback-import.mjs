/**
 * Adds useCallback import to components that use fetch but lack it.
 * Also ensures useCallback is in the React import.
 * 
 * Usage: node scripts/add-use-callback-import.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'src', 'components', 'projects');

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.tsx'));

let updated = 0;

for (const file of files) {
  const filePath = path.join(DIR, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  // Only process files that have fetch() but no useCallback
  const hasFetch = /\bfetch\(/.test(content);
  const hasUseCallback = /\buseCallback\b/.test(content);

  if (hasFetch && !hasUseCallback) {
    // Add useCallback to React import
    // Pattern: import React, { use, useEffect, useState, ... } from 'react';
    // or: import { useEffect, useState, ... } from 'react';
    content = content.replace(
      /import React,\s*\{([^}]+)\}\s*from\s*'react'/,
      (match, imports) => {
        const importList = imports.split(',').map(s => s.trim()).filter(Boolean);
        if (!importList.includes('useCallback')) {
          importList.push('useCallback');
          importList.sort();
        }
        return `import React, { ${importList.join(', ')} } from 'react'`;
      }
    );
    content = content.replace(
      /import\s*\{([^}]+)\}\s*from\s*'react'/,
      (match, imports) => {
        if (match.includes('React,')) return match; // already handled above
        const importList = imports.split(',').map(s => s.trim()).filter(Boolean);
        if (!importList.includes('useCallback')) {
          importList.push('useCallback');
          importList.sort();
        }
        return `import { ${importList.join(', ')} } from 'react'`;
      }
    );
    changed = true;
    console.log(`  [useCallback import] Added to ${file}`);
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    updated++;
  }
}

console.log(`\nUpdated ${updated} files with useCallback import`);
