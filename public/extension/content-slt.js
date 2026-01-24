// Comprehensive Scraper for SLT i-Shamp Portal v1.0.8
function updateLocalDiagnostics(foundItems) {
    chrome.storage.local.set({
        diagnostics_slt: {
            status: 'ACTIVE',
            lastScrapeTime: new Date().toLocaleTimeString(),
            elementsFound: foundItems,
            url: window.location.href,
            title: document.title
        }
    });
}

function scrape() {
    const data = {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        details: {} // Dynamic key-value pairs
    };

    // 1. Helper to clean text
    const clean = (txt) => txt ? txt.replace(/\s+/g, ' ').trim() : '';

    // 2. Try to find the Service Order Number first (Top Priority)
    const bodyText = document.body.innerText;
    const soMatch = bodyText.match(/[A-Z]{3}20\d{11}|SO\/\d+|SOD\/\d+/);
    if (soMatch) data.soNum = soMatch[0];

    // 3. Look for Tables (Standard for i-Shamp)
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        // If it's a Vertical Table (Label | Value)
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 2) {
                const label = clean(cells[0].innerText).toUpperCase().replace(/:$/, '');
                const value = clean(cells[1].innerText);
                if (label && value && label.length < 30) {
                    data.details[label] = value;
                }
            }
        });

        // If it's a Horizontal Table (Headers top, values below) - usually for lists
        // We only take the first data row if present
        const headers = Array.from(table.querySelectorAll('th')).map(h => clean(h.innerText).toUpperCase());
        if (headers.length > 0) {
            const firstDataRow = table.querySelector('tbody tr');
            if (firstDataRow) {
                const cells = firstDataRow.querySelectorAll('td');
                headers.forEach((h, i) => {
                    if (cells[i] && h) {
                        data.details[h] = clean(cells[i].innerText);
                    }
                });
            }
        }
    });

    // 4. Fallback search for specific labels in spans/divs if not in tables
    const commonLabels = ['CUSTOMER NAME', 'STATUS', 'CIRCUIT', 'PACKAGE', 'SERVICE', 'TASK', 'ORDER TYPE', 'LEA'];
    const allElements = document.querySelectorAll('span, div, label');
    allElements.forEach(el => {
        const text = clean(el.innerText).toUpperCase();
        if (commonLabels.includes(text)) {
            // Check following sibling or parent's next sibling
            let valNode = el.nextElementSibling;
            if (!valNode || !valNode.innerText) {
                valNode = el.parentElement?.nextElementSibling;
            }
            if (valNode && valNode.innerText) {
                data.details[text] = clean(valNode.innerText);
            }
        }
    });

    // Mapping key fields for backward compatibility with UI
    if (data.details['CUSTOMER NAME']) data.customerName = data.details['CUSTOMER NAME'];
    if (data.details['STATUS']) data.status = data.details['STATUS'];
    if (data.details['SOD'] && !data.soNum) data.soNum = data.details['SOD'];
    if (data.details['SERVICE']) data.serviceType = data.details['SERVICE'];

    const foundCount = Object.keys(data.details).length;
    updateLocalDiagnostics(foundCount);
    chrome.storage.local.set({ lastScraped: data });
    return data;
}

// Global Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPortalData") {
        sendResponse(scrape());
    }
    return true;
});

// Visual indicator
if (!document.getElementById('slt-erp-indicator')) {
    const banner = document.createElement('div');
    banner.id = 'slt-erp-indicator';
    banner.innerHTML = `<div style="position:fixed;top:0;right:20px;z-index:999999;background:#1e293b;color:#22c55e;padding:4px 10px;font-size:10px;font-weight:bold;border-radius:0 0 5px 5px;box-shadow:0 2px 5px rgba(0,0,0,0.2)">BRIDGE v1.0.8 ACTIVE</div>`;
    document.body.appendChild(banner);
}

// Manual trigger
scrape();
setInterval(scrape, 5000);
