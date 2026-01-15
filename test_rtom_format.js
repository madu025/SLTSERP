async function testR() {
    const urls = [
        'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&z=SLTS_AD',
        'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&z=SLTS_R-AD'
    ];
    for (const url of urls) {
        console.log(`\nTesting: ${url}`);
        const resp = await fetch(url);
        const text = await resp.text();
        console.log(`Status: ${resp.status}, Length: ${text.length}`);
        if (text.length > 50) console.log('Contains data!');
    }
}
testR();
