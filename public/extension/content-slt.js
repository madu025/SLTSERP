// Comprehensive Scraper for SLT i-Shamp Portal v1.1.1
// Optimized using actual i-Shamp HTML structure

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
        timestamp: new Date().toISOString(),
        details: {},
        teamDetails: {},
        materialDetails: []
    };

    const clean = (txt) => txt ? txt.replace(/\s+/g, ' ').trim() : '';
    const getVal = (id) => {
        const el = document.getElementById(id);
        if (!el) return '';
        if (el.tagName === 'SELECT') return el.options[el.selectedIndex]?.text || '';
        return el.value || '';
    };

    // 1. Core SOD Info (from labels)
    const labels = document.querySelectorAll('label');
    labels.forEach(l => {
        const text = clean(l.innerText).toUpperCase();
        // i-Shamp specific colored labels
        if (l.style.color === 'rgb(13, 202, 240)' || l.style.color === '#0dcaf0') {
            const valNode = l.nextElementSibling?.nextElementSibling; // Skip <br/>
            if (valNode && valNode.tagName === 'LABEL') {
                data.details[text] = clean(valNode.innerText);
            }
        }
    });

    // 2. Team Assignment Data (Specific IDs)
    const selectedTeam = getVal('mobusr');
    if (selectedTeam && !selectedTeam.includes('-- Select Team --')) {
        data.teamDetails['ASSIGNED TEAM'] = selectedTeam;
    }

    // 3. Serial Number Grid (from SERIAL NUMBER DETAILS section)
    const serialSection = document.querySelector('#sn .card-body');
    if (serialSection) {
        const rows = serialSection.querySelectorAll('.row');
        rows.forEach(row => {
            const divs = row.querySelectorAll('div');
            if (divs.length >= 2) {
                const attr = clean(divs[0].innerText).toUpperCase();
                const val = clean(divs[1].innerText);
                if (attr && val && attr !== 'ATTRIBUTE NAME') {
                    data.teamDetails[attr] = val;
                }
            }
        });
    }

    // 4. Material Details (Specific IDs)

    // A. Drop Wire
    const dwVal = getVal('dwvalue');
    if (dwVal) {
        data.materialDetails.push({
            'ITEM': 'FTTH-DW (Drop Wire)',
            'VALUE': dwVal
        });
    }

    // B. Poles
    const poleType = getVal('pole');
    const poleQty = getVal('qty');
    const poleSN = getVal('snvalue');
    if (poleType && poleType !== 'SELECT POLE ...') {
        data.materialDetails.push({
            'ITEM': 'POLE: ' + poleType,
            'QUANTITY': poleQty,
            'SERIAL': poleSN
        });
    }

    // C. Other Materials
    const othMat = getVal('oth');
    const othVal = getVal('othvalue');
    if (othMat && othMat !== 'SELECT MATERIAL ...') {
        data.materialDetails.push({
            'ITEM': othMat,
            'VALUE': othVal
        });
    }

    // 5. Secondary Service Details (i-Shamp rows)
    const secondaryRows = document.querySelectorAll('#sod_details .row');
    secondaryRows.forEach(row => {
        const divs = row.querySelectorAll('div');
        if (divs.length === 6) { // Services SOD Details header pattern
            // Skip headers, process rows
        }
    });

    // Capture SO Number for display
    data.soNum = data.details['SERVICE ORDER'] || data.details['SOD'] || '';
    if (!data.soNum) {
        const urlParams = new URLSearchParams(window.location.search);
        data.soNum = urlParams.get('sod')?.split('_')[0] || '';
    }

    const foundCount = Object.keys(data.details).length + Object.keys(data.teamDetails).length + data.materialDetails.length;
    updateLocalDiagnostics(foundCount);
    chrome.storage.local.set({ lastScraped: data });
    return data;
}

// Communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPortalData") {
        sendResponse(scrape());
    }
    return true;
});

// Visual Indicator
if (!document.getElementById('slt-erp-indicator')) {
    const banner = document.createElement('div');
    banner.id = 'slt-erp-indicator';
    banner.innerHTML = `<div style="position:fixed;top:0;right:20px;z-index:999999;background:#1e293b;color:#22c55e;padding:4px 10px;font-size:10px;font-weight:bold;border-radius:0 0 5px 5px;box-shadow:0 2px 5px rgba(0,0,0,0.2)">BRIDGE v1.1.1 ACTIVE</div>`;
    document.body.appendChild(banner);
}

// Scrape on Interaction
document.addEventListener('change', scrape);
document.addEventListener('click', () => setTimeout(scrape, 500));

scrape();
const observer = new MutationObserver(() => scrape());
observer.observe(document.body, { childList: true, subtree: true });
