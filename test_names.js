async function testNames() {
    const keys = ['patsuccess', 'patpassed', 'patapproved', 'hoapproved', 'hosuccess'];
    for (const key of keys) {
        const url = `https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=${key}&y=&con=SLTS`;
        console.log(`\nTesting ${key}: ${url}`);
        try {
            const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
            const text = await resp.text();
            console.log(`Status: ${resp.status}, Length: ${text.length}`);
            console.log(`Preview: ${text.substring(0, 100)}`);
            if (text.trim().startsWith('{')) {
                const data = JSON.parse(text);
                console.log(`JSON Data count: ${data.data?.length}`);
            }
        } catch (e) { console.log(`Error: ${e.message}`); }
    }
}
testNames();
