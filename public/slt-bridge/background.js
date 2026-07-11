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
        syncSLTCookie();
    }
});

// Auto-Sync SLT Portal Session Cookie to local/production ERP
function syncSLTCookie() {
    chrome.cookies.get({ url: 'https://serviceportal.slt.lk', name: 'PHPSESSID' }, (cookie) => {
        if (cookie && cookie.value) {
            const cookieValue = `PHPSESSID=${cookie.value}`;
            
            chrome.storage.local.get(['erpOrigin'], (res) => {
                const origin = res.erpOrigin || 'https://sltserp.vercel.app';
                
                // POST this cookie value to local/production ERP
                fetch(`${origin}/api/invoices/slt-registry`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-extension-key': 'slt-bridge-secret-2026'
                    },
                    body: JSON.stringify({ action: 'save-cookie', cookie: cookieValue })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        console.log(`[SLT-BRIDGE-BG] Session cookie synced to ERP (${origin}) successfully.`);
                    }
                })
                .catch(err => {
                    console.log(`[SLT-BRIDGE-BG] ERP sync ping failed for ${origin}.`);
                });
            });
        }
    });
}

// Sync on startup and installation
chrome.runtime.onInstalled.addListener(syncSLTCookie);
chrome.runtime.onStartup.addListener(syncSLTCookie);

// Sync when cookies are updated or added
chrome.cookies.onChanged.addListener((changeInfo) => {
    if (changeInfo.cookie.domain.includes('slt.lk') && changeInfo.cookie.name === 'PHPSESSID') {
        syncSLTCookie();
    }
});
