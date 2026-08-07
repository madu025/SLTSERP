const http = require('http');

const SODS = [
    { id: "019fdbd5-8802-ee1c-d314-7b9f9c7cc64d", soNum: "KDL202608070014315" },
    { id: "019fdbd5-8802-a2dd-5a1d-ac211e82fccf", soNum: "KDL202608070014975" },
    { id: "019fc81c-4365-b237-4f8c-6adb37bac269", soNum: "HC202607310098642" },
    { id: "019fd633-7f3f-e626-b185-060b2906e204", soNum: "KDL202608050070907" },
    { id: "019fd6e6-1520-0efb-ad5e-a2adee0cd60e", soNum: "KDL202608060085990" },
    { id: "019fd685-ef10-5276-1712-69711ff837ed", soNum: "HC202608060086476" },
    { id: "019fdbd5-8802-0a52-683f-040e6e7a5472", soNum: "KDL202608070014181" },
    { id: "019fdbd5-8802-520a-e4a5-5fd06e6c60a3", soNum: "KDL202608070013899" },
    { id: "019fc81c-4361-1a09-e165-45865876483e", soNum: "KDL202503010049975" },
    { id: "019fcb33-5ec8-c24e-68a2-61d5823cc888", soNum: "KX202608040055106" },
];

const DROP_WIRE_ID = "06772345-abc3-4401-af5e-5a35b9622bce";
const JOINT_CLOSURE_ID = "019fdd4f-7d1b-3277-9739-bc03c264feb6";
const USER_ID = "019fc748-10f8-4ac1-d0ea-ee19aa129cd0";
const CONTRACTOR_ID = "019fdcd7-4325-aa27-9bc3-429ec6d32929";

function loginAndGetToken() {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ username: 'qa_contractor', password: 'Test@123' });
        const req = http.request({
            hostname: 'localhost', port: 3000,
            path: '/api/contractor-portal/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                const json = JSON.parse(data);
                if (json.token) resolve(json.token);
                else reject(new Error('No token: ' + JSON.stringify(json)));
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function completeSod(token, sod, index) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            id: sod.id,
            sltsStatus: 'COMPLETED',
            completedDate: new Date().toISOString(),
            dropWireDistance: 50,
            materialUsage: [
                { itemId: DROP_WIRE_ID, quantity: '0.05', usageType: 'USED' },
                { itemId: JOINT_CLOSURE_ID, quantity: '2', usageType: 'USED' }
            ]
        });

        const req = http.request({
            hostname: 'localhost', port: 3000,
            path: '/api/contractor-portal/sods',
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'Authorization': `Bearer ${token}`,
                'x-user-id': USER_ID,
                'x-user-role': 'CONTRACTOR_SUPERVISOR',
                'x-contractor-id': CONTRACTOR_ID,
            }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ index, soNum: sod.soNum, status: res.statusCode, result: json });
                } catch (e) {
                    resolve({ index, soNum: sod.soNum, status: res.statusCode, result: data });
                }
            });
        });
        req.on('error', e => resolve({ index, soNum: sod.soNum, status: 0, error: e.message }));
        req.write(payload);
        req.end();
    });
}

async function main() {
    console.log('Logging in...');
    const token = await loginAndGetToken();
    console.log('Token obtained.\n');

    let passed = 0, failed = 0;

    // Complete SODs sequentially to avoid race conditions
    for (let i = 0; i < SODS.length; i++) {
        const sod = SODS[i];
        console.log(`[${i + 1}/10] Completing ${sod.soNum}...`);
        const result = await completeSod(token, sod, i);

        if (result.status === 200) {
            const status = result.result?.data?.sltsStatus || result.result?.sltsStatus || 'OK';
            console.log(`  PASSED (HTTP ${result.status}, status: ${status})`);
            passed++;
        } else {
            console.log(`  FAILED (HTTP ${result.status})`);
            console.log(`  Response: ${JSON.stringify(result.result || result.error).substring(0, 300)}`);
            failed++;
        }
    }

    console.log(`\n--- RESULTS ---`);
    console.log(`Passed: ${passed}/10`);
    console.log(`Failed: ${failed}/10`);
}

main().catch(e => { console.error(e); process.exit(1); });
