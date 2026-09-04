/* eslint-disable @typescript-eslint/no-var-requires */
const https = require('https');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config();

const API_KEY = process.env.CRONJOB_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const DOMAIN = process.argv[2];

if (!DOMAIN) {
    console.error("❌ Please provide the app's public base URL as an argument.");
    console.error("👉 Example: node scripts/setup-cron.js https://sltserp.example.com");
    process.exit(1);
}

// No defaults on purpose: both values were hardcoded here once and are therefore in git history.
// Rotate them (cron-job.org console + CRON_SECRET) and keep this file secret-free.
if (!API_KEY || !CRON_SECRET) {
    console.error("❌ Missing credentials. Set CRONJOB_API_KEY and CRON_SECRET in .env before running this script.");
    process.exit(1);
}

// Remove trailing slash if exists
const baseUrl = DOMAIN.replace(/\/$/, '');

// ONE job, ONE clock. This endpoint enqueues a single scheduler tick; the worker seeds everything
// else from it (per-RTOM sweep every 10 min, 20/30-minute syncs, wall-clock dailies, self-heal)
// using deterministic job ids. Registering per-work-item endpoints here would duplicate the portal
// calls the tick already covers.
//
// cron-job.org is used instead of GitHub Actions because GitHub's scheduled workflows are delayed
// 30-60+ mins under peak load; cron-job.org fires within seconds of the scheduled minute.
const jobs = [
    {
        title: "SLTSERP - Master Tick (Every 10 Mins, 24h)",
        url: `${baseUrl}/api/cron/sync-all`,
        // Secret travels in a header, not the query string, so it never lands in access logs.
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
        // The serverless tick works inside the request for up to ~50s (function budget 60s). At the
        // 30s default this job would be reported as a timeout while the tick is still succeeding.
        requestTimeout: 90,
        schedule: { timezone: "Asia/Colombo", hours: [-1], mdays: [-1], minutes: [0, 10, 20, 30, 40, 50], months: [-1], wdays: [-1] }
    }
];

function requestApi(method, path, payload) {
    return new Promise((resolve, reject) => {
        const body = payload ? JSON.stringify(payload) : null;
        const options = {
            hostname: 'api.cron-job.org',
            path,
            method,
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// Idempotent: delete existing SLTSERP jobs first so re-runs don't duplicate
async function cleanupExistingJobs() {
    const res = await requestApi('GET', '/jobs');
    if (res.status < 200 || res.status >= 300) {
        console.error(`❌ Failed to list existing jobs (HTTP ${res.status}): ${res.data}`);
        return;
    }
    const existing = JSON.parse(res.data).jobs || [];
    for (const j of existing.filter((x) => x.title && x.title.startsWith('SLTSERP'))) {
        const del = await requestApi('DELETE', `/jobs/${j.jobId}`);
        console.log(del.status >= 200 && del.status < 300
            ? `🗑️  Removed old job: ${j.title}`
            : `⚠️  Failed to remove job ${j.jobId}: ${del.data}`);
    }
}

async function createCronJob(jobData) {
    const res = await requestApi('PUT', '/jobs', {
        job: {
            url: jobData.url,
            enabled: true,
            saveResponses: true,
            title: jobData.title,
            requestTimeout: jobData.requestTimeout ?? 90,
            // Deterministic firing: a tick shifted a few minutes early still dedupes, but the
            // cadence tables (10/20/30-minute buckets) are written against the scheduled minute.
            disabledEarlyExecution: true,
            ...(jobData.headers ? { headers: jobData.headers } : {}),
            schedule: jobData.schedule
        }
    });
    if (res.status >= 200 && res.status < 300) {
        console.log(`✅ Successfully created: ${jobData.title}`);
    } else {
        console.error(`❌ Failed to create: ${jobData.title} (HTTP ${res.status})`);
        console.error(res.data);
    }
}

async function setupAllJobs() {
    console.log(`🚀 Setting up Cron Jobs for domain: ${baseUrl}\n`);
    await cleanupExistingJobs();
    console.log('');
    for (const job of jobs) {
        try {
            await createCronJob(job);
            // Small delay to avoid cron-job.org API rate-limiting on rapid creates
            await new Promise((r) => setTimeout(r, 1500));
        } catch (e) {
            console.log(`❌ Error on ${job.title}: ${e.message}`);
        }
    }
    console.log(`\n🎉 All jobs processed! You can check them at https://console.cron-job.org/`);
}

setupAllJobs();
