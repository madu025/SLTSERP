const https = require('https');
const API_KEY = '7NSj1jDnC546l3n0GNaNrFZ3cvId1fWD4eVAaHmgGfM=';

const jobId = 8223068; // Master Sync

// Get job details
const req = https.request({
    hostname: 'api.cron-job.org',
    path: `/jobs/${jobId}`,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + API_KEY }
}, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        try {
            const job = JSON.parse(d);
            console.log('=== Job Details ===');
            console.log(JSON.stringify(job, null, 2));
        } catch (e) {
            console.log('Error parsing:', d);
        }
    });
});
req.on('error', e => console.error(e));
req.end();
