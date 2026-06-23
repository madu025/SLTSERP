import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const baseUrl = process.env.NEXT_PUBLIC_QFIELD_API_URL || 'http://localhost:8011';
const projectId = 'cmqpa22sz0000sik8eos6y9o0'; // Database project ID
const qfieldProjectId = '7a55babe-8909-4554-8dd7-9bc03f7a1b9b'; // QField project ID

async function main() {
  console.log("=== Inspecting Local Database ===");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, projectCode: true, gisMapping: true }
  });
  console.log("Project info:", project);

  const points = await prisma.surveyPoint.findMany({
    where: { projectId: projectId }
  });
  console.log(`Found ${points.length} survey points in local database.`);
  for (const p of points) {
    console.log(`  - Point ID: ${p.id} | Layer: ${p.layerName} | Status: ${p.verificationStatus}`);
    console.log(`    Attributes:`, JSON.stringify(p.attributes));
  }

  console.log("\n=== Querying QFieldCloud API ===");
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.QFIELD_ADMIN_USER || 'admin',
      password: process.env.QFIELD_ADMIN_PASS || 'admin123'
    })
  });

  if (!loginRes.ok) {
    console.error(`Auth failed: ${loginRes.status} - ${await loginRes.text()}`);
    return;
  }

  const { token } = await loginRes.json();
  const headers = { 'Authorization': `Token ${token}` };

  console.log(`Fetching deltas for QField project ${qfieldProjectId}...`);
  const deltasRes = await fetch(`${baseUrl}/api/v1/deltas/${qfieldProjectId}/`, { headers });
  if (!deltasRes.ok) {
    console.error(`Failed to fetch deltas: ${deltasRes.status} - ${await deltasRes.text()}`);
    return;
  }

  const deltasData = await deltasRes.json();
  const deltas = Array.isArray(deltasData) ? deltasData : (deltasData.results || []);
  console.log(`Total QFieldCloud deltas: ${deltas.length}`);

  for (let idx = 0; idx < deltas.length; idx++) {
    const d = deltas[idx];
    console.log(`\nDelta ${idx + 1}:`);
    console.log(`  ID: ${d.id}`);
    console.log(`  Status: ${d.status}`);
    console.log(`  Last Status: ${d.last_status}`);
    console.log(`  Created At: ${d.created_at}`);
    console.log(`  Content:`, JSON.stringify(d.content));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
