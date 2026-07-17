import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(WORKSPACE_ROOT, '.agent', 'CODEMAP.md');

interface ServiceInfo {
  filePath: string;
  className?: string;
  methods: { name: string; parameters: string; returnType: string }[];
  functions: { name: string; parameters: string; returnType: string }[];
}

interface ApiRouteInfo {
  filePath: string;
  routePath: string;
  methods: string[];
}

interface PrismaModelInfo {
  fileName: string;
  modelName: string;
  fields: { name: string; type: string; attributes: string }[];
}

// Recursively find all files in a directory matching extensions
function getFilesRecursively(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath, extensions));
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

function parseTypeScriptFile(filePath: string, relativePath: string): ServiceInfo {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);

  const info: ServiceInfo = {
    filePath: relativePath,
    methods: [],
    functions: []
  };

  function visitor(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name) {
      const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
      if (hasExport) {
        info.className = node.name.text;
        
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name) {
            const methodName = member.name.getText(sourceFile);
            
            // Skip private/protected methods to keep the map concise
            const isPrivate = member.modifiers?.some(
              m => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword
            );
            if (isPrivate) continue;

            const params = member.parameters.map(p => p.getText(sourceFile)).join(', ');
            const returnType = member.type ? member.type.getText(sourceFile) : 'any';
            info.methods.push({ name: methodName, parameters: params, returnType });
          }
        }
      }
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
      if (hasExport) {
        const funcName = node.name.text;
        const params = node.parameters.map(p => p.getText(sourceFile)).join(', ');
        const returnType = node.type ? node.type.getText(sourceFile) : 'any';
        info.functions.push({ name: funcName, parameters: params, returnType });
      }
    }

    ts.forEachChild(node, visitor);
  }

  ts.forEachChild(sourceFile, visitor);
  return info;
}

function parseApiRoute(filePath: string, relativePath: string): ApiRouteInfo {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);

  const methods: string[] = [];

  function visitor(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const funcName = node.name.text;
      if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(funcName)) {
        const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        if (hasExport) {
          methods.push(funcName);
        }
      }
    } else if (ts.isVariableStatement(node)) {
      const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
      if (hasExport) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            const varName = decl.name.text;
            if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(varName)) {
              methods.push(varName);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visitor);
  }

  ts.forEachChild(sourceFile, visitor);

  let routePath = relativePath
    .replace(/^src\/app/, '')
    .replace(/\\/g, '/')
    .replace(/\/route\.ts$/, '');
  if (!routePath.startsWith('/')) {
    routePath = '/' + routePath;
  }

  return { filePath: relativePath, routePath, methods };
}

function parsePrismaFile(filePath: string, relativePath: string): PrismaModelInfo[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const models: PrismaModelInfo[] = [];

  const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1];
    const body = match[2];
    const fields: { name: string; type: string; attributes: string }[] = [];

    const lines = body.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
      
      const fieldMatch = line.match(/^(\w+)\s+(\w+(?:\[\])?\??)(.*)$/);
      if (fieldMatch) {
        fields.push({
          name: fieldMatch[1],
          type: fieldMatch[2],
          attributes: fieldMatch[3].trim()
        });
      }
    }

    models.push({
      fileName: relativePath,
      modelName,
      fields
    });
  }

  return models;
}

function main() {
  console.log('Generating codebase structural map...');

  // 1. Process services
  const serviceFiles = getFilesRecursively(path.join(WORKSPACE_ROOT, 'src', 'services'), ['.ts']);
  const services: ServiceInfo[] = [];
  for (const file of serviceFiles) {
    const rel = path.relative(WORKSPACE_ROOT, file).replace(/\\/g, '/');
    if (file.endsWith('.json') || file.includes('nexus-model') || file.includes('nexus-training-data')) continue;
    services.push(parseTypeScriptFile(file, rel));
  }

  // 2. Process API routes
  const apiFiles = getFilesRecursively(path.join(WORKSPACE_ROOT, 'src', 'app', 'api'), ['.ts']);
  const apiRoutes: ApiRouteInfo[] = [];
  for (const file of apiFiles) {
    if (path.basename(file) !== 'route.ts') continue;
    const rel = path.relative(WORKSPACE_ROOT, file).replace(/\\/g, '/');
    apiRoutes.push(parseApiRoute(file, rel));
  }

  // 3. Process Prisma schemas
  const prismaFiles = getFilesRecursively(path.join(WORKSPACE_ROOT, 'prisma', 'schema'), ['.prisma']);
  let prismaModels: PrismaModelInfo[] = [];
  for (const file of prismaFiles) {
    const rel = path.relative(WORKSPACE_ROOT, file).replace(/\\/g, '/');
    prismaModels = prismaModels.concat(parsePrismaFile(file, rel));
  }
  const rootPrisma = path.join(WORKSPACE_ROOT, 'prisma', 'schema.prisma');
  if (fs.existsSync(rootPrisma)) {
    const rel = path.relative(WORKSPACE_ROOT, rootPrisma).replace(/\\/g, '/');
    prismaModels = prismaModels.concat(parsePrismaFile(rootPrisma, rel));
  }

  // Generate markdown output
  let md = `# SLTSERP Codebase Structural Map\n\n`;
  md += `> [!NOTE]\n`;
  md += `> This map is auto-generated by \`scripts/generate-codemap.ts\`. Refer to this document to locate class declarations, service methods, API routes, and database models directly, avoiding expensive broad workspace grepping.\n\n`;

  // TOC
  md += `## Table of Contents\n\n`;
  md += `- [1. Business Logic Services (src/services)](#1-business-logic-services-srcservices)\n`;
  md += `- [2. Next.js API Routes (src/app/api)](#2-nextjs-api-routes-srcappapi)\n`;
  md += `- [3. Database Models (prisma/schema)](#3-database-models-prismaschema)\n\n`;

  // Write Services
  md += `## 1. Business Logic Services (src/services)\n\n`;
  for (const s of services) {
    if (!s.className && s.functions.length === 0) continue;
    
    md += `### [${path.basename(s.filePath)}](${s.filePath})\n`;
    if (s.className) {
      md += `* **Class**: \`${s.className}\`\n`;
      if (s.methods.length > 0) {
        md += `  * **Methods**:\n`;
        for (const m of s.methods) {
          md += `    * \`${m.name}(${m.parameters}): ${m.returnType}\`\n`;
        }
      }
    }
    if (s.functions.length > 0) {
      md += `* **Exported Functions**:\n`;
      for (const f of s.functions) {
        md += `  * \`${f.name}(${f.parameters}): ${f.returnType}\`\n`;
      }
    }
    md += `\n`;
  }

  // Write API Routes
  md += `## 2. Next.js API Routes (src/app/api)\n\n`;
  md += `| Route Path | File Location | Supported Methods |\n`;
  md += `| :--- | :--- | :--- |\n`;
  for (const r of apiRoutes) {
    const methodsStr = r.methods.map(m => `\`${m}\``).join(', ') || '*dynamic*';
    md += `| \`${r.routePath}\` | [${path.basename(r.filePath)}](${r.filePath}) | ${methodsStr} |\n`;
  }
  md += `\n`;

  // Write Prisma Models
  md += `## 3. Database Models (prisma/schema)\n\n`;
  for (const m of prismaModels) {
    md += `### [${m.modelName}](${m.fileName})\n`;
    md += `* **Fields**:\n`;
    for (const f of m.fields) {
      const attrStr = f.attributes ? ` \`[${f.attributes}]\`` : '';
      md += `  * \`${f.name}: ${f.type}\`${attrStr}\n`;
    }
    md += `\n`;
  }

  const outDir = path.dirname(OUT_FILE);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUT_FILE, md, 'utf8');
  console.log(`Successfully generated codebase map at ${OUT_FILE}`);
}

main();
