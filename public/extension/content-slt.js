// Comprehensive Scraper for SLT i-Shamp Portal v1.1.2
// "High Accuracy" Edition

function updateLocalDiagnostics(foundItems, context) {
    chrome.storage.local.set({
        diagnostics_slt: {
            status: 'ACTIVE',
            lastScrapeTime: new Date().toLocaleTimeString(),
            elementsFound: foundItems,
            context: context,
            url: window.location.href
        }
    });
}

let lastPushedHash = "";

function scrape() {
    const data = {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        details: {},
        teamDetails: {},
        materialDetails: [],
        hiddenInfo: {},
        currentUser: ''
    };

    const clean = (txt) => txt ? txt.replace(/\s+/g, ' ').trim() : '';
    const getVal = (id) => {
        const el = document.getElementById(id);
        if (!el) return '';
        if (el.tagName === 'SELECT') return el.options[el.selectedIndex]?.text || '';
        return el.value || '';
    };

    // 1. Identify Logged-in User
    const userEl = document.querySelector('.user-profile-dropdown h6');
    if (userEl) data.currentUser = clean(userEl.innerText).replace('Welcome, ', '');

    // 2. Capture Hidden System Values (For high accuracy service tracking)
    const hiddenIds = ['iptv1', 'iptv2', 'iptv3', 'bb', 'voice2', 'sval'];
    hiddenIds.forEach(id => {
        const val = getVal(id);
        if (val) data.hiddenInfo[id.toUpperCase()] = val;
    });

    // 3. Determine Active Tab (Context)
    let activeContext = 'GENERAL';
    const activeTab = document.querySelector('.nav-tabs .nav-link.active');
    if (activeTab) activeContext = clean(activeTab.innerText);
    data.activeTab = activeContext;

    // 4. Core Info Scraper (Label and Next Value)
    const labels = document.querySelectorAll('label');
    labels.forEach(l => {
        const text = clean(l.innerText).toUpperCase();
        if (l.style.color === 'rgb(13, 202, 240)' || l.style.color === '#0dcaf0') {
            const valNode = l.nextElementSibling?.nextElementSibling;
            if (valNode && valNode.tagName === 'LABEL') {
                data.details[text] = clean(valNode.innerText);
            }
        }
    });

    // 5. Team & User Assignment (From #sn tab)
    const selectedTeam = getVal('mobusr');
    if (selectedTeam && !selectedTeam.includes('-- Select Team --')) {
        data.teamDetails['SELECTED TEAM'] = selectedTeam;
    }

    // 6. Detailed Material Scraping (From #met tab)
    // Dropwire
    const dw = getVal('dwvalue');
    if (dw) data.materialDetails.push({ ITEM: 'DROPWIRE', VALUE: dw, TYPE: getVal('dw') });

    // Poles
    const pole = getVal('pole');
    if (pole && pole !== 'SELECT POLE ...') {
        data.materialDetails.push({
            ITEM: 'POLE',
            TYPE: pole,
            QTY: getVal('qty'),
            SERIAL: getVal('snvalue')
        });
    }

    // Others
    const oth = getVal('oth');
    if (oth && oth !== 'SELECT MATERIAL ...') {
        data.materialDetails.push({ ITEM: 'OTHER', TYPE: oth, VALUE: getVal('othvalue') });
    }

    // Capture SO Number
    data.soNum = data.details['SERVICE ORDER'] || data.details['SOD'] || data.hiddenInfo['BB'] || '';
    if (!data.soNum) {
        const urlParams = new URLSearchParams(window.location.search);
        data.soNum = urlParams.get('sod')?.split('_')[0] || '';
    }

    const foundCount = Object.keys(data.details).length + data.materialDetails.length;
    updateLocalDiagnostics(foundCount, activeContext);
    chrome.storage.local.set({ lastScraped: data });

    // Push to ERP for testing (only if soNum is present to avoid noise)
    if (data.soNum) {
        pushToERP(data);
    }

    return data;
}

async function pushToERP(data) {
    try {
        // 1. Check if data actually changed to avoid flooding server
        const currentHash = JSON.stringify({
            details: data.details,
            team: data.teamDetails,
            materials: data.materialDetails,
            tab: data.activeTab
        });

        if (currentHash === lastPushedHash) return;

        // 2. Identify ERP Target (Local Test vs Production)
        // Since content script runs on SLT portal, we try to detect if we're in "Test Mode"
        // For now, we'll try to push to BOTH if on a dev machine, or just production.
        const targets = [
            'https://d2ixqikwtprwf0.cloudfront.net',
            'http://localhost:3000'
        ];

        for (const target of targets) {
            try {
                const apiUrl = `${target}/api/test/extension-push`;
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    console.log(`✅ [SLT-BRIDGE] Synced to: ${target}`);
                    lastPushedHash = currentHash;
                    break; // stop after first successful push
                }
            } catch (e) {
                // Silently skip if one target is offline
            }
        }
    } catch (err) {
        console.warn('❌ [SLT-BRIDGE] Push error:', err);
    }
}

// Message Listener
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
    banner.innerHTML = `<div style="position:fixed;top:0;right:20px;z-index:999999;background:#1e293b;color:#22c55e;padding:4px 10px;font-size:10px;font-weight:bold;border-radius:0 0 5px 5px;box-shadow:0 2px 5px rgba(0,0,0,0.2)">BRIDGE v1.1.2 ACTIVE</div>`;
    document.body.appendChild(banner);
}

// Debounced observation
let timeout;
const observer = new MutationObserver(() => {
    clearTimeout(timeout);
    timeout = setTimeout(scrape, 1000);
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true });

scrape();
