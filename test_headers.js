async function testHeaders() {
    const url = 'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&y=2024-06-05&con=SLTS';
    console.log(`Testing: ${url}`);
    const resp = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const text = await resp.text();
    console.log(`Status: ${resp.status}, Length: ${text.length}`);
    if (text.length > 50) console.log('Snippet:', text.substring(0, 200));
}
testHeaders();
