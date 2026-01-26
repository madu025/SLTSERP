// Background Service Worker for SLT Bridge
// Handles data syncing to bypass CSP and Mixed Content restrictions

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'pushToERP') {
        const data = request.data;

        const targets = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'https://d2ixqikwtprwf0.cloudfront.net'
        ];

        // Process sequentially
        const syncPromises = targets.map(async (target) => {
            try {
                const response = await fetch(`${target}/api/test/extension-push`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                return { target, ok: response.ok };
            } catch (e) {
                return { target, ok: false, error: e.message };
            }
        });

        Promise.all(syncPromises).then(results => {
            const hasSuccess = results.some(r => r.ok);
            sendResponse({ success: hasSuccess, results });
        });

        return true; // Keep channel open for async response
    }
});
