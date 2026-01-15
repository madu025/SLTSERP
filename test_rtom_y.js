async function testRtomInY() {
    const rtoms = ['HK', 'CB', 'KT', 'AD'];
    for (const rtom of rtoms) {
        const url = `https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&y=${rtom}&con=SLTS`;
        console.log(`\nTesting ${rtom}: ${url}`);
        try {
            const resp = await fetch(url);
            const text = await resp.text();
            console.log(`Status: ${resp.status}, Length: ${text.length}`);
            if (text.length > 50) {
                const data = JSON.parse(text);
                console.log(`Count: ${data.data?.length}`);
                console.log('Sample:', JSON.stringify(data.data[0], null, 2));
            }
        } catch (e) { }
    }
}
testRtomInY();
