// Comprehensive Scraper for SLT i-Shamp Portal
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
        timestamp: new Date().toISOString()
    };

    const bodyText = document.body.innerText;
    // Enhanced SO/SOD pattern including standard SLT formats
    const soMatch = bodyText.match(/[A-Z]{3}20\d{11}|SO\/\d+|SOD\/\d+/);
    if (soMatch) data.soNum = soMatch[0];

    // Look specifically for i-Shamp data tables
    const tableCells = document.querySelectorAll('td');
    tableCells.forEach((cell, index) => {
        const text = cell.innerText.toUpperCase().trim();
        if (text === 'CUSTOMER NAME') data.customerName = tableCells[index + 1]?.innerText;
        if (text === 'STATUS') data.status = tableCells[index + 1]?.innerText;
        if (text === 'SERVICE TYPE') data.serviceType = tableCells[index + 1]?.innerText;
    });

    const foundCount = (data.soNum ? 1 : 0) + (data.customerName ? 1 : 0) + (data.status ? 1 : 0);
    updateLocalDiagnostics(foundCount);
    chrome.storage.local.set({ lastScraped: data });
    return data;
}

// Visual indicator
const banner = document.createElement('div');
banner.innerHTML = `<div style="position:fixed;top:0;right:20px;z-index:99999;background:#1e293b;color:#22c55e;padding:4px 10px;font-size:10px;font-weight:bold;border-radius:0 0 5px 5px;box-shadow:0 2px 5px rgba(0,0,0,0.2)">BRIDGE ACTIVE</div>`;
document.body.appendChild(banner);

scrape();
setInterval(scrape, 5000); // Periodic refresh
