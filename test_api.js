async function testApi() {
    const urls = [
        { name: 'HO Approved (Global - Trial 1)', url: 'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&con=SLTS' },
        { name: 'HO Approved (Global - Trial 2)', url: 'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&y=&con=SLTS' },
    ];

    for (const item of urls) {
        console.log(`\nTesting ${item.name}...`);
        try {
            const response = await fetch(item.url);
            console.log(`Status: ${response.status}`);
            if (response.ok) {
                const data = await response.json();
                console.log(`Success! Records: ${data.data?.length || 0}`);
            }
        } catch (error) {
            console.error(`Error: ${error.message}`);
        }
    }
}
testApi();
