import { Project, SyntaxKind } from "ts-morph";

// Define the role groups locally since we can't easily import from the workspace dynamically without compiling
const ROLE_GROUPS = {
    ADMINS: ['SUPER_ADMIN', 'ADMIN'],
    STORES: ['STORES_MANAGER', 'STORES_ASSISTANT'],
    OPS: ['OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'],
    FINANCE: ['FINANCE_MANAGER', 'FINANCE_ASSISTANT'],
    INVOICE: ['INVOICE_MANAGER', 'INVOICE_ASSISTANT'],
    OFFICE: ['OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF'],
    FINANCE_APPROVERS: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
    FINANCE_ALL: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT'],
    STORES_MANAGERS: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'],
    STORES_ALL: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT'],
    PROJECT_MANAGERS: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
    SF_AUDITORS: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER'],
    OFFICE_ADMINS: ['SUPER_ADMIN', 'ADMIN', 'OFFICE_ADMIN'],
};

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const roleGroupMapping = new Map<string, string>();
for (const [key, value] of Object.entries(ROLE_GROUPS)) {
  const sortedValue = [...value].sort();
  roleGroupMapping.set(JSON.stringify(sortedValue), key);
}

function findMatchingRoleGroup(arrayElements: string[]): string | null {
  const sortedElements = [...arrayElements].sort();
  const key = JSON.stringify(sortedElements);
  return roleGroupMapping.get(key) || null;
}

let modifiedCount = 0;

for (const sourceFile of project.getSourceFiles()) {
  if (sourceFile.getFilePath().includes("node_modules")) continue;
  if (sourceFile.getFilePath().endsWith("roles.ts")) continue;

  let fileModified = false;

  const arrayLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression);

  for (const arrayLiteral of arrayLiterals) {
    const parent = arrayLiteral.getParent();
    
    let isRoleArray = false;
    
    if (parent.getKind() === SyntaxKind.JsxExpression) {
        const jsxAttr = parent.getParent();
        if (jsxAttr && jsxAttr.getKind() === SyntaxKind.JsxAttribute) {
            const attrNode = jsxAttr.asKind(SyntaxKind.JsxAttribute);
            if (attrNode && attrNode.getText().startsWith("allowedRoles")) isRoleArray = true;
        }
    } else if (parent.getKind() === SyntaxKind.PropertyAssignment) {
      const propNode = parent.asKind(SyntaxKind.PropertyAssignment);
      const propName = propNode?.getName();
      if (propName === "roles" || propName === "allowedRoles") {
        isRoleArray = true;
      }
    }

    if (isRoleArray) {
      const elements = arrayLiteral.getElements();
      const allStrings = elements.every(el => el.getKind() === SyntaxKind.StringLiteral);
      
      if (allStrings) {
        const stringValues = elements.map(el => el.getText().replace(/['"]/g, ""));
        const match = findMatchingRoleGroup(stringValues);
        
        if (match) {
          arrayLiteral.replaceWithText(`ROLE_GROUPS.${match}`);
          fileModified = true;
        }
      }
    }
  }

  if (fileModified) {
    const imports = sourceFile.getImportDeclarations();
    const hasRoleGroupsImport = imports.some(imp => 
      imp.getNamedImports().some(named => named.getName() === "ROLE_GROUPS")
    );

    if (!hasRoleGroupsImport) {
      sourceFile.addImportDeclaration({
        namedImports: ["ROLE_GROUPS"],
        moduleSpecifier: "@/config/roles"
      });
    }

    sourceFile.saveSync();
    modifiedCount++;
    console.log(`Refactored roles in: ${sourceFile.getFilePath()}`);
  }
}

console.log(`\nFinished refactoring. Modified ${modifiedCount} files.`);
