async function testToday() {
    const today = new Date().toISOString().split('T')[0];
    const url = `https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&y=${today}&con=SLTS`;
    console.log(`Testing: ${url}`);
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await resp.text();
    console.log(`Status: ${resp.status}, Length: ${text.length}`);
    if (text.length > 50) console.log('Snippet:', text.substring(0, 200));
}
testToday();
