/**
 * SLT-ERP Bridge (manifest-driven version)
 * Popup: Sync Controller + History + Settings
 */

document.addEventListener('DOMContentLoaded', () => {
    // ─── Elements ────────────────────────────────────────────────────
    const soNumEl = document.getElementById('so-num');
    const lastSyncEl = document.getElementById('last-sync');
    const syncBtn = document.getElementById('sync-btn');
    const syncLoader = document.getElementById('sync-loader');
    const statusMsg = document.getElementById('sync-status-msg');
    const statusDot = document.getElementById('status-dot');
    const pendingBadge = document.getElementById('pending-badge');
    const historyList = document.getElementById('history-list');
    const keyStatus = document.getElementById('key-status');
    const keyStatusDot = document.getElementById('key-status-dot');
    const originDisplay = document.getElementById('origin-display');
    const resetSettingsBtn = document.getElementById('reset-settings');
    const settingsMsg = document.getElementById('settings-msg');

    let currentSoNum = null;

    // ─── Tab Switching ───────────────────────────────────────────────
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');

            if (tab.dataset.tab === 'tab-history') loadHistory();
            if (tab.dataset.tab === 'tab-settings') loadSettings();
        });
    });

    // ─── SOD Detection & Status ──────────────────────────────────────
    async function updatePopupStatus() {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) return;

        const url = tabs[0].url || "";
        const soMatch = url.match(/[?&]sod=([A-Z0-9]+)/i);
        currentSoNum = soMatch ? soMatch[1].toUpperCase() : null;

        if (currentSoNum) {
            soNumEl.innerText = currentSoNum;
            soNumEl.style.color = 'var(--primary)';
            syncBtn.disabled = false;

            chrome.storage.local.get(['lastScraped'], (res) => {
                const last = res.lastScraped;
                if (last && last.soNum === currentSoNum) {
                    const date = new Date(last.timestamp);
                    lastSyncEl.innerText = `Detected: ${date.toLocaleTimeString()}`;
                    statusDot.className = 'dot dot-success';
                } else {
                    lastSyncEl.innerText = 'Portal data not captured yet';
                    statusDot.className = 'dot dot-muted';
                }
            });
        } else {
            soNumEl.innerText = 'NO SOD DETECTED';
            soNumEl.style.color = 'var(--muted)';
            lastSyncEl.innerText = 'Navigate to an SLT Service Order';
            syncBtn.disabled = true;
            statusDot.className = 'dot dot-muted';
        }

        // Check pending retries
        chrome.runtime.sendMessage({ action: 'getPendingCount' }, (res) => {
            if (res?.count > 0) {
                pendingBadge.innerText = `${res.count} PENDING`;
                pendingBadge.style.display = 'inline-block';
                statusDot.className = 'dot dot-warning';
            } else {
                pendingBadge.style.display = 'none';
            }
        });
    }

    // ─── Sync Button ─────────────────────────────────────────────────
    syncBtn.addEventListener('click', async () => {
        if (!currentSoNum) return;

        syncBtn.disabled = true;
        syncLoader.style.display = 'block';
        statusMsg.innerText = 'Pushing to ERP...';
        statusMsg.className = 'status-msg msg-pending';

        chrome.storage.local.get(['lastScraped'], (res) => {
            const payload = res.lastScraped;

            if (!payload || payload.soNum !== currentSoNum) {
                syncLoader.style.display = 'none';
                syncBtn.disabled = false;
                statusMsg.innerText = 'No valid data captured for this SO';
                statusMsg.className = 'status-msg msg-error';
                return;
            }

            chrome.runtime.sendMessage({ action: 'pushToERP', data: payload }, (response) => {
                syncLoader.style.display = 'none';
                syncBtn.disabled = false;

                if (response?.success) {
                    statusMsg.innerText = 'SYNC SUCCESSFUL';
                    statusMsg.className = 'status-msg msg-success';
                } else {
                    statusMsg.innerText = 'SYNC FAILED: ' + (response?.error || 'Unknown Error');
                    statusMsg.className = 'status-msg msg-error';
                }

                setTimeout(() => { statusMsg.innerText = ''; }, 3000);
            });
        });
    });

    // ─── History ─────────────────────────────────────────────────────
    function loadHistory() {
        chrome.runtime.sendMessage({ action: 'getSyncHistory' }, (res) => {
            const history = res?.history || [];

            if (history.length === 0) {
                historyList.innerHTML = '<div style="color: var(--muted); font-size: 11px; text-align: center; padding: 20px;">No sync history yet</div>';
                return;
            }

            historyList.innerHTML = history.slice(0, 20).map(item => {
                const time = new Date(item.timestamp).toLocaleTimeString();
                const stateClass = item.state === 'SUCCESS' ? 'history-state-success' :
                                   item.state === 'FAILED' ? 'history-state-failed' : 'history-state-pending';
                return `
                    <div class="history-item">
                        <span class="history-so">${item.soNum || 'N/A'}</span>
                        <span class="${stateClass}">${item.state}</span>
                        <span class="history-time">${time}</span>
                    </div>
                `;
            }).join('');
        });
    }

    // ─── Settings (Read-Only Status) ─────────────────────────────────
    const DEFAULT_KEY = 'slt-bridge-secret-2026';
    const DEFAULT_ORIGIN = 'https://sltserp.vercel.app';

    function loadSettings() {
        chrome.storage.local.get(['extensionKey', 'erpOrigin'], (res) => {
            const key = res.extensionKey || DEFAULT_KEY;
            const origin = res.erpOrigin || DEFAULT_ORIGIN;

            // Show key status
            if (key === DEFAULT_KEY) {
                keyStatus.innerText = 'Pre-configured';
                keyStatus.style.color = 'var(--success)';
                keyStatusDot.className = 'dot dot-success';
            } else {
                keyStatus.innerText = 'Custom (modified)';
                keyStatus.style.color = 'var(--warning)';
                keyStatusDot.className = 'dot dot-warning';
            }

            // Show origin
            originDisplay.innerText = origin;
        });
    }

    resetSettingsBtn.addEventListener('click', () => {
        chrome.storage.local.set({ extensionKey: DEFAULT_KEY, erpOrigin: DEFAULT_ORIGIN }, () => {
            loadSettings(); // Refresh display
            settingsMsg.innerText = 'Reset to defaults';
            settingsMsg.className = 'status-msg msg-success';
            setTimeout(() => { settingsMsg.innerText = ''; }, 2000);
        });
    });

    // ─── Version Badge (manifest is the source of truth) ─────────────
    const manifestVersion = `v${chrome.runtime.getManifest().version}`;
    ['hdrVersion', 'settingVersion'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerText = manifestVersion;
    });

    // ─── Init ────────────────────────────────────────────────────────
    setInterval(updatePopupStatus, 1000);
    updatePopupStatus();
});
