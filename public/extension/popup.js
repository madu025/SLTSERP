/**
 * SLT-ERP Phoenix Bridge v4.5.0
 * Logic: Streamlined Sync Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    const soNumEl = document.getElementById('so-num');
    const lastSyncEl = document.getElementById('last-sync');
    const syncBtn = document.getElementById('sync-btn');
    const syncLoader = document.getElementById('sync-loader');
    const statusMsg = document.getElementById('sync-status-msg');
    const statusDot = document.getElementById('status-dot');

    let currentSoNum = null;

    async function updatePopupStatus() {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) return;

        const url = tabs[0].url || "";
        const soMatch = url.match(/[?&]sod=([A-Z0-9]+)/i);
        currentSoNum = soMatch ? soMatch[1].toUpperCase() : null;

        // --- Current SO Status ---
        if (currentSoNum) {
            soNumEl.innerText = currentSoNum;
            soNumEl.style.color = 'var(--primary)';
            syncBtn.disabled = false;

            chrome.storage.local.get(['lastScraped'], (res) => {
                const last = res.lastScraped;
                if (last && last.soNum === currentSoNum) {
                    const date = new Date(last.timestamp);
                    lastSyncEl.innerText = `Detected: ${date.toLocaleTimeString()}`;
                    statusDot.style.background = 'var(--success)';
                    statusDot.style.boxShadow = '0 0 8px var(--success)';
                } else {
                    lastSyncEl.innerText = 'Capturing portal data...';
                    statusDot.style.background = 'var(--muted)';
                    statusDot.style.boxShadow = 'none';
                }
            });
        } else {
            soNumEl.innerText = 'NO SOD DETECTED';
            soNumEl.style.color = 'var(--muted)';
            lastSyncEl.innerText = 'Navigate to an SLT Service Order';
            syncBtn.disabled = true;
            statusDot.style.background = 'var(--muted)';
            statusDot.style.boxShadow = 'none';
        }

        // --- Global Sync History ---
        chrome.storage.local.get(['lastSuccessfulSync'], (res) => {
            const hist = res.lastSuccessfulSync;
            const histSoEl = document.getElementById('last-success-so');
            const histTimeEl = document.getElementById('last-success-time');

            if (hist && hist.success) {
                histSoEl.innerText = hist.soNum;
                const date = new Date(hist.timestamp);
                histTimeEl.innerText = `Successfully synced at ${date.toLocaleTimeString()}`;
            }
        });
    }

    syncBtn.addEventListener('click', async () => {
        if (!currentSoNum) return;

        // UI Feedback: Start
        syncBtn.disabled = true;
        syncLoader.style.display = 'block';
        statusMsg.innerText = 'Pushing to ERP...';
        statusMsg.className = 'msg-pending';

        try {
            // Get the latest data from storage
            chrome.storage.local.get(['lastScraped'], (res) => {
                const payload = res.lastScraped;

                if (!payload || payload.soNum !== currentSoNum) {
                    throw new Error('No valid data captured for this SO');
                }

                // Send message to background to perform the fetch
                chrome.runtime.sendMessage({ action: 'pushToERP', data: payload }, (response) => {
                    syncLoader.style.display = 'none';
                    syncBtn.disabled = false;

                    if (response && response.success) {
                        statusMsg.innerText = '✅ DATABASE SYNC SUCCESSFUL';
                        statusMsg.className = 'msg-success';
                        setTimeout(() => {
                            statusMsg.innerText = '';
                        }, 3000);
                    } else {
                        statusMsg.innerText = '❌ SYNC FAILED: ' + (response?.error || 'Unknown Error');
                        statusMsg.className = 'msg-error';
                    }
                });
            });
        } catch (err) {
            syncLoader.style.display = 'none';
            syncBtn.disabled = false;
            statusMsg.innerText = '❌ ERROR: ' + err.message;
            statusMsg.className = 'msg-error';
        }
    });

    // Refresh status every second
    setInterval(updatePopupStatus, 1000);
    updatePopupStatus();
});
