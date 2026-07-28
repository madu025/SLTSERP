import { Project, SyntaxKind } from 'ts-morph';
import { execSync } from 'child_process';
import * as fs from 'fs';

const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
});

// Remove tsbuildinfo before starting to ensure clean state
try {
    fs.unlinkSync('tsconfig.tsbuildinfo');
} catch (e) {
    // Ignore if not exists
}

const allFiles = project.getSourceFiles().filter(f => f.getFilePath().includes('/src/'));
let anyFiles = [];

for (const f of allFiles) {
    if (f.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0) {
        anyFiles.push(f);
    }
}

console.log(`[BISECT] Found ${anyFiles.length} files containing 'any'. Starting safe purge...`);

let successCount = 0;
let failCount = 0;

for (let i = 0; i < anyFiles.length; i++) {
    const sourceFile = anyFiles[i];
    const filePath = sourceFile.getFilePath();
    
    // Save original content
    const originalText = sourceFile.getFullText();
    let fileModified = false;
    let replacedCount = 0;

    const anyNodes = sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword);
    for (let j = anyNodes.length - 1; j >= 0; j--) {
        const anyNode = anyNodes[j];
        const parent = anyNode.getParent();
        
        if (parent && parent.getKind() === SyntaxKind.ArrayType) {
            parent.replaceWithText('Record<string, unknown>[]');
        } else {
            anyNode.replaceWithText('Record<string, unknown>');
        }
        fileModified = true;
        replacedCount++;
    }

    if (!fileModified) continue;

    // Save and test
    sourceFile.saveSync();
    
    try {
        console.log(`[BISECT] Testing ${i+1}/${anyFiles.length}: ${filePath} (${replacedCount} replacements)...`);
        execSync('npx tsc --noEmit', { stdio: 'ignore' });
        console.log(`  ✅ SUCCESS! Purged 'any' without breaking build.`);
        successCount++;
    } catch (e) {
        // Revert on failure
        console.log(`  ❌ FAILED. Reverting file to preserve 0 errors.`);
        sourceFile.replaceWithText(originalText);
        sourceFile.saveSync();
        failCount++;
    }
}

console.log(`\n[BISECT SUMMARY]`);
console.log(`Successfully purged 'any' in ${successCount} files.`);
console.log(`Reverted ${failCount} files due to strict typing constraints (requires manual DTOs).`);
