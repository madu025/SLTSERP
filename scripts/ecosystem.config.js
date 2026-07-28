module = {
    apps: [
        {
            name: 'sltserp-worker',
            script: 'npx',
            args: 'tsx scripts/run-worker.ts',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
};
