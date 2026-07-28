import { Project, SyntaxKind } from 'ts-morph';
import path from 'path';

const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
});

let catchCount = 0;
let modifiedFiles = 0;

for (const sourceFile of project.getSourceFiles()) {
    if (!sourceFile.getFilePath().includes('/src/')) continue;

    let fileModified = false;
    let needsErrorUtil = false;

    const catchClauses = sourceFile.getDescendantsOfKind(SyntaxKind.CatchClause);
    
    for (const catchClause of catchClauses) {
        const variableDecl = catchClause.getVariableDeclaration();
        if (variableDecl) {
            const typeNode = variableDecl.getTypeNode();
            if (!typeNode || typeNode.getKind() === SyntaxKind.AnyKeyword) {
                // Set the catch variable type to strict unknown
                variableDecl.setType('unknown');
                const catchVarName = variableDecl.getName();
                const block = catchClause.getBlock();

                // Find all property accesses inside this catch block
                const propAccesses = block.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
                
                // Reverse iteration to avoid invalidating AST nodes
                for (let i = propAccesses.length - 1; i >= 0; i--) {
                    const propAccess = propAccesses[i];
                    const expression = propAccess.getExpression();
                    
                    // If the property access is on the catch variable (e.g. e.message)
                    if (expression.getText() === catchVarName) {
                        const propName = propAccess.getName();
                        
                        if (propName === 'message') {
                            propAccess.replaceWithText(`ErrorUtil.getMessage(${catchVarName})`);
                            needsErrorUtil = true;
                        } else if (propName === 'code') {
                            propAccess.replaceWithText(`ErrorUtil.getCode(${catchVarName})`);
                            needsErrorUtil = true;
                        } else {
                            propAccess.replaceWithText(`ErrorUtil.parseError(${catchVarName}).${propName}`);
                            needsErrorUtil = true;
                        }
                    }
                }
                
                fileModified = true;
                catchCount++;
            }
        }
    }

    if (fileModified) {
        if (needsErrorUtil) {
            const hasErrorUtilImport = sourceFile.getImportDeclarations().some(imp => 
                imp.getNamedImports().some(n => n.getName() === 'ErrorUtil')
            );
            
            if (!hasErrorUtilImport) {
                const srcDir = path.resolve('src');
                const utilsDir = path.join(srcDir, 'utils');
                const currentFileDir = path.dirname(sourceFile.getFilePath());
                
                let relativePath = path.relative(currentFileDir, utilsDir).replace(/\\/g, '/');
                if (!relativePath.startsWith('.')) {
                    relativePath = './' + relativePath;
                }
                
                sourceFile.addImportDeclaration({
                    namedImports: ['ErrorUtil'],
                    moduleSpecifier: `${relativePath}/error.util`,
                });
            }
        }
        
        sourceFile.saveSync();
        modifiedFiles++;
    }
}

console.log(`[CODEMOD] Finished! Refactored ${catchCount} untyped catch blocks across ${modifiedFiles} files.`);
