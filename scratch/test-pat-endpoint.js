async function main() {
    const views = ['OPMC_REJECTED', 'REJECTED'];

    for (const view of views) {
        const url = `http://localhost:3000/api/service-orders/pat?page=1&limit=20&status=${view}`;
        console.log(`Fetching from PAT API: ${url}...`);
        try {
            const res = await fetch(url);
            console.log(` > Status: ${res.status}`);
            const data = await res.json();
            console.log(` > Total orders found: ${data.total}`);
            if (data.orders && data.orders.length > 0) {
                console.log(`   Sample order:`, data.orders[0]);
            }
        } catch (e) {
            console.error(`Fetching failed for ${view}:`, e);
        }
    }
}

main().catch(console.error);
