/**
 * SLT-ERP i-SHAMP BRIDGE v4.4.0
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
            statusText.innerText = "Searching SLT Portal...";
            list.innerHTML = `<div class="empty">(Scanning)<br><br><span style="font-size:11px">Navigate to a Service Order to begin synchronization.</span></div>`;
            return;
        }

        statusText.innerText = `i-SHAMP ACTIVE: ${data.soNum}`;
        list.innerHTML = '';

        // Group data by category
        const categories = {
            'BASIC INFO': [],
            'MATERIALS': [],
            'TEAM': [],
            'HISTORY': [],
            'OTHER': []
        };

        const details = data.details || {};

        Object.entries(details).forEach(([k, v]) => {
            if (k.includes('MATERIAL') || k.includes('ITEM')) {
                categories['MATERIALS'].push([k, v]);
            } else if (k.includes('TEAM') || k.includes('TECH') || k.includes('ASSIGNED')) {
                categories['TEAM'].push([k, v]);
            } else if (k.includes('DATE') || k.includes('STATUS') || k.includes('REMARK')) {
                categories['HISTORY'].push([k, v]);
            } else if (['SO_NUM', 'SERVICE_ORDER', 'CUSTOMER', 'NAME', 'ADDRESS', 'PHONE'].some(x => k.includes(x))) {
                categories['BASIC INFO'].push([k, v]);
            } else {
                categories['OTHER'].push([k, v]);
            }
        });

        // Render by category
        Object.entries(categories).forEach(([catName, items]) => {
            if (items.length === 0) return;

            const catHeader = document.createElement('div');
            catHeader.style.cssText = 'background:#334155;color:#94a3b8;padding:6px 12px;margin:12px 0 8px 0;font-size:10px;font-weight:800;letter-spacing:1px;border-radius:4px;';
            catHeader.innerText = `${catName} (${items.length})`;
            list.appendChild(catHeader);

            items.forEach(([k, v]) => {
                const card = document.createElement('div');
                card.className = 'detail-card';

                // Truncate long values
                const displayValue = (typeof v === 'string' && v.length > 100) ? v.substring(0, 100) + '...' : v;

                card.innerHTML = `
                <div class="label">${k}</div>
                <div class="value" title="${v}">${displayValue}</div>
            `;
                list.appendChild(card);
            });
        });

        // Show Materials Table separately if available
        if (data.materialDetails && data.materialDetails.length > 0) {
            const matHeader = document.createElement('div');
            matHeader.style.cssText = 'background:#8b5cf6;color:white;padding:6px 12px;margin:16px 0 8px 0;font-size:10px;font-weight:800;letter-spacing:1px;border-radius:4px;';
            matHeader.innerText = `MATERIALS LIST (${data.materialDetails.length})`;
            list.appendChild(matHeader);

            const matTable = document.createElement('div');
            matTable.style.cssText = 'background:#1e293b;border-radius:6px;overflow:hidden;font-size:11px;';

            data.materialDetails.forEach((mat, idx) => {
                const row = document.createElement('div');
                row.style.cssText = `padding:8px 12px;border-bottom:1px solid #334155;display:flex;justify-content:space-between;${idx % 2 === 0 ? 'background:rgba(255,255,255,0.02)' : ''}`;
                row.innerHTML = `
                <span style="color:#e2e8f0">${mat.TYPE || mat.ITEM}</span>
                <span style="color:#10b981;font-weight:700">${mat.QTY} ${mat.UNIT || ''}</span>
            `;
                matTable.appendChild(row);
            });

            list.appendChild(matTable);
        }

        // Diagnostics update
        if (diagSo) diagSo.innerText = data.soNum;
        const totalFields = Object.values(categories).flat().length;
        if (diagFields) diagFields.innerText = `${totalFields} Fields (Synced)`;

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
