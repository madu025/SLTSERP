// Comprehensive Scraper & Diagnostic Tool for SLT Portal
console.log("🚀 SLT Bridge Content Script Loaded");

// Internal state for diagnostics
const diag = {
    status: 'READY',
    lastError: null,
    lastScrapeTime: null,
    elementsFound: 0,
    bridgeId: Math.random().toString(36).substring(7)
};

function updateDiagnostics(update) {
    Object.assign(diag, update);
    chrome.storage.local.set({ diagnostics_slt: diag });
}

function injectStatusIcon(status = 'ACTIVE', errorMessage = '') {
    const existing = document.getElementById('slt-erp-status-bar');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'slt-erp-status-bar';

    const isError = status === 'ERROR';
    const color = isError ? '#ef4444' : '#22c55e';
    const bgColor = '#1e293b';

    banner.innerHTML = `
        <div style="position:fixed; top:0; right:20px; z-index:999999; background:${bgColor}; color:${color}; padding:6px 14px; font-size:11px; font-weight:bold; border-radius:0 0 10px 10px; border:1px solid #334155; border-top:0; font-family:sans-serif; display:flex; align-items:center; gap:10px; box-shadow:0 4px 12px rgba(0,0,0,0.2); transition: all 0.3s ease;">
            <div style="width:10px; height:10px; background:${color}; border-radius:50%; box-shadow: 0 0 8px ${color}; animation:pulse 2s infinite"></div>
            <div style="display:flex; flex-direction:column; line-height:1.2">
                <span>SLT-ERP BRIDGE: ${status}</span>
                ${errorMessage ? `<span style="font-size:9px; color:#94a3b8; font-weight:normal">${errorMessage}</span>` : '<span style="font-size:9px; color:#94a3b8; font-weight:normal">Diagnostic Mode Enabled</span>'}
            </div>
        </div>
        <style>
            @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
        </style>
    `;
    document.body.appendChild(banner);
}

function scrapeDetailedData() {
    try {
        const data = {
            url: window.location.href,
            host: window.location.host,
            timestamp: new Date().toISOString(),
            title: document.title,
        };

        const bodyText = document.body.innerText;
        const soPatterns = [/SO\/\d+/, /SOD\/\d+/, /\b\d{10}\b/];
        let foundItems = 0;

        for (const pattern of soPatterns) {
            const match = bodyText.match(pattern);
            if (match) {
                data.soNum = match[0];
                foundItems++;
                break;
            }
        }

        const tables = document.getElementsByTagName('table');
        for (let table of tables) {
            const rows = table.rows;
            for (let row of rows) {
                const rowText = row.innerText.toUpperCase();
                if (rowText.includes('SERVICE TYPE')) { data.serviceType = row.cells[1]?.innerText; foundItems++; }
                if (rowText.includes('CUSTOMER NAME')) { data.customerName = row.cells[1]?.innerText; foundItems++; }
                if (rowText.includes('STATUS')) { data.status = row.cells[1]?.innerText; foundItems++; }
            }
        }

        updateDiagnostics({
            status: 'ACTIVE',
            lastScrapeTime: new Date().toLocaleTimeString(),
            elementsFound: foundItems,
            lastError: null
        });

        injectStatusIcon('CONNECTED', foundItems > 0 ? `${foundItems} fields found` : 'Waiting for Data');
        return data;

    } catch (e) {
        console.error("❌ Bridge Scrape Error:", e);
        updateDiagnostics({ status: 'ERROR', lastError: e.message });
        injectStatusIcon('ERROR', e.message);
        return null;
    }
}

// Initial Run
setTimeout(() => {
    scrapeDetailedData();
}, 2000);

// Observer for content changes
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        scrapeDetailedData();
    }
}).observe(document, { subtree: true, childList: true });

// Communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPortalData") {
        sendResponse(scrapeDetailedData());
    }
    if (request.action === "getDiagnostics") {
        sendResponse(diag);
    }
});
