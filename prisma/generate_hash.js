// Generate bcrypt hash for test users
// Run: node prisma/generate_hash.js

const bcrypt = require('bcryptjs');

async function generateHash() {
    const password = 'Admin@123';
    const hash = await bcrypt.hash(password, 10);

    console.log('\n========================================');
    console.log('Password Hash Generator for Test Users');
    console.log('========================================\n');
    console.log(`Password: ${password}`);
    console.log(`Hash: ${hash}\n`);
    console.log('Copy this hash and replace "ACTUAL_HASH_HERE" in:');
    console.log('📄 prisma/insert_test_users.sql\n');
    console.log('Then run the SQL file in pgAdmin or psql.');
    console.log('========================================\n');
}

generateHash().catch(console.error);
