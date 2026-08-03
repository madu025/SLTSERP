// Count try/catch blocks in API routes and classify them
const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'src', 'app', 'api');
const results = [];

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === 'route.ts') results.push(full);
    }
}
walk(API_DIR);

let totalTry = 0;
const detail = [];
for (const file of results) {
    const src = fs.readFileSync(file, 'utf8');
    const tryCount = (src.match(/^\s*try\s*\{/gm) || []).length;
    if (!tryCount) continue;
    totalTry += tryCount;
    const rel = path.relative(API_DIR, file).replace(/\\/g, '/');
    // classify: does the catch rethrow / map to AppError, or swallow / return NextResponse directly?
    const catches = src.match(/catch\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/g) || [];
    let suspicious = 0;
    for (const c of catches) {
        const hasThrow = /\bthrow\b/.test(c);
        const swallows = !hasThrow; // catch without rethrow = potential swallow
        if (swallows) suspicious++;
    }
    detail.push({ file: rel, tryCount, catches: catches.length, potentialSwallows: suspicious });
}

detail.sort((a, b) => b.tryCount - a.tryCount);
console.log(`Total route files: ${results.length}`);
console.log(`Files with try/catch: ${detail.length}`);
console.log(`Total try blocks: ${totalTry}`);
console.log(`Catches WITHOUT rethrow (potential swallows): ${detail.reduce((s, d) => s + d.potentialSwallows, 0)}`);
console.log('---');
for (const d of detail) {
    console.log(`${d.file.padEnd(55)} try=${d.tryCount} swallow-risk=${d.potentialSwallows}`);
}
