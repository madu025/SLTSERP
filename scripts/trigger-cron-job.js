const https = require('https');
const API_KEY = '7NSj1jDnC546l3n0GNaNrFZ3cvId1fWD4eVAaHmgGfM=';

const jobId = 8223068; // Master Sync

// Trigger job manually
const req = https.request({
    hostname: 'api.cron-job.org',
    path: `/jobs/${jobId}/trigger`,
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'application/json'
    }
}, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        console.log('Trigger Response:', d);
    });
});
req.on('error', e => console.error(e));
req.end();
