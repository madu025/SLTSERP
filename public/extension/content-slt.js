// Comprehensive Scraper for SLT i-Shamp Portal v1.1.0
// Focused on TEAM ASSIGN, SERIAL NUMBERS, and MATERIAL DETAILS

function updateLocalDiagnostics(foundItems) {
    chrome.storage.local.set({
        diagnostics_slt: {
            status: 'ACTIVE',
            lastScrapeTime: new Date().toLocaleTimeString(),
            elementsFound: foundItems,
            url: window.location.href
        }
    });
}

function scrape() {
    const data = {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        details: {},
        teamDetails: {},
        materialDetails: []
    };

    const clean = (txt) => txt ? txt.replace(/\s+/g, ' ').trim() : '';

    // 1. Basic SOD Info
    const bodyText = document.body.innerText;
    const soMatch = bodyText.match(/[A-Z]{3}20\d{11}|SO\/\d+|SOD\/\d+/);
    if (soMatch) data.soNum = soMatch[0];

    // 2. Scrape Inputs and Selects (Crucial for Material/Team entry)
    const allInputs = document.querySelectorAll('input, select, textarea');
    allInputs.forEach(input => {
        // Try to find a label for this input
        let label = '';
        if (input.id) {
            const labelEl = document.querySelector(`label[for="${input.id}"]`);
            if (labelEl) label = clean(labelEl.innerText);
        }

        // Fallback: look at nearby text or placeholder
        if (!label) label = input.placeholder || '';
        if (!label) {
            // Check preceding text
            let prev = input.previousSibling;
            if (prev && prev.textContent) label = clean(prev.textContent);
        }

        if (label && label.length < 50) {
            const val = input.tagName === 'SELECT' ? input.options[input.selectedIndex]?.text : input.value;
            if (val) data.details[label.toUpperCase()] = val;
        }
    });

    // 3. Specialized Table Scraper (Horizontal) - Common for Materials
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        const headers = Array.from(table.querySelectorAll('th, td.header, .grid-header')).map(h => clean(h.innerText).toUpperCase());
        const rows = Array.from(table.querySelectorAll('tr:not(:first-child)'));

        // Detect if this is a Material Table
        const isMaterial = headers.some(h => h.includes('MATERIAL') || h.includes('ITEM'));
        const isTeam = headers.some(h => h.includes('TEAM') || h.includes('SERIAL'));

        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length > 0 && cells.length === headers.length) {
                const rowData = {};
                headers.forEach((h, i) => {
                    const cell = cells[i];
                    // Check for inputs inside cells
                    const input = cell.querySelector('input, select');
                    const val = input ? (input.tagName === 'SELECT' ? input.options[input.selectedIndex]?.text : input.value) : clean(cell.innerText);
                    if (h && val) rowData[h] = val;
                });

                if (isMaterial) data.materialDetails.push(rowData);
                else if (isTeam) Object.assign(data.teamDetails, rowData);
                else if (rowData['LABEL'] && rowData['VALUE']) data.details[rowData['LABEL'].toUpperCase()] = rowData['VALUE'];
            }
        });
    });

    // 4. Manual search for Serial Numbers (often in divs/spans)
    const serialPatterns = ['ONT SERIAL', 'STB SERIAL', 'TEAM ID', 'TEAM NAME', 'STB 1', 'STB 2'];
    document.querySelectorAll('div, span, b').forEach(el => {
        const text = clean(el.innerText).toUpperCase();
        serialPatterns.forEach(p => {
            if (text.includes(p)) {
                let valNode = el.nextElementSibling || el.parentElement?.nextElementSibling;
                if (valNode) {
                    const val = clean(valNode.innerText);
                    if (val) data.teamDetails[p] = val;
                }
            }
        });
    });

    const foundCount = Object.keys(data.details).length + data.materialDetails.length + Object.keys(data.teamDetails).length;
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
    banner.innerHTML = `<div style="position:fixed;top:0;right:20px;z-index:999999;background:#1e293b;color:#22c55e;padding:4px 10px;font-size:10px;font-weight:bold;border-radius:0 0 5px 5px;box-shadow:0 2px 5px rgba(0,0,0,0.2)">BRIDGE v1.1.0 ACTIVE</div>`;
    document.body.appendChild(banner);
}

// Re-scrape on any click (detecting tab switches)
document.addEventListener('click', () => {
    setTimeout(scrape, 1000); // Wait for DOM to update
});

scrape();
const observer = new MutationObserver(() => scrape());
observer.observe(document.body, { childList: true, subtree: true });
