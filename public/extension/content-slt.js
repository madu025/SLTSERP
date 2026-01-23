// Comprehensive Scraper for SLT Portal
console.log("🚀 SLT Bridge Content Script Loaded");

function injectStatusIcon() {
    if (document.getElementById('slt-erp-status-bar')) return;

    const banner = document.createElement('div');
    banner.id = 'slt-erp-status-bar';
    banner.innerHTML = `
        <div style="position:fixed; top:0; right:20px; z-index:999999; background:#1e293b; color:#22c55e; padding:4px 12px; font-size:11px; font-weight:bold; border-radius:0 0 8px 8px; border:1px solid #334155; border-top:0; font-family:sans-serif; display:flex; align-items:center; gap:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1)">
            <div style="width:8px; height:8px; background:#22c55e; border-radius:50%; animation:pulse 2s infinite"></div>
            SLT-ERP BRIDGE ACTIVE
        </div>
        <style>
            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        </style>
    `;
    document.body.appendChild(banner);
}

function scrapeDetailedData() {
    const data = {
        url: window.location.href,
        host: window.location.host,
        timestamp: new Date().toISOString(),
        title: document.title,
    };

    // 1. Try to find SO Number
    const bodyText = document.body.innerText;
    const soPatterns = [/SO\/\d+/, /SOD\/\d+/, /\b\d{10}\b/]; // 10 digit patterns often used for SO

    for (const pattern of soPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
            data.soNum = match[0];
            break;
        }
    }

    // 2. Look for table data (iShamp often uses tables)
    const tables = document.getElementsByTagName('table');
    for (let table of tables) {
        const rows = table.rows;
        for (let row of rows) {
            const rowText = row.innerText.toUpperCase();
            if (rowText.includes('SERVICE TYPE')) data.serviceType = row.cells[1]?.innerText;
            if (rowText.includes('CUSTOMER NAME')) data.customerName = row.cells[1]?.innerText;
            if (rowText.includes('STATUS')) data.status = row.cells[1]?.innerText;
        }
    }

    return data;
}

// Initial Run
setTimeout(() => {
    injectStatusIcon();
    const result = scrapeDetailedData();
    chrome.storage.local.set({ lastScraped: result });
}, 2000);

// Watch for changes (SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        const result = scrapeDetailedData();
        chrome.storage.local.set({ lastScraped: result });
    }
}).observe(document, { subtree: true, childList: true });

// Communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPortalData") {
        sendResponse(scrapeDetailedData());
    }
});
