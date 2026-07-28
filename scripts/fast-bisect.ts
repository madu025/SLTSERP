import { Project, SyntaxKind } from 'ts-morph';

const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
});

// We only process files that have `any`
const anyFiles = project.getSourceFiles().filter(f => f.getFilePath().includes('/src/') && f.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0);

console.log(`[BISECT] Found ${anyFiles.length} files containing 'any'.`);

let successCount = 0;
let failCount = 0;

for (let i = 0; i < anyFiles.length; i++) {
    const sourceFile = anyFiles[i];
    const filePath = sourceFile.getFilePath();
    
    // Get baseline errors for THIS file
    const baselineErrors = sourceFile.getPreEmitDiagnostics().length;

    // Save original AST state
    const originalText = sourceFile.getFullText();
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
        replacedCount++;
    }

    // Check diagnostics just for this file
    const currentErrors = sourceFile.getPreEmitDiagnostics().length;
    
    if (currentErrors > baselineErrors) {
        // Revert
        sourceFile.replaceWithText(originalText);
        failCount++;
    } else {
        console.log(`  ✅ ${filePath} (${replacedCount} replacements) OK!`);
        sourceFile.saveSync();
        successCount++;
    }
}

console.log(`\n[BISECT SUMMARY]`);
console.log(`Successfully purged 'any' in ${successCount} files.`);
console.log(`Reverted ${failCount} files due to strict typing constraints.`);
