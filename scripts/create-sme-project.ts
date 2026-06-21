import { PrismaClient } from '@prisma/client';
import { QFieldCloudSyncService } from '../src/services/qfieldcloud-sync.service';

const prisma = new PrismaClient();
const baseUrl = process.env.NEXT_PUBLIC_QFIELD_API_URL || 'http://localhost:8011';

async function authenticate(): Promise<string> {
  const username = process.env.QFIELD_ADMIN_USER || 'admin';
  const password = process.env.QFIELD_ADMIN_PASS || 'admin123';
  const res = await fetch(`${baseUrl}/api/v1/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`Authentication failed: ${res.status}`);
  }
  const data: any = await res.json();
  return data.token || data.access_token;
}

async function main() {
  const projectCode = process.argv[2] || 'SME-0452';
  const name = process.argv[3] || 'Cluster Development Project';

  console.log(`Checking if project ${projectCode} exists in database...`);
  const existingProject = await prisma.project.findUnique({
    where: { projectCode },
  });

  if (existingProject) {
    console.log(`Project ${projectCode} exists. Deleting it to start clean...`);
    // Delete mapping from QFieldCloud if present
    const mapping = existingProject.gisMapping as any;
    if (mapping && mapping.qfieldProjectId) {
      try {
        const syncService = new QFieldCloudSyncService();
        await syncService.deleteQFieldProject(mapping.qfieldProjectId);
        console.log(`✅ Deleted QFieldCloud project ${mapping.qfieldProjectId}`);
      } catch (err) {
        console.log(`Warning: could not delete QField project ${mapping.qfieldProjectId}:`, err);
      }
    }
    await prisma.project.delete({
      where: { id: existingProject.id },
    });
    console.log(`✅ Deleted existing project ${projectCode} from DB.`);
  }

  console.log(`Creating new project ${projectCode} in database...`);
  const project = await prisma.project.create({
    data: {
      projectCode,
      name,
      description: 'Project for SME Cluster Development',
      type: 'OSP_FTTH',
      status: 'PLANNING',
      budget: 150000,
      location: 'Colombo',
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`✅ Project created in database. ID: ${project.id}`);

  // Create some sample dropdown configs for demonstration
  await prisma.qFieldFieldConfig.createMany({
    data: [
      // SLT_Poles Dropdowns
      {
        projectId: project.id,
        layerId: 'SLT_Poles',
        fieldName: 'POLE TYPE', // FIXED: Space instead of underscore
        options: ['Concrete 7m', 'Concrete 8m', 'GI', 'Spun', 'Wood']
      },
      {
        projectId: project.id,
        layerId: 'SLT_Poles',
        fieldName: 'POLE MAKE',
        options: ['LTL', 'St. Anthony', 'Other']
      },
      {
        projectId: project.id,
        layerId: 'SLT_Poles',
        fieldName: 'Exist_New',
        options: ['Existing', 'New']
      },
      {
        projectId: project.id,
        layerId: 'SLT_Poles',
        fieldName: 'CONDITION',
        options: ['Good', 'Damaged', 'Leaning', 'Needs Replacement']
      },
      // SLT_FDT Dropdowns
      {
        projectId: project.id,
        layerId: 'SLT_FDT',
        fieldName: 'CAPACITY',
        options: ['12 Core', '24 Core', '48 Core', '96 Core']
      },
      // SLT_FDP Dropdowns
      {
        projectId: project.id,
        layerId: 'SLT_FDP',
        fieldName: 'TYPE',
        options: ['Indoor', 'Outdoor', 'Wall Mount', 'Pole Mount']
      },
      {
        projectId: project.id,
        layerId: 'SLT_FDP',
        fieldName: 'SPLITTER TYPE',
        options: ['1:2', '1:4', '1:8', '1:16']
      },
      {
        projectId: project.id,
        layerId: 'SLT_FDP',
        fieldName: 'Exst_New',
        options: ['Existing', 'New']
      }
    ]
  });
  console.log(`✅ Added QFieldFieldConfig dropdown options for QField form.`);

  const syncService = new QFieldCloudSyncService();

  console.log('\nStep 1: Creating project in QFieldCloud...');
  const qfieldProject = await syncService.createQFieldProject(project.id, 'QGIS Project Template/QGIS.qgz');
  console.log('✅ QFieldCloud Project Created successfully!');
  console.log('QFieldCloud Project Details:', qfieldProject);

  // Save mapping in database
  await prisma.project.update({
    where: { id: project.id },
    data: {
      gisMapping: {
        qfieldProjectId: qfieldProject.id,
        created_at: new Date().toISOString()
      } as any
    }
  });
  console.log('✅ Updated GIS mapping in SLTSERP database.');

  console.log('\nStep 2: Pushing Survey Layers to QFieldCloud...');
  await syncService.pushSurveyLayers(qfieldProject.id);
  console.log('✅ Survey layers successfully pushed to QFieldCloud project!');

  console.log('\nStep 3: Triggering packaging job...');
  const token = await authenticate();
  const triggerRes = await fetch(`${baseUrl}/api/v1/jobs/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project_id: qfieldProject.id,
      type: 'package',
    }),
  });

  if (!triggerRes.ok) {
    throw new Error(`Failed to trigger package job: ${triggerRes.status} - ${await triggerRes.text()}`);
  }

  const job = await triggerRes.json();
  console.log(`Job created successfully. ID: ${job.id}, Status: ${job.status}`);

  console.log('\nMonitoring packaging job status...');
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const statusRes = await fetch(`${baseUrl}/api/v1/jobs/${job.id}/`, {
      headers: { 'Authorization': `Token ${token}` },
    });
    if (!statusRes.ok) {
      console.error(`Failed to get job status: ${statusRes.status}`);
      continue;
    }
    const currentJob = await statusRes.json();
    console.log(`[${new Date().toLocaleTimeString()}] Status: ${currentJob.status}`);
    if (currentJob.status === 'finished') {
      console.log('✅ Packaging job completed successfully!');
      return;
    } else if (currentJob.status === 'failed') {
      console.error('❌ Packaging job failed!');
      console.error('Feedback:', JSON.stringify(currentJob.feedback, null, 2));
      return;
    }
  }
  console.log('Monitoring timed out.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
