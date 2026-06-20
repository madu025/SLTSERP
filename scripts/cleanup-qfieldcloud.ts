import { PrismaClient } from '@prisma/client';
import { QFieldCloudSyncService } from '../src/services/qfieldcloud-sync.service';

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING QFIELDCLOUD ORPHANED PROJECTS CLEANUP ---');

  const syncService = new QFieldCloudSyncService();
  const baseUrl = process.env.NEXT_PUBLIC_QFIELD_API_URL || 'http://localhost:8100';

  // 1. Authenticate with QFieldCloud
  let token: string;
  try {
    // Access token via private auth
    const res = await fetch(`${baseUrl}/api/v1/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.QFIELD_ADMIN_USER || 'admin',
        password: process.env.QFIELD_ADMIN_PASS || 'admin',
      }),
    });

    if (!res.ok) throw new Error('QFieldCloud authentication failed');
    const data = await res.json();
    token = data.token || data.access_token;
    console.log('✅ Successfully authenticated with QFieldCloud.');
  } catch (err: any) {
    console.error('❌ Failed to authenticate:', err.message || err);
    return;
  }

  // 2. Fetch all projects from QFieldCloud
  let qfieldProjects: any[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/v1/projects/`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
    qfieldProjects = await res.json();
    console.log(`ℹ️ Found ${qfieldProjects.length} total projects on QFieldCloud.`);
  } catch (err: any) {
    console.error('❌ Failed to fetch projects from QFieldCloud:', err.message || err);
    return;
  }

  // 3. Fetch all active projects in SLTSERP database
  const activeProjects = await prisma.project.findMany({
    select: { id: true, gisMapping: true }
  });

  const activeQFieldIds = new Set<string>();
  for (const p of activeProjects) {
    const gisMapping = p.gisMapping as any;
    if (gisMapping && gisMapping.qfieldProjectId) {
      activeQFieldIds.add(gisMapping.qfieldProjectId);
    }
  }
  console.log(`ℹ️ Found ${activeProjects.length} active projects in SLTSERP DB (${activeQFieldIds.size} mapped to QField).`);

  // 4. Find and delete orphans
  let deletedCount = 0;
  for (const qfProj of qfieldProjects) {
    const qfId = qfProj.id;
    const qfName = qfProj.name;

    if (!activeQFieldIds.has(qfId)) {
      console.log(`🗑️ Mismatch found: QFieldCloud project "${qfName}" [${qfId}] does not exist in SLTSERP. Deleting...`);
      try {
        const delRes = await fetch(`${baseUrl}/api/v1/projects/${qfId}/`, {
          method: 'DELETE',
          headers: { Authorization: `Token ${token}` },
        });

        if (delRes.ok || delRes.status === 404) {
          console.log(`✅ Successfully deleted project "${qfName}" from QFieldCloud.`);
          deletedCount++;
        } else {
          console.error(`❌ Failed to delete project "${qfName}": ${delRes.statusText}`);
        }
      } catch (delErr: any) {
        console.error(`❌ Error deleting project "${qfName}":`, delErr.message || delErr);
      }
    } else {
      console.log(`👉 Project "${qfName}" [${qfId}] is active in SLTSERP. Keeping.`);
    }
  }

  console.log(`\n🎉 CLEANUP COMPLETE! Deleted ${deletedCount} orphaned projects from QFieldCloud.`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
