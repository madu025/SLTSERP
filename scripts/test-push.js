
async function testPush() {
    const data = {
        soNum: "TEST_SO_" + Date.now(),
        currentUser: "DEBUG_AGENT",
        activeTab: "SERVICE ORDER",
        url: "https://sltportal.slt.lk/view",
        details: { "SERVICE ORDER DETAILS": "RTOM R-KOT SERVICE ORDER TEST_SO_123 ..." }
    };

    try {
        const resp = await fetch('http://localhost:3000/api/test/extension-push', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await resp.json();
        console.log('Result:', result);
    } catch (e) {
        console.error('Fetch failed:', e.message);
    }
}

testPush();
