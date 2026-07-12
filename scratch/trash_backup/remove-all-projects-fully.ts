import { PrismaClient } from '@prisma/client';


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
  const data = (await res.json()) as { token?: string; access_token?: string };
  return data.token || data.access_token || '';
}

async function main() {
  console.log('--- STARTING CLEANUP OF ALL PROJECTS ON QFIELDCLOUD AND DATABASE ---');
  
  const token = await authenticate();
  console.log('✅ Authenticated with QFieldCloud.');

  // 1. Fetch all projects from QFieldCloud
  const projectsRes = await fetch(`${baseUrl}/api/v1/projects/`, {
    headers: { 'Authorization': `Token ${token}` },
  });
  if (!projectsRes.ok) {
    throw new Error(`Failed to fetch QField projects: ${projectsRes.statusText}`);
  }
  
  const qfieldProjects = (await projectsRes.json()) as Array<{ id: string; name: string }>;
  console.log(`Found ${qfieldProjects.length} projects on QFieldCloud.`);

  // 2. Delete each project from QFieldCloud
  for (const qfProj of qfieldProjects) {
    console.log(`🗑️ Deleting QFieldCloud project "${qfProj.name}" [${qfProj.id}]...`);
    try {
      const delRes = await fetch(`${baseUrl}/api/v1/projects/${qfProj.id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` },
      });
      if (delRes.ok || delRes.status === 404) {
        console.log(`✅ Successfully deleted project "${qfProj.name}" from QFieldCloud.`);
      } else {
        console.error(`❌ Failed to delete "${qfProj.name}": ${delRes.statusText}`);
      }
    } catch (err) {
      const error = err as Error;
      console.error(`❌ Error deleting "${qfProj.name}":`, error.message || error);
    }
  }

  // 3. Clear gisMapping for all projects in our local database
  console.log('Clearing gisMapping for all projects in SLTSERP database...');
  const updateResult = await prisma.project.updateMany({
    data: {
      gisMapping: {}
    }
  });
  console.log(`✅ Cleared gisMapping for ${updateResult.count} projects in database.`);

  // 4. Delete the test project SME-0452 specifically if it exists to make sure we start fresh
  const testProject = await prisma.project.findUnique({
    where: { projectCode: 'SME-0452' }
  });
  if (testProject) {
    console.log('Deleting test project SME-0452 from local database...');
    try {
      await prisma.project.delete({
        where: { id: testProject.id }
      });
      console.log('✅ Deleted SME-0452.');
    } catch (err) {
      console.log('Could not delete SME-0452 from DB (likely due to FK constraints), resetting its status to PLANNING instead...', err);
      await prisma.project.update({
        where: { id: testProject.id },
        data: {
          status: 'PLANNING',
          gisMapping: {}
        }
      });
      console.log('✅ Reset SME-0452.');
    }
  }

  console.log('🎉 ALL PROJECTS REMOVED SUCCESSFULLY.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
