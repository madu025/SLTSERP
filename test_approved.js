async function testApproved() {
    const variations = [
        'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&y=&con=SLTS',
        'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&con=SLTS',
        'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&y=SLTS',
        'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&z=SLTS',
        'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&z=SLTS_AD' // Try one regional success again
    ];

    for (const url of variations) {
        console.log(`\nTesting: ${url}`);
        try {
            const start = Date.now();
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(30000)
            });
            const duration = Date.now() - start;
            console.log(`Status: ${response.status} (${duration}ms)`);
            if (response.ok) {
                const text = await response.text();
                // try to see if it's long
                console.log(`Length: ${text.length}`);
                if (text.length > 100) {
                    const data = JSON.parse(text);
                    console.log(`Count: ${data.data?.length}`);
                    break;
                }
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}
testApproved();
