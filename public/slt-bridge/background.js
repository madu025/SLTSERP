/**
 * PHOENIX BRIDGE v3.0.0
 * Background: Persistence Proxy & ERP Bridge
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'pushToERP') {
        const payload = request.data;

        // Strategy: Async Burst Sync (Phoenix Bridge)
        fetch('https://d2ixqikwtprwf0.cloudfront.net/api/service-orders/bridge-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            mode: 'cors'
        })
            .then(res => res.json())
            .then(data => sendResponse({ success: true, data }))
            .catch(() => {
                console.warn('[PHOENIX-PROXY] Cloudfront ERP Sync Failed. Check Connection.');
                sendResponse({ success: false, error: 'ERP_OFFLINE' });
            });

        return true; // Keep channel open
    }
});

// Alarm for redundant sync if needed
chrome.alarms.create('pulse', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'pulse') {
        console.log('[PHOENIX-BG] Heartbeat Active');
    }
});
