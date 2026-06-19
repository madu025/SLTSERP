import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('--- TESTING DYNAMIC INJECTION FLOW ---');

  // 1. Get or create test project
  let project = await prisma.project.findFirst({
    where: { projectCode: 'TEST-QFIELD-001' }
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        projectCode: 'TEST-QFIELD-001',
        name: 'Automated Injection Testing',
        description: 'Test project for dynamic field configuration',
        type: 'OSP',
        status: 'PLANNING',
        budget: 10000,
        location: 'Colombo',
      }
    });
    console.log(`Created test project ID: ${project.id}`);
  } else {
    console.log(`Using existing test project ID: ${project.id}`);
  }

  // 2. Setup mock configurations
  console.log('Setting up mock configurations in DB...');
  await prisma.qFieldFieldConfig.deleteMany({ where: { projectId: project.id } });

  const testConfigs = [
    {
      projectId: project.id,
      layerId: 'SLT_Poles',
      fieldName: 'POLE TYPE',
      options: ['Concrete', 'GI', 'Spun', 'Wood', 'CustomFiberglass']
    },
    {
      projectId: project.id,
      layerId: 'SLT_Poles',
      fieldName: 'Exist_New',
      options: ['Existing', 'New', 'Relocated', 'ToBeRemoved']
    },
    {
      projectId: project.id,
      layerId: 'SLT_Cables',
      fieldName: 'Cable_Type',
      options: ['12F SM', '24F SM', '48F SM', '96F SM']
    }
  ];

  await prisma.qFieldFieldConfig.createMany({ data: testConfigs });
  console.log('✅ Added mock configurations to database.');

  // 3. Replicate sync patching code locally to verify it
  const qgisTemplatePath = 'QGIS Project Template/QGIS.qgz';
  const resolvedPath = path.resolve(qgisTemplatePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: template not found at ${resolvedPath}`);
    return;
  }

  const tempDir = path.join(process.cwd(), 'tmp', `test-patch-${project.id}`);
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  const tempQgzPath = path.join(tempDir, 'QGIS.qgz');
  const tempConfigJsonPath = path.join(tempDir, 'config.json');

  // Copy template
  fs.copyFileSync(resolvedPath, tempQgzPath);

  // Read configs from DB and write to JSON file
  const configs = await prisma.qFieldFieldConfig.findMany({
    where: { projectId: project.id }
  });

  const configData: Record<string, Record<string, string[]>> = {};
  for (const c of configs) {
    if (!configData[c.layerId]) {
      configData[c.layerId] = {};
    }
    configData[c.layerId][c.fieldName] = c.options;
  }
  fs.writeFileSync(tempConfigJsonPath, JSON.stringify(configData, null, 2), 'utf-8');

  // Run patch-qgis-dynamic.py script
  console.log('Running patch-qgis-dynamic.py...');
  const pythonCmd = process.platform === 'win32' ? 'py' : 'python3';
  execSync(`"${pythonCmd}" scripts/patch-qgis-dynamic.py "${tempQgzPath}" "${tempConfigJsonPath}"`, {
    cwd: process.cwd(),
    stdio: 'inherit'
  });
  console.log('✅ Python patching script executed.');

  // 4. Verify modified QGS XML file using Python's built-in zipfile
  console.log('Verifying patched QGIS project archive via python standard zip library...');
  const verifyScriptPath = path.join(tempDir, 'verify.py');
  const verifyScript = `
import zipfile
with zipfile.ZipFile(r'${tempQgzPath}', 'r') as z:
    content = z.read('QGIS.qgs').decode('utf-8')
    print('POLE_TYPE_INJECTED' if 'CustomFiberglass' in content else 'POLE_TYPE_FAILED')
    print('EXIST_NEW_INJECTED' if 'ToBeRemoved' in content else 'EXIST_NEW_FAILED')
    print('CABLE_TYPE_INJECTED' if '96F SM' in content else 'CABLE_TYPE_FAILED')
`;
  
  fs.writeFileSync(verifyScriptPath, verifyScript, 'utf-8');
  const verifyRes = execSync(`"${pythonCmd}" "${verifyScriptPath}"`, { cwd: process.cwd() })
    .toString();

  console.log('Verification Results:\n', verifyRes);

  const allPassed = verifyRes.includes('POLE_TYPE_INJECTED') && 
                    verifyRes.includes('EXIST_NEW_INJECTED') && 
                    verifyRes.includes('CABLE_TYPE_INJECTED');

  if (allPassed) {
    console.log('🎉 ALL DYNAMIC INJECTION TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ SOME VERIFICATION TESTS FAILED.');
  }

  // Cleanup temp files
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('Cleaned up test directory.');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
