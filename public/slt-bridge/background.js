/**
 * PHOENIX BRIDGE v3.0.0
 * Background: Persistence Proxy & ERP Bridge
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'pushToERP') {
        const payload = request.data;

        // Strategy: Async Burst Sync (Phoenix Bridge) with Local Dev Auto-Routing
        chrome.storage.local.get(['erpOrigin'], (res) => {
            const origin = res.erpOrigin || 'https://d2ixqikwtprwf0.cloudfront.net';
            const targetUrl = origin.includes('localhost')
                ? `${origin}/api/test/extension-push`
                : 'https://d2ixqikwtprwf0.cloudfront.net/api/service-orders/bridge-sync';

            console.log(`[PHOENIX-PROXY] Attempting to push to ERP at: ${targetUrl}`);
            fetch(targetUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-extension-key': 'slt-bridge-secret-2026'
                },
                body: JSON.stringify(payload)
            })
                .then(res => res.json())
                .then(data => {
                    sendResponse({ success: true, data });
                    chrome.tabs.query({ url: "*://localhost/*" }, (tabs) => {
                        tabs.forEach(tab => {
                            if (tab.id) chrome.tabs.sendMessage(tab.id, { action: 'SYNC_SUCCESS', payload }).catch(() => {});
                        });
                    });
                    chrome.tabs.query({ url: "*://sltserp.vercel.app/*" }, (tabs) => {
                        tabs.forEach(tab => {
                            if (tab.id) chrome.tabs.sendMessage(tab.id, { action: 'SYNC_SUCCESS', payload }).catch(() => {});
                        });
                    });
                })
                .catch((err) => {
                    console.warn('[PHOENIX-PROXY] ERP Sync Failed. Check Connection.', err);
                    sendResponse({ success: false, error: 'ERP_OFFLINE' });
                });
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
