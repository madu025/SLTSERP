import { PrismaClient } from '@prisma/client';
import { QFieldCloudSyncService } from '../src/services/qfieldcloud-sync.service';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching or creating a test project in SLTSERP database...');
  console.log('Creating a temporary test project...');
  const project = await prisma.project.create({
    data: {
      projectCode: 'TEST-' + Math.floor(Math.random() * 10000),
      name: 'QField Testing Project',
      description: 'Temporary project for testing QFieldCloud sync integrations',
      type: 'OSP',
      status: 'PLANNING',
      budget: 50000,
      location: 'Colombo',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`Created test project ID: ${project.id} [${project.projectCode}]`);

  const syncService = new QFieldCloudSyncService();

  console.log('\nStep 1: Creating project in QFieldCloud...');
  try {
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

  } catch (error: any) {
    console.error('❌ Sync flow execution failed:', error.message || error);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
