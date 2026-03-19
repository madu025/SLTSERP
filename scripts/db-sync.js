const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split(/\r?\n/).forEach(line => {
        // Basic parser that handles Key="Value" or Key=Value
        const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            // Remove wrapping quotes if present
            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                value = value.slice(1, -1);
            }
            if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    });
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
