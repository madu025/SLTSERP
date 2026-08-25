/**
 * Build SLT Bridge Extension .crx file
 * Usage: npx tsx scripts/build-extension-crx.ts
 * 
 * This script uses the crx CLI to pack the extension.
 * Alternative: npx crx pack public/slt-bridge -o public/slt-bridge.crx -p public/slt-bridge.pem
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const EXTENSION_DIR = path.join(process.cwd(), 'public', 'slt-bridge');
const PEM_FILE = path.join(process.cwd(), 'public', 'slt-bridge.pem');
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'slt-bridge.crx');

async function main() {
    console.log('=== Building SLT Bridge Extension .crx ===\n');

    // Check if extension directory exists
    if (!fs.existsSync(EXTENSION_DIR)) {
        console.error(`Extension directory not found: ${EXTENSION_DIR}`);
        process.exit(1);
    }

    // Check if .pem file exists
    if (!fs.existsSync(PEM_FILE)) {
        console.error(`PEM file not found: ${PEM_FILE}`);
        console.log('Generate a new key pair using: npx crx keygen public');
        process.exit(1);
    }

    // Pack the extension using crx CLI
    console.log('Packing extension...');
    try {
        execSync(`npx crx pack ${EXTENSION_DIR} -o ${OUTPUT_FILE} -p ${PEM_FILE}`, {
            stdio: 'inherit'
        });
        console.log(`\nExtension packed successfully!`);
        console.log(`Output: ${OUTPUT_FILE}`);
        
        const stats = fs.statSync(OUTPUT_FILE);
        console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`);
    } catch (err) {
        console.error('Build failed:', err);
        process.exit(1);
    }
}

main();
