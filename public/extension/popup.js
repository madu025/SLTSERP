/**
 * SLT-ERP PHOENIX ELITE v3.1.5
 * Popup Logic: Intelligent Tab-Aware Bridge
 */

document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('list');
    const statusText = document.getElementById('status-text');
    const diagSo = document.getElementById('diag-so');
    const diagFields = document.getElementById('diag-fields');
    const diagSync = document.getElementById('diag-sync');

    // Tab Management (UI Tabs)
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const viewData = document.getElementById('view-data');
            const viewDiag = document.getElementById('view-diag');
            if (tab.id === 'tab-data') {
                viewData.style.display = 'block';
                viewDiag.style.display = 'none';
            } else {
                viewData.style.display = 'none';
                viewDiag.style.display = 'block';
            }
        });
    });

    async function updatePopup() {
        // 1. Identification: Who is the user looking at right now?
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) return;

        const url = tabs[0].url || "";
        const soMatch = url.match(/[?&]sod=([A-Z0-9]+)/i);
        const activeSoNum = soMatch ? soMatch[1].toUpperCase() : null;

        // 2. Fetching: Get data specifically for THIS active SO
        chrome.storage.local.get(['lastScraped', 'diagnostics_erp'], (res) => {
            let dataToShow = res.lastScraped;

            // If we are on an SOD page, prioritize showing data for THAT specific SOD
            if (activeSoNum) {
                chrome.storage.local.get([`sod_${activeSoNum}`], (sodRes) => {
                    const allTabsData = sodRes[`sod_${activeSoNum}`] || {};
                    const flattened = {};
                    Object.values(allTabsData).forEach(tab => Object.assign(flattened, tab));

                    // Construct presentation data
                    const displayData = {
                        soNum: activeSoNum,
                        details: flattened,
                        timestamp: new Date().toISOString(), // Use fresh for active focus
                        materialDetails: [] // Optional: fetch more if needed
                    };
                    render(displayData);
                });
            } else {
                // Fallback: If not on an SOD page, show global last scraped (Previous Focus)
                render(dataToShow);
            }
        });
    }

    function render(data) {
        if (!data || !data.soNum) {
            statusText.innerText = "Waiting for SLT Portal...";
            list.innerHTML = `<div class="empty">📡<br><br><span style="font-size:11px">Navigate to a Service Order to begin synchronization.</span></div>`;
            return;
        }

        statusText.innerText = `PHOENIX FOCUS: ${data.soNum}`;
        list.innerHTML = '';

        // 1. Details rendering
        const details = data.details || {};
        const entries = Object.entries(details);

        if (entries.length === 0) {
            list.innerHTML = `<div class="empty">🔍<br><br><span style="font-size:11px">No data captured for this SO yet. Try clicking different tabs.</span></div>`;
        } else {
            entries.forEach(([k, v]) => {
                const card = document.createElement('div');
                card.className = 'detail-card';
                card.innerHTML = `<div class="label">${k}</div><div class="value">${v}</div>`;
                list.appendChild(card);
            });
        }

        // Diagnostics
        if (diagSo) diagSo.innerText = data.soNum;
        if (diagFields) diagFields.innerText = `${entries.length} Fields (Synced)`;

        if (diagSync && data.timestamp) {
            const lastSync = new Date(data.timestamp);
            const diff = Math.floor((new Date().getTime() - lastSync.getTime()) / 1000);
            diagSync.innerText = diff < 5 ? 'Real-time' : `${diff}s ago`;
        }
    }

    // High-Frequency Intelligent Sync
    setInterval(updatePopup, 1000);
    updatePopup();
});
