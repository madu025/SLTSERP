// Comprehensive Scraper for SLT i-Shamp Portal v1.0.9
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
        details: {}
    };

    const clean = (txt) => txt ? txt.replace(/\s+/g, ' ').trim() : '';

    // 1. Parse URL Parameters (Useful for sod_details pages)
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('sod')) {
            const rawSod = urlParams.get('sod');
            const parts = rawSod.split('_');
            data.details['URL SOD ID'] = parts[0];
            data.details['URL STATUS'] = parts[1];
            data.soNum = parts[0];
        }
    } catch (e) { }

    // 2. SO Number Detection from text
    const bodyText = document.body.innerText;
    const soMatch = bodyText.match(/[A-Z]{3}20\d{11}|SO\/\d+|SOD\/\d+/);
    if (soMatch && !data.soNum) data.soNum = soMatch[0];

    // 3. Robust Table Scraper
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        const rows = Array.from(table.querySelectorAll('tr'));

        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td, th'));

            // Pattern A: Key | Value (Common in details pages)
            if (cells.length === 2) {
                const label = clean(cells[0].innerText).toUpperCase().replace(/:$/, '');
                const value = clean(cells[1].innerText);
                if (label && value && label.length < 50 && label.length > 1) {
                    data.details[label] = value;
                }
            }

            // Pattern B: Key | Value | Key | Value (Multi-column details)
            if (cells.length === 4) {
                for (let i = 0; i < 4; i += 2) {
                    const label = clean(cells[i].innerText).toUpperCase().replace(/:$/, '');
                    const value = clean(cells[i + 1]?.innerText);
                    if (label && value && label.length < 50 && label.length > 1) {
                        data.details[label] = value;
                    }
                }
            }
        });

        // Pattern C: Header Row then Data Row
        const headers = Array.from(table.querySelectorAll('th')).map(h => clean(h.innerText).toUpperCase());
        if (headers.length > 0) {
            const dataRows = Array.from(table.querySelectorAll('tbody tr, tr:not(:first-child)'));
            // If it's a details page, we likely only care about the specific record shown
            if (dataRows.length > 0) {
                const firstRowCells = Array.from(dataRows[0].querySelectorAll('td'));
                headers.forEach((h, i) => {
                    if (firstRowCells[i] && h && h.length < 50) {
                        data.details[h] = clean(firstRowCells[i].innerText);
                    }
                });
            }
        }
    });

    // 4. Label-Value Pair detection from Spans/Divs (for non-table layouts)
    const allDivs = document.querySelectorAll('div, span, p, b, label');
    allDivs.forEach(el => {
        const text = clean(el.innerText).toUpperCase();
        // Common labels we expect in SOD Details
        const knownLabels = [
            'CUSTOMER NAME', 'SERVICE ADDRESS', 'CONTACT NUMBER', 'CONTACT PERSON',
            'ORDER TYPE', 'SERVICE TYPE', 'PACKAGE', 'LEA', 'RTOM', 'OPMC', 'EXCHANGE',
            'DP NAME', 'DP DETAILS', 'PORT NO', 'STATUS', 'RECEIVED DATE', 'REQUIRED DATE'
        ];

        if (knownLabels.some(l => text === l || text === l + ':')) {
            let value = '';
            // Try next sibling
            let sib = el.nextSibling;
            if (sib && sib.textContent && clean(sib.textContent)) {
                value = clean(sib.textContent);
            } else if (el.nextElementSibling) {
                value = clean(el.nextElementSibling.innerText);
            }

            if (value && value.length < 200) {
                const cleanLabel = text.replace(/:$/, '');
                if (!data.details[cleanLabel]) data.details[cleanLabel] = value;
            }
        }
    });

    // Mapping key fields
    if (data.details['CUSTOMER NAME']) data.customerName = data.details['CUSTOMER NAME'];
    if (data.details['STATUS']) data.status = data.details['STATUS'];
    if (data.details['SERVICE TYPE']) data.serviceType = data.details['SERVICE TYPE'];
    if (data.details['LEA']) data.lea = data.details['LEA'];

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
    banner.innerHTML = `<div style="position:fixed;top:0;right:20px;z-index:999999;background:#1e293b;color:#22c55e;padding:4px 10px;font-size:10px;font-weight:bold;border-radius:0 0 5px 5px;box-shadow:0 2px 5px rgba(0,0,0,0.2)">BRIDGE v1.0.9 ACTIVE</div>`;
    document.body.appendChild(banner);
}

// Manual trigger
scrape();
// Observe changes for dynamic content
const observer = new MutationObserver(() => scrape());
observer.observe(document.body, { childList: true, subtree: true });
