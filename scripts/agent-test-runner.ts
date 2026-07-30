import { spawn } from 'child_process';

const PORT = 3000;

console.log('🚀 Starting Agentic API Tester...');

// Start the Next.js server in the background
const server = spawn('npm', ['run', 'dev'], {
    env: { ...process.env, PORT: PORT.toString() },
    stdio: 'ignore' // We don't need server logs here
});

console.log(`⏳ Waiting for server to boot on port ${PORT}...`);

setTimeout(() => {
    console.log('✅ Server assumed ready. Starting Agent Loop...');
    
    // Spawn the API Tester
    const agent = spawn('npx', ['ts-node', 'scripts/agent-api-tester.ts', process.argv[2] || ''], {
        stdio: 'inherit'
    });

    agent.on('close', (code) => {
        console.log(`🤖 Agent Loop exited with code ${code}. Cleaning up server...`);
        server.kill();
        process.exit(code || 0);
    });

}, 15000); // Wait 15s for Next.js to compile

process.on('SIGINT', () => {
    server.kill();
    process.exit();
});
