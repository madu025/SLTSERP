async function testYear() {
    const urls = [
        'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&y=2026&con=SLTS',
        'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&y=2025-12&con=SLTS'
    ];
    for (const url of urls) {
        console.log(`\nTesting: ${url}`);
        try {
            const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
            const text = await resp.text();
            console.log(`Status: ${resp.status}, Length: ${text.length}`);
            if (resp.ok && text.length > 50) {
                const data = JSON.parse(text);
                console.log(`Count: ${data.data?.length}`);
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}
testYear();
