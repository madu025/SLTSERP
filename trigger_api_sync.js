async function triggerSync() {
    const url = 'http://localhost:3000/api/cron/sync-all';
    console.log(`Triggering sync via: ${url}`);
    try {
        const resp = await fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + (process.env.CRON_SECRET || 'your_secret_here')
            }
        });
        const data = await resp.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error triggering sync:', e.message);
        console.log('Suggestion: Make sure the Next.js app is running on http://localhost:3000');
    }
}
triggerSync();
