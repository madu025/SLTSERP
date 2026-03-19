const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split(/\r?\n/);
        
        lines.forEach(line => {
            const trimmedLine = line.trim();
            // Skip comments and empty lines
            if (!trimmedLine || trimmedLine.startsWith('#')) return;

            // Find first '=' to split key and value
            const equalSignIndex = trimmedLine.indexOf('=');
            if (equalSignIndex === -1) return;

            const key = trimmedLine.substring(0, equalSignIndex).trim();
            let value = trimmedLine.substring(equalSignIndex + 1).trim();

            // Handle quoted values
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }

            // Set to process.env if not already set by the system
            if (!process.env[key]) {
                process.env[key] = value;
            }
        });
        console.log('✅ Local .env file loaded successfully.');
    } catch (err) {
        console.warn('⚠️ Warning: Error reading .env file:', err.message);
    }
} else {
    console.log('ℹ️ No local .env file found. Using system environment variables.');
}

const primaryUrl = process.env.DATABASE_URL;
// Use DIRECT_URL for primary if available, otherwise DATABASE_URL
const primaryPushUrl = process.env.DIRECT_URL || primaryUrl;
const replicaUrl = process.env.READ_REPLICA_URL;

if (!primaryPushUrl) {
    console.error('❌ Error: DATABASE_URL or DIRECT_URL is not set in .env');
    process.exit(1);
}

if (!replicaUrl) {
    console.warn('⚠️ Warning: READ_REPLICA_URL is not set. Skipping replica sync.');
}

console.log('🚀 Starting Database Schema Sync...');

try {
    // 1. Push to Primary Message
    console.log('\n🔵 Syncing to PRIMARY Database...');
    // Force use the Direct URL for primary push
    execSync(`npx prisma db push --accept-data-loss`, {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: primaryPushUrl }
    });
    console.log('✅ Primary Database Synced!');

    if (replicaUrl) {
        console.log('\n🟣 Syncing to REPLICA Database...');
        execSync(`npx prisma db push --skip-generate --accept-data-loss`, {
            stdio: 'inherit',
            env: { ...process.env, DATABASE_URL: replicaUrl }
        });
        console.log('✅ Replica Database Synced!');
    }

    console.log('\n🎉 All Databases are now in Sync with your Schema!');

} catch (error) {
    console.error('\n❌ Sync Failed:', error.message);
    process.exit(1);
}
