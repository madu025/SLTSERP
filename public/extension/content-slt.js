// Comprehensive Scraper for SLT i-Shamp Portal v1.3.3
console.log('🚀 [SLT-BRIDGE] Content script injected and starting...');
const CURRENT_VERSION = '1.3.3';

function updateLocalDiagnostics(foundItems, context) {
    if (!chrome.runtime?.id) return;
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

    const userEl = document.querySelector('.user-profile-dropdown h6');
    if (userEl) data.currentUser = clean(userEl.innerText).replace('Welcome, ', '');

    const hiddenIds = ['iptv1', 'iptv2', 'iptv3', 'bb', 'voice2', 'sval'];
    hiddenIds.forEach(id => {
        const val = getVal(id);
        if (val) data.hiddenInfo[id.toUpperCase()] = val;
    });

    let activeContext = 'GENERAL';
    const activeTab = document.querySelector('.nav-tabs .nav-link.active');
    if (activeTab) activeContext = clean(activeTab.innerText);
    data.activeTab = activeContext;

    // Fast Scraper for details
    document.querySelectorAll('label, b, strong, span').forEach(l => {
        const style = window.getComputedStyle(l);
        const color = style.color;
        if (color === 'rgb(13, 202, 240)' || color === 'rgb(0, 202, 240)' || color.includes('0dcaf0')) {
            const key = clean(l.innerText).toUpperCase();
            if (!key || key.length > 50 || key.includes('VOICE TEST') || key === 'LATEST') return;
            if (data.details[key]) return;

            // Simple Sibling/Grid lookup
            let val = '';
            let next = l.nextElementSibling || l.nextSibling;
            while (next && next.nodeType === 3 && !next.textContent.trim()) next = next.nextSibling;
            if (next && next.textContent && clean(next.textContent) !== key) val = clean(next.textContent);

            if (!val) {
                const col = l.closest('[class*="col-"]');
                const row = col?.parentElement;
                if (row && col && row.classList.contains('row')) {
                    const colIdx = Array.from(row.children).indexOf(col);
                    const nextRow = row.nextElementSibling;
                    if (nextRow && nextRow.classList.contains('row')) {
                        const target = nextRow.children[colIdx];
                        if (target) val = clean(target.innerText);
                    }
                }
            }
            if (val && val !== key) data.details[key] = val;
        }
    });

    const selectedTeam = getVal('mobusr');
    if (selectedTeam && !selectedTeam.includes('-- Select Team --')) data.teamDetails['SELECTED TEAM'] = selectedTeam;

    const dw = getVal('dwvalue');
    if (dw) data.materialDetails.push({ ITEM: 'DROPWIRE', VALUE: dw, TYPE: getVal('dw') });

    // SO EXTRACTION - UNIVERSAL METHOD
    const url = window.location.href;
    const sodRegex = /[?&]sod=([A-Z0-9]+)/i;
    const match = url.match(sodRegex);
    if (match && match[1]) {
        data.soNum = match[1].toUpperCase();
        console.log('✅ [SLT-BRIDGE] SO Extracted from URL:', data.soNum);
    } else {
        const params = new URLSearchParams(window.location.search);
        data.soNum = (params.get('sod') || '').split('_')[0].toUpperCase();
    }

    if (!data.soNum) {
        data.soNum = data.details['SERVICE ORDER'] || data.details['SOD'] || '';
    }

    // Identify Service Type for Monitoring
    const serviceType = (data.details['SERVICE TYPE'] || data.details['TYPE'] || '').toUpperCase();
    const pkg = (data.details['PACKAGE'] || '').toUpperCase();
    data.isBroadband = serviceType.includes('BROADBAND') || serviceType.includes('BB-INTERNET') || pkg.includes('BROADBAND') || pkg.includes('BB');

    // CRITICAL: SAVE TO LOCAL STORAGE BEFORE RESTRICTING
    if (chrome.runtime?.id) {
        chrome.storage.local.set({ lastScraped: data });
    }

    const foundCount = Object.keys(data.details).length + data.materialDetails.length;
    updateLocalDiagnostics(foundCount, activeContext);

    // Sync Restriction
    if (data.soNum) {
        if (data.isBroadband) {
            updateIndicator('RESTRICTED (BB)', '#f59e0b');
            return data;
        }
        if (data.activeTab === 'IMAGES') {
            updateIndicator('ACTIVE (SKIP TAB)', '#94a3b8');
            return data;
        }
        pushToERP(data);
    }

    return data;
}

async function pushToERP(data) {
    const currentHash = JSON.stringify({ details: data.details, materials: data.materialDetails });
    if (currentHash === lastPushedHash) return;
    if (!chrome.runtime?.id) return;
    chrome.runtime.sendMessage({ action: 'pushToERP', data }, (response) => {
        if (chrome.runtime.lastError) { updateIndicator('BRIDGE ERROR', '#ef4444'); return; }
        if (response && response.success) {
            lastPushedHash = currentHash;
            updateIndicator('SYNC OK', '#22c55e');
        } else {
            updateIndicator('SYNC ERROR', '#ef4444');
        }
    });
}

function updateIndicator(status, color) {
    const tag = document.getElementById('slt-erp-status-tag');
    const dot = document.getElementById('slt-erp-status-dot');
    if (tag && dot) {
        tag.textContent = status;
        dot.style.background = color;
        if (status === 'SYNC OK') {
            setTimeout(() => { if (tag.textContent === 'SYNC OK') tag.textContent = 'SLT BRIDGE v' + CURRENT_VERSION; }, 3000);
        }
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPortalData") sendResponse(scrape());
    return true;
});

if (!document.getElementById('slt-erp-indicator')) {
    const b = document.createElement('div'); b.id = 'slt-erp-indicator';
    b.style.cssText = `position: fixed; top: 10px; right: 20px; z-index: 999999; background: #0f172a; color: #fff; padding: 6px 12px; font-size: 11px; border-radius: 8px; display: flex; align-items: center; gap: 8px; pointer-events: none;`;
    b.innerHTML = `<div style="width:8px; height:8px; border-radius:50%; background:#22c55e;" id="slt-erp-status-dot"></div><span id="slt-erp-status-tag">SLT BRIDGE v${CURRENT_VERSION}</span>`;
    document.body.appendChild(b);
}

setInterval(scrape, 2000);
