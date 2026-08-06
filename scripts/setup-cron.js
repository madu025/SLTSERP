/* eslint-disable @typescript-eslint/no-var-requires */
const https = require('https');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config();

const API_KEY = '7NSj1jDnC546l3n0GNaNrFZ3cvId1fWD4eVAaHmgGfM=';
const CRON_SECRET = process.env.CRON_SECRET || 'cd63fa6924b48cb930713ba7d5fd153f53794c0fe9c485f9731f4807308f3ef6';

const DOMAIN = process.argv[2];

if (!DOMAIN) {
    console.error("❌ Please provide your Vercel Domain as an argument.");
    console.error("👉 Example: node scripts/setup-cron.js https://sltserp.vercel.app");
    process.exit(1);
}

// Remove trailing slash if exists
const baseUrl = DOMAIN.replace(/\/$/, '');

// Cron schedules use cron-job.org instead of GitHub Actions — GitHub's
// scheduled workflows are delayed 30-60+ mins during peak load, cron-job.org
// fires within seconds of the scheduled minute.
const jobs = [
    {
        title: "SLTSERP - SOD Sync Batch 1 (Every 15 Mins)",
        url: `${baseUrl}/api/cron/sync-sod?secret=${CRON_SECRET}&offset=0&limit=15`,
        schedule: { timezone: "Asia/Colombo", hours: [-1], mdays: [-1], minutes: [0, 15, 30, 45], months: [-1], wdays: [-1] }
    },
    {
        title: "SLTSERP - SOD Sync Batch 2 (Every 15 Mins)",
        url: `${baseUrl}/api/cron/sync-sod?secret=${CRON_SECRET}&offset=15&limit=15`,
        schedule: { timezone: "Asia/Colombo", hours: [-1], mdays: [-1], minutes: [1, 16, 31, 46], months: [-1], wdays: [-1] }
    },
    {
        title: "SLTSERP - SOD Sync Batch 3 (Every 15 Mins)",
        url: `${baseUrl}/api/cron/sync-sod?secret=${CRON_SECRET}&offset=30&limit=15`,
        schedule: { timezone: "Asia/Colombo", hours: [-1], mdays: [-1], minutes: [2, 17, 32, 47], months: [-1], wdays: [-1] }
    },
    {
        title: "SLTSERP - PAT Sync (Every 30 Mins)",
        url: `${baseUrl}/api/cron/sync-pat?secret=${CRON_SECRET}`,
        schedule: { timezone: "Asia/Colombo", hours: [-1], mdays: [-1], minutes: [10, 40], months: [-1], wdays: [-1] }
    },
    {
        title: "SLTSERP - Master Sync (Every 15 Mins)",
        url: `${baseUrl}/api/cron/sync-all?secret=${CRON_SECRET}`,
        schedule: { timezone: "Asia/Colombo", hours: [-1], mdays: [-1], minutes: [0, 15, 30, 45], months: [-1], wdays: [-1] }
    },
    {
        title: "SLTSERP - Notification Cleanup (Weekly)",
        url: `${baseUrl}/api/notifications/cleanup?secret=${CRON_SECRET}`,
        schedule: { timezone: "Asia/Colombo", hours: [2], mdays: [-1], minutes: [0], months: [-1], wdays: [0] }
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
