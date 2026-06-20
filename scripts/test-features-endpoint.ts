import { QFieldCloudSyncService } from '../src/services/qfieldcloud-sync.service';

async function main() {
  const syncService = new QFieldCloudSyncService();
  const token = await (syncService as any).authenticate();
  const baseUrl = (syncService as any).baseUrl;
  const projectId = '3f6ae1f6-813e-49e4-8c2a-e6787351091c'; // TEST-7531 Project ID
  
  console.log(`Fetching features from ${baseUrl}/api/v1/projects/${projectId}/features/ ...`);
  const res = await fetch(`${baseUrl}/api/v1/projects/${projectId}/features/`, {
    headers: { Authorization: `Token ${token}` },
  });
  
  if (!res.ok) {
    console.error(`Failed to fetch features: ${res.status} - ${await res.text()}`);
    return;
  }
  
  const data = await res.json();
  console.log('Features endpoint response type:', typeof data, Array.isArray(data) ? 'Array' : 'Object');
  console.log('Response content summary (first 1000 chars):');
  console.log(JSON.stringify(data, null, 2).slice(0, 1000));
}

main().catch(console.error);
