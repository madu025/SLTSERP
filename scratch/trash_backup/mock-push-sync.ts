import { PrismaClient } from '@prisma/client';
import { QFieldCloudSyncService } from '../src/services/qfieldcloud-sync.service';

const prisma = new PrismaClient();

async function main() {
  const projectId = 'cmqke3ejx0001siskrlijnbvg'; // The E2E-TEST project ID from database
  const qfieldProjectId = '1735a7c0-5a73-483b-8082-3400c3377b66'; // The QFieldCloud project ID

  console.log('Testing push/pull sync flow using mock QField survey point...');

  const service = new QFieldCloudSyncService();
  try {
    // 1. Authenticate to get token
    const token = await (service as any).authenticate();
    console.log('🔑 Authenticated with QFieldCloud.');

    // 2. Create a mock feature payload
    const mockFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [79.8612, 6.9271], // Colombo coordinates
      },
      properties: {
        uuid: 'mock-uuid-' + Math.floor(Math.random() * 1000000),
        layerId: 'ROUTE_SURVEY', // Matches one of the defined layers
        notes: 'Mock test point added via automated script',
        surveyor: 'Auto Tester',
        status: 'PENDING',
      },
    };

    console.log('\nStep 1: Uploading mock survey point to QFieldCloud...');
    const uploadRes = await fetch(`http://localhost:8011/api/v1/projects/${qfieldProjectId}/features/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        features: [mockFeature]
      }),
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Failed to upload feature: ${uploadRes.status} - ${errText}`);
    }

    console.log('✅ Mock point uploaded to QFieldCloud successfully!');

    // 3. Create active survey session in SLTSERP if none exists
    let activeSession = await prisma.mobileSurveySession.findFirst({
      where: { projectId: projectId, status: 'IN_PROGRESS' }
    });

    if (!activeSession) {
      activeSession = await prisma.mobileSurveySession.create({
        data: {
          projectId: projectId,
          status: 'IN_PROGRESS',
          supervisorId: 'system',
          pointsCount: 0,
          startedAt: new Date()
        }
      });
      console.log(`✅ Created mock survey session: ${activeSession.id}`);
    }

    // 4. Trigger Sync (Pull points from QFieldCloud to Supabase DB)
    console.log('\nStep 2: Triggering QFieldCloud Sync in SLTSERP (Pulling to Supabase)...');
    const syncResult = await service.pullSurveyPoints(projectId, qfieldProjectId);
    console.log('✅ Sync Completed!');
    console.log('Sync Results:', syncResult);

  } catch (error: any) {
    console.error('❌ Error during mock sync:', error.message || error);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
