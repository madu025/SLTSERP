/**
 * SLT-ERP Bridge (version comes from manifest.json - the single source of truth)
 * Background: Persistence Proxy & ERP Bridge
 * - Pre-configured extension key (auto-set on install)
 * - Retry queue for failed syncs
 * - Sync status tracking
 */

const VERSION = chrome.runtime.getManifest().version;

// ─── Pre-configured Extension Key ────────────────────────────────────
// This key is baked into the extension build. It matches EXTENSION_SECRET
// in the ERP's .env file. Users do NOT need to configure this manually.
const DEFAULT_EXTENSION_KEY = 'slt-bridge-secret-2026';

async function getExtensionKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['extensionKey'], (res) => {
            // Use stored override or fall back to pre-configured default
            resolve(res.extensionKey || DEFAULT_EXTENSION_KEY);
        });
    });
}

// ─── Consent Gate (Chrome Web Store User Data policy) ─────────────────
// No user data may be collected or transmitted until the user has
// affirmatively agreed on consent.html (opened on install). The popup
// Settings tab can withdraw consent at any time, which stops every data
// path below because each one checks this flag first.
async function hasConsent() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['consentGiven'], (res) => {
            resolve(res.consentGiven === true);
        });
    });
}

// ─── Retry Queue (IndexedDB-backed) ──────────────────────────────────
const DB_NAME = 'slt_bridge_queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending_syncs';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function enqueueRetry(payload) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.add({
            payload,
            attempts: 0,
            maxAttempts: 3,
            nextRetry: Date.now(),
            createdAt: new Date().toISOString()
        });
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
        db.close();
        console.log(`[BRIDGE] Queued for retry: SO ${payload.soNum}`);
    } catch (err) {
        console.warn('[BRIDGE] Failed to enqueue retry:', err);
    }
}

async function getPendingSyncs() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const all = await new Promise((res) => {
            const req = store.getAll();
            req.onsuccess = () => res(req.result);
        });
        db.close();
        return all;
    } catch {
        return [];
    }
}

async function removePendingSync(id) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        await new Promise((res) => { tx.oncomplete = res; });
        db.close();
    } catch (err) {
        console.warn('[BRIDGE] Failed to remove pending sync:', err);
    }
}

async function updatePendingSync(id, updates) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const item = await new Promise((res) => {
            const req = store.get(id);
            req.onsuccess = () => res(req.result);
        });
        if (item) {
            store.put({ ...item, ...updates });
        }
        await new Promise((res) => { tx.oncomplete = res; });
        db.close();
    } catch (err) {
        console.warn('[BRIDGE] Failed to update pending sync:', err);
    }
}

// ─── Sync Status Tracking ────────────────────────────────────────────
async function updateSyncStatus(status) {
    // status: { soNum, state: 'SUCCESS'|'FAILED'|'PENDING', message, timestamp }
    const existing = await new Promise((r) => chrome.storage.local.get(['syncHistory'], r));
    const history = existing.syncHistory || [];
    history.unshift({ ...status, timestamp: new Date().toISOString() });
    // Keep last 50 entries
    if (history.length > 50) history.length = 50;
    chrome.storage.local.set({ syncHistory: history });
}

// ─── Core Push to ERP ────────────────────────────────────────────────
async function pushToERP(payload) {
    const origin = await new Promise((r) => chrome.storage.local.get(['erpOrigin'], r))
        .then(res => res.erpOrigin || 'https://sltserp.vercel.app');
    const extensionKey = await getExtensionKey();

    const targetUrl = `${origin.replace(/\/+$/, '')}/api/service-orders/extension-push`;

    const headers = { 'Content-Type': 'application/json' };
    if (extensionKey) {
        headers['x-extension-key'] = extensionKey;
    }

    const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
    }

    return res.json();
}

// ─── Process Retry Queue ─────────────────────────────────────────────
async function processRetryQueue() {
    // Consent gate: queued payloads contain scraped portal data - do not
    // transmit them while consent is not given.
    if (!(await hasConsent())) return;

    const pending = await getPendingSyncs();
    const now = Date.now();

    for (const item of pending) {
        // Exponential backoff: 30s, 2min, 8min
        if (now < item.nextRetry) continue;

        try {
            await pushToERP(item.payload);
            await removePendingSync(item.id);
            await updateSyncStatus({
                soNum: item.payload.soNum,
                state: 'SUCCESS',
                message: 'Retry successful'
            });
            console.log(`[BRIDGE] Retry success for SO ${item.payload.soNum}`);
        } catch (err) {
            const nextAttempt = item.attempts + 1;
            if (nextAttempt >= item.maxAttempts) {
                await removePendingSync(item.id);
                await updateSyncStatus({
                    soNum: item.payload.soNum,
                    state: 'FAILED',
                    message: `Max retries exceeded: ${err.message}`
                });
                console.warn(`[BRIDGE] Max retries exceeded for SO ${item.payload.soNum}`);
            } else {
                const backoffMs = 30000 * Math.pow(4, nextAttempt); // 30s, 2min, 8min
                await updatePendingSync(item.id, {
                    attempts: nextAttempt,
                    nextRetry: now + backoffMs
                });
            }
        }
    }
}

// ─── Message Handler ─────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'pushToERP') {
        hasConsent().then((ok) => {
            if (!ok) {
                sendResponse({ success: false, error: 'Consent not given - enable sync from the consent page or popup first' });
                return;
            }
            pushToERP(request.data)
                .then(data => {
                    sendResponse({ success: true, data });
                    updateSyncStatus({
                        soNum: request.data.soNum,
                        state: 'SUCCESS',
                        message: 'Sync successful'
                    });
                    // Notify ERP tabs
                    notifyERPTabs(request.data);
                })
                .catch(err => {
                    console.warn('[BRIDGE] ERP sync failed, queuing retry:', err.message);
                    enqueueRetry(request.data);
                    updateSyncStatus({
                        soNum: request.data.soNum,
                        state: 'FAILED',
                        message: err.message
                    });
                    sendResponse({ success: false, error: err.message });
                });
        });
        return true; // Keep channel open for async response
    }

    if (request.action === 'consentGranted') {
        // User just agreed on the consent page - run the session cookie sync
        // immediately so the very next portal interaction can reach the ERP.
        syncSLTCookie();
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'getSyncHistory') {
        chrome.storage.local.get(['syncHistory'], (res) => {
            sendResponse({ history: res.syncHistory || [] });
        });
        return true;
    }

    if (request.action === 'getPendingCount') {
        getPendingSyncs().then(items => {
            sendResponse({ count: items.length });
        });
        return true;
    }

    if (request.action === 'setExtensionKey') {
        chrome.storage.local.set({ extensionKey: request.key }, () => {
            sendResponse({ success: true });
        });
        return true;
    }
});

function notifyERPTabs(payload) {
    const patterns = [
        "*://localhost/*",
        "*://127.0.0.1/*",
        "*://sltserp.vercel.app/*",
        "*://d2ixqikwtprwf0.cloudfront.net/*"
    ];
    patterns.forEach(pattern => {
        chrome.tabs.query({ url: pattern }, (tabs) => {
            tabs.forEach(tab => {
                if (tab.id) chrome.tabs.sendMessage(tab.id, { action: 'SYNC_SUCCESS', payload }).catch(() => {});
            });
        });
    });
}

// ─── Cookie Sync (SLT Portal Session) ────────────────────────────────
async function syncSLTCookie() {
    // Consent gate: the portal session cookie is authentication data and may
    // only be read/transmitted after explicit consent (CWS User Data policy).
    if (!(await hasConsent())) return;

    const getCookie = (url) => new Promise((resolve) => {
        chrome.cookies.get({ url, name: 'PHPSESSID' }, resolve);
    });

    const cookie = (await getCookie('https://ishamp.slt.lk')) || (await getCookie('https://serviceportal.slt.lk'));
    if (!cookie?.value) return;

    const origin = await new Promise((r) => chrome.storage.local.get(['erpOrigin'], r))
        .then(res => res.erpOrigin || 'https://sltserp.vercel.app');
    const extensionKey = await getExtensionKey();

    const headers = { 'Content-Type': 'application/json' };
    if (extensionKey) headers['x-extension-key'] = extensionKey;

    try {
        const res = await fetch(`${origin}/api/invoices/slt-registry`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ action: 'save-cookie', cookie: `PHPSESSID=${cookie.value}` })
        });
        const data = await res.json();
        if (data.success) {
            console.log(`[BRIDGE] Session cookie synced to ERP (${origin})`);
        }
    } catch {
        console.warn(`[BRIDGE] Cookie sync ping failed for ${origin}`);
    }
}

// ─── Alarms & Lifecycle ──────────────────────────────────────────────
chrome.alarms.create('pulse', { periodInMinutes: 1 });
chrome.alarms.create('retry-processor', { periodInMinutes: 0.5 }); // Process retry queue every 30s

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'pulse') {
        syncSLTCookie();
    }
    if (alarm.name === 'retry-processor') {
        processRetryQueue();
    }
});

chrome.runtime.onInstalled.addListener(() => {
    // Pre-configure extension key on install (zero-config for users)
    chrome.storage.local.set({ extensionKey: DEFAULT_EXTENSION_KEY }, () => {
        console.log(`[BRIDGE] v${VERSION} installed - key pre-configured`);
    });
    // CWS User Data policy: collection must not start before affirmative
    // consent. Open the consent page unless consent was already recorded.
    chrome.storage.local.get(['consentGiven'], (res) => {
        if (res.consentGiven === true) {
            syncSLTCookie();
        } else {
            chrome.tabs.create({ url: chrome.runtime.getURL('consent.html') });
        }
    });
});
chrome.runtime.onStartup.addListener(syncSLTCookie);

chrome.cookies.onChanged.addListener((changeInfo) => {
    if (changeInfo.cookie.domain.includes('slt.lk') && changeInfo.cookie.name === 'PHPSESSID') {
        syncSLTCookie();
    }
});
