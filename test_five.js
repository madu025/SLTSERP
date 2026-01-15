async function testFive() {
    const rtoms = ['HK', 'CB', 'KT', 'NG', 'GL'];
    for (const rtom of rtoms) {
        const url = `https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&z=SLTS_${rtom}`;
        console.log(`Testing ${rtom}: ${url}`);
        try {
            const resp = await fetch(url);
            const text = await resp.text();
            console.log(`Status: ${resp.status}, Length: ${text.length}`);
            if (text.length > 50) console.log('Data found!');
        } catch (e) { }
    }
}
testFive();
