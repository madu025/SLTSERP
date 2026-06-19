import { QFieldCloudSyncService } from '../src/services/qfieldcloud-sync.service';

async function testConnection() {
  console.log('Testing connection to QFieldCloud service...');
  console.log(`QFieldCloud API URL: ${process.env.NEXT_PUBLIC_QFIELD_API_URL || 'http://localhost:8100'}`);
  console.log(`Admin User: ${process.env.QFIELD_ADMIN_USER || 'admin'}`);

  const service = new QFieldCloudSyncService();
  try {
    // Authenticate is private, let's cast to any to call it for testing
    const token = await (service as any).authenticate();
    console.log('✅ Connection Successful!');
    console.log(`Token: ${token.substring(0, 10)}...`);
  } catch (error: any) {
    console.error('❌ Connection Failed!');
    console.error(error.message || error);
  }
}

testConnection();
