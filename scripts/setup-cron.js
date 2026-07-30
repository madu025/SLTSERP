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

const jobs = [
    {
        title: "SLTSERP - Master Sync (Every 15 Mins)",
        url: `${baseUrl}/api/cron/sync-all?secret=${CRON_SECRET}`,
        schedule: { timezone: "Asia/Colombo", hours: [-1], mdays: [-1], minutes: [0, 15, 30, 45], months: [-1], wdays: [-1] }
    }
];

function createCronJob(jobData) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            job: {
                url: jobData.url,
                enabled: true,
                saveResponses: true,
                title: jobData.title,
                schedule: jobData.schedule
            }
        });

        const options = {
            hostname: 'api.cron-job.org',
            path: '/jobs',
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`✅ Successfully created: ${jobData.title}`);
                    resolve(JSON.parse(data));
                } else {
                    console.error(`❌ Failed to create: ${jobData.title}`);
                    console.error(data);
                    reject(new Error(`Status Code: ${res.statusCode}`));
                }
            });
        });

        req.on('error', (e) => {
            console.error(`❌ Network Error for ${jobData.title}:`, e.message);
            reject(e);
        });

        req.write(payload);
        req.end();
    });
}

async function setupAllJobs() {
    console.log(`🚀 Setting up Cron Jobs for domain: ${baseUrl}\n`);
    for (const job of jobs) {
        try {
            await createCronJob(job);
        } catch {
            console.log(`Error on ${job.title}, continuing to next...`);
        }
    }
    console.log(`\n🎉 All jobs processed! You can check them at https://console.cron-job.org/`);
}

setupAllJobs();
