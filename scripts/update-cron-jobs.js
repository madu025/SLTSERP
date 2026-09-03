/* Update cron-job.org schedules */
const API_KEY = '7NSj1jDnC546l3n0GNaNrFZ3cvId1fWD4eVAaHmgGfM=';
const BASE_URL = 'https://api.cron-job.org';

const NEW_SCHEDULE = '*/15 5-23 * * *'; // 5AM to midnight (19 hours)

async function listJobs() {
    const res = await fetch(`${BASE_URL}/jobs`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    const data = await res.json();
    console.log('Raw API response:', JSON.stringify(data, null, 2));
    return data.jobs || [];
}

async function updateJob(jobId, updates) {
    const res = await fetch(`${BASE_URL}/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ job: updates })
    });
    const text = await res.text();
    if (!text) return { jobId }; // 204 No Content = success
    try { return JSON.parse(text); } catch { return { jobId }; }
}

async function createJob(jobData) {
    const res = await fetch(`${BASE_URL}/jobs`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ job: jobData })
    });
    const text = await res.text();
    console.log(`  Create response status: ${res.status}, body: ${text.substring(0, 200)}`);
    if (!text) return {};
    try { return JSON.parse(text); } catch { return {}; }
}

async function main() {
    console.log('=== Listing current jobs ===\n');
    const jobs = await listJobs();
    
    for (const job of jobs) {
        console.log(`Job ID: ${job.jobId}`);
        console.log(`  Title: ${job.title}`);
        console.log(`  URL: ${job.url}`);
        console.log(`  Schedule: hours=${JSON.stringify(job.schedule?.hours)}, minutes=${JSON.stringify(job.schedule?.minutes)}`);
        console.log(`  Enabled: ${job.enabled}`);
        console.log('');
    }

    console.log('\n=== Updating schedules to 5AM-Midnight ===\n');
    
    // 5AM to 11PM (hours 5-23), every 15 minutes
    const newSchedule = {
        timezone: 'Asia/Colombo',
        hours: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
        minutes: [0, 15, 30, 45],
        mdays: [-1],
        months: [-1],
        wdays: [-1]
    };
    
    // Only update the 4 active sync jobs (Master + 3 Batches)
    const syncJobs = jobs.filter(j => 
        j.title.includes('Master Sync') || 
        j.title.includes('SOD Sync Batch')
    );
    
    console.log(`Found ${syncJobs.length} sync jobs to update.\n`);
    
    for (const job of syncJobs) {
        console.log(`Updating ${job.title} (ID: ${job.jobId})...`);
        const result = await updateJob(job.jobId, {
            schedule: newSchedule
        });
        console.log(`  Result: ${result.jobId ? 'OK' : 'FAILED'}`);
    }

    console.log('\n=== Creating new Completed SOD Sync job ===\n');
    
    const newJob = await createJob({
        title: 'SLTSERP - Completed SOD Sync (Every 30 Mins, 5AM-Midnight)',
        url: 'https://sltserp.vercel.app/api/cron/sync-completed?secret=cd63fa6924b48cb930713ba7d5fd153f53794c0fe9c485f9731f4807308f3ef6',
        schedule: {
            timezone: 'Asia/Colombo',
            hours: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
            minutes: [0, 30],
            mdays: [-1],
            months: [-1],
            wdays: [-1]
        },
        enabled: true,
        requestMethod: 0, // GET
        requestTimeout: 300,
        saveResponses: true
    });
    
    console.log(`New job created: ${newJob.id || 'FAILED'}`);
    console.log(`Title: SLTSERP - Completed SOD Sync`);
    console.log(`Schedule: */30 5-23 * * * (5AM-Midnight, every 30 mins)`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
