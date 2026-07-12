import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const baseUrl = process.env.NEXT_PUBLIC_QFIELD_API_URL || 'http://localhost:8011';

async function authenticate(): Promise<string> {
  const username = process.env.QFIELD_ADMIN_USER || 'admin';
  const password = process.env.QFIELD_ADMIN_PASS || 'admin123';

  console.log(`Authenticating with QFieldCloud as ${username}...`);
  const res = await fetch(`${baseUrl}/api/v1/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(`Authentication failed: ${res.status} - ${await res.text()}`);
  }

  const data: any = await res.json();
  return data.token || data.access_token;
}

async function main() {
  // Find project with gisMapping
  const project = await prisma.project.findFirst({
    where: {
      NOT: {
        gisMapping: {}
      }
    },
    orderBy: {
      startDate: 'desc'
    }
  });

  if (!project) {
    console.error('No project mapped to QFieldCloud found in database.');
    return;
  }

  const mapping = project.gisMapping as any;
  const qfieldProjectId = mapping.qfieldProjectId;

  if (!qfieldProjectId) {
    console.error(`Project ${project.projectCode} has gisMapping but no qfieldProjectId.`);
    return;
  }

  console.log(`Found mapped project: ${project.projectCode} (${project.name})`);
  console.log(`QFieldCloud Project ID: ${qfieldProjectId}`);

  const token = await authenticate();

  console.log(`\nTriggering package job...`);
  const triggerRes = await fetch(`${baseUrl}/api/v1/jobs/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project_id: qfieldProjectId,
      type: 'package',
    }),
  });

  if (!triggerRes.ok) {
    console.error(`Failed to trigger package job: ${triggerRes.status} - ${await triggerRes.text()}`);
    return;
  }

  const job = await triggerRes.json();
  console.log(`Job created successfully. ID: ${job.id}, Status: ${job.status}`);

  console.log('\nMonitoring packaging job status (timeout 60 seconds)...');
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
