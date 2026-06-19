import fs from 'fs';
import path from 'path';
import { QFieldCloudSyncService } from '../src/services/qfieldcloud-sync.service';

async function testUpload() {
  const qfieldProjectId = '1735a7c0-5a73-483b-8082-3400c3377b66';
  const filePath = path.resolve('QGIS Project Template/QGIS.qgz');

  console.log(`Uploading file ${filePath} to project ${qfieldProjectId} via /api/v1/files/${qfieldProjectId}/QGIS.qgz/...`);

  const service = new QFieldCloudSyncService();
  try {
    const token = await (service as any).authenticate();

    // Read file as buffer
    const fileBuffer = fs.readFileSync(filePath);
    const fileBlob = new Blob([fileBuffer], { type: 'application/octet-stream' });

    const formData = new FormData();
    formData.append('file', fileBlob, 'QGIS.qgz');

    const res = await fetch(`http://localhost:8011/api/v1/files/${qfieldProjectId}/QGIS.qgz/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
      },
      body: formData,
    });

    console.log('Response Status:', res.status);
    const text = await res.text();
    console.log('Response Body:', text.substring(0, 500));
  } catch (error: any) {
    console.error('❌ Upload failed:', error.message || error);
  }
}

testUpload();
