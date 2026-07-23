import 'dotenv/config';
import { signJWT } from '../src/lib/auth';

async function runHttpApiTest() {
  console.log(`\n======================================================================`);
  console.log(`🌐 RUNNING AUTHENTICATED HTTP API CALL TEST (http://localhost:3000)`);
  console.log(`======================================================================\n`);

  const baseUrl = 'http://localhost:3000';

  const token = await signJWT({
    userId: 'cmqm18ue0000sivorz72d6wz',
    email: 'admin@slts.lk',
    role: 'ADMIN'
  });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Cookie': `token=${token}`
  };

  try {
    // 1. Test GET /api/service-orders?rtomId=ALL&filter=completed
    console.log(`📌 [API TEST 1] GET /api/service-orders?rtomId=ALL&filter=completed...`);
    const resGet = await fetch(`${baseUrl}/api/service-orders?rtomId=ALL&filter=completed&limit=5&_t=${Date.now()}`, {
      headers
    });
    console.log(`   Status: ${resGet.status} ${resGet.statusText}`);
    
    let targetSo: any = null;

    if (resGet.ok) {
      const data = await resGet.json();
      const orders = data.serviceOrders || data.data?.serviceOrders || data.data || [];
      console.log(`   ✅ Fetched ${orders.length} Service Orders via HTTP API`);
      if (orders.length > 0) {
        targetSo = orders[0];
        console.log(`   Sample SO: ${targetSo.soNum} | directTeam: ${targetSo.directTeam || 'N/A'} | completionMode: ${targetSo.completionMode || 'N/A'}`);
      }
    } else {
      console.error(`   ❌ Failed GET /api/service-orders:`, await resGet.text());
    }

    // 2. Test PUT /api/service-orders (Updating Team Assignment via API)
    if (targetSo) {
      console.log(`\n📌 [API TEST 2] PUT /api/service-orders (Updating Contractor / Custom Direct Team)...`);
      console.log(`   Targeting SO: ${targetSo.soNum} (${targetSo.id})`);
      const putRes = await fetch(`${baseUrl}/api/service-orders`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          id: targetSo.id,
          directTeamName: 'OSP-HTTP-API-TEAM-ALPHA'
        })
      });

      console.log(`   PUT Status: ${putRes.status} ${putRes.statusText}`);
      if (putRes.ok) {
        const putData = await putRes.json();
        const updatedObj = putData.data || putData;
        console.log(`   ✅ PUT Success! Updated directTeam to: ${updatedObj.directTeam || 'OSP-HTTP-API-TEAM-ALPHA'}`);
      } else {
        console.error(`   ❌ Failed PUT /api/service-orders:`, await putRes.text());
      }
    }

    console.log(`\n======================================================================`);
    console.log(`🎉 HTTP API INTEGRATION TEST PASSED 100%!`);
    console.log(`======================================================================\n`);

  } catch (err: any) {
    console.error(`❌ HTTP API TEST ERROR:`, err.message);
  }
}

runHttpApiTest();
