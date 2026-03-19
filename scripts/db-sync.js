// @ts-nocheck
/* eslint-disable */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Robust .env loader that handles multiple locations and file formats
 */
function loadEnv() {
    const possiblePaths = [
        path.join(process.cwd(), '.env'),
        path.join(__dirname, '../.env'),
        path.join(process.cwd(), '.env.local')
    ];

    console.log('🔍 Searching for .env files...');
    let envFound = false;

    for (const envPath of possiblePaths) {
        if (fs.existsSync(envPath)) {
            console.log(`✅ Found .env file at: ${envPath}`);
            try {
                const content = fs.readFileSync(envPath, 'utf8');
                // Handle UTF-16 and BOM if present
                const cleanContent = content.replace(/^\uFEFF/, '');
                
                cleanContent.split(/\r?\n/).forEach(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine && !trimmedLine.startsWith('#')) {
                        const firstEq = trimmedLine.indexOf('=');
                        if (firstEq !== -1) {
                            const key = trimmedLine.substring(0, firstEq).trim();
                            let value = trimmedLine.substring(firstEq + 1).trim();
                            
                            // Remove quotes if present
                            if ((value.startsWith('"') && value.endsWith('"')) || 
                                (value.startsWith("'") && value.endsWith("'"))) {
                                value = value.substring(1, value.length - 1);
                            }
                            
                            // Set environment variable if not already set (respect system env)
                            if (!process.env[key]) {
                                process.env[key] = value;
                            }
                        }
                    }
                });
                envFound = true;
                break; // Stop after first successful load
            } catch (err) {
                console.error(`❌ Failed to read .env at ${envPath}: ${err.message}`);
            }
        } else {
            console.log(`ℹ️ Not found at: ${envPath}`);
        }
    }

    if (!envFound) {
        console.warn('⚠️ No local .env file found. Relying on system environment variables.');
    }
}

async function sync() {
    console.log('🚀 Starting Database Synchronization...');
    loadEnv();

    const primaryPushUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
    const replicaUrl = process.env.READ_REPLICA_URL;

    if (!primaryPushUrl) {
        console.error('❌ Error: DATABASE_URL or DIRECT_URL is not set in .env or system environment.');
        process.exit(1);
    }

    // Mask sensitive info for logging
    const maskedUrl = primaryPushUrl.replace(/:([^:@]+)@/, ':****@');
    console.log(`📌 Using Primary Database URL: ${maskedUrl}`);

    try {
        console.log('📌 Running Prisma DB Push (Primary)...');
        execSync(`npx prisma db push --accept-data-loss`, { 
            stdio: 'inherit', 
            env: { ...process.env, DATABASE_URL: primaryPushUrl } 
        });
        console.log('✅ Primary Database Synchronized.');

        if (replicaUrl) {
            const maskedReplica = replicaUrl.replace(/:([^:@]+)@/, ':****@');
            console.log(`📌 Using Replica Database URL: ${maskedReplica}`);
            console.log('📌 Running Prisma DB Push (Replica)...');
            try {
                execSync(`npx prisma db push --accept-data-loss`, { 
                    stdio: 'inherit', 
                    env: { ...process.env, DATABASE_URL: replicaUrl } 
                });
                console.log('✅ Read Replica Synchronized.');
            } catch (replicaError) {
                console.warn('⚠️ Warning: Read Replica sync failed. This may be expected if it is read-only.');
                console.warn(replicaError.message);
            }
        } else {
            console.log('ℹ️ Note: READ_REPLICA_URL not found, skipping replica sync.');
        }

        console.log('✨ All Database operations completed successfully.');
    } catch (error) {
        console.error('❌ Critical Error during database sync:');
        console.error(error.message);
        process.exit(1);
    }
}

sync();
