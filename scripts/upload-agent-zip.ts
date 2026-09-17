import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { NativeS3Client, getS3Config } from '../src/lib/s3-client';

async function uploadAgentZip() {
    const zipPath = 'C:\\Users\\Prasad\\Desktop\\SLTERPAgent\\publish\\SLTSERPagent_setup.zip';
    console.log(`Reading Desktop Agent ZIP from: ${zipPath}...`);
    
    if (!fs.existsSync(zipPath)) {
        throw new Error(`Zip file not found at ${zipPath}`);
    }

    const zipBuffer = fs.readFileSync(zipPath);
    console.log(`ZIP Size: ${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB`);

    const s3Config = getS3Config();
    if (!s3Config) {
        throw new Error('S3 configuration is missing from environment variables');
    }

    console.log(`Target S3 Endpoint: ${s3Config.endpoint}`);
    console.log(`Target Bucket: ${s3Config.bucket}`);
    console.log(`Target Object Key: sltserp-agent/SLTSERPagent_setup.zip`);

    const client = new NativeS3Client(s3Config);
    const result = await client.putObject({
        key: 'sltserp-agent/SLTSERPagent_setup.zip',
        body: zipBuffer,
        contentType: 'application/zip'
    });

    if (result.success) {
        console.log(`\n========================================`);
        console.log(`  DESKTOP AGENT UPLOAD SUCCESSFUL!`);
        console.log(`========================================`);
        console.log(`URL: ${s3Config.publicUrlPrefix}/sltserp-agent/SLTSERPagent_setup.zip`);
    } else {
        console.error(`Upload FAILED: ${result.error}`);
        process.exit(1);
    }
}

uploadAgentZip().catch(err => {
    console.error('Fatal error during S3 upload:', err);
    process.exit(1);
});
