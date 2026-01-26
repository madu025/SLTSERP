// Comprehensive Scraper for SLT i-Shamp Portal v1.3.4
console.log('🚀 [SLT-BRIDGE] Content script injected and starting...');
const CURRENT_VERSION = '1.3.4';

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

    // 4. Universal Info Scraper
    document.querySelectorAll('label, b, strong, span').forEach(l => {
        const style = window.getComputedStyle(l);
        const color = style.color;
        if (color === 'rgb(13, 202, 240)' || color === 'rgb(0, 202, 240)' || color.includes('0dcaf0')) {
            const key = clean(l.innerText).toUpperCase();
            if (!key || key.length > 50 || key.includes('VOICE TEST') || key === 'LATEST') return;
            if (data.details[key]) return;

            let val = '';
            let next = l.nextElementSibling || l.nextSibling;

            // Fix: Check if next is a container or select to avoid bulk text
            if (next && (next.tagName === 'SELECT' || next.querySelector?.('select'))) {
                const sel = next.tagName === 'SELECT' ? next : next.querySelector('select');
                val = clean(sel.options[sel.selectedIndex]?.text || '');
            } else {
                while (next && next.nodeType === 3 && !next.textContent.trim()) next = next.nextSibling;
                if (next && next.textContent && clean(next.textContent) !== key) {
                    // Prevent grabbing entire select option text
                    if (next.textContent.length < 300) val = clean(next.textContent);
                }
            }

            if (!val) {
                const col = l.closest('[class*="col-"]');
                const row = col?.parentElement;
                if (row && col && row.classList.contains('row')) {
                    const colIdx = Array.from(row.children).indexOf(col);
                    const nextRow = row.nextElementSibling;
                    if (nextRow && nextRow.classList.contains('row')) {
                        const target = nextRow.children[colIdx];
                        if (target) {
                            if (target.querySelector('select')) {
                                const s = target.querySelector('select');
                                val = clean(s.options[s.selectedIndex]?.text || '');
                            } else {
                                const tText = clean(target.innerText);
                                if (tText.length < 300) val = tText;
                            }
                        }
                    }
                }
            }
            if (val && val !== key && !val.includes('SELECT MATERIAL')) data.details[key] = val;
        }
    });

    // 5. Team & Manual Materials
    const selectedTeam = getVal('mobusr');
    if (selectedTeam && !selectedTeam.includes('-- Select Team --')) data.teamDetails['SELECTED TEAM'] = selectedTeam;

    // Dropwire
    const dwNum = getVal('dwvalue');
    if (dwNum) data.materialDetails.push({ ITEM: 'DROPWIRE', VALUE: dwNum, TYPE: getVal('dw') });

    // 6. Added Materials / Unit Designator Table Scraper (ULTRA ROBUST)
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        const rows = Array.from(table.querySelectorAll('tr'));
        rows.forEach((row, i) => {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length >= 2) {
                const text = clean(row.innerText).toUpperCase();
                // Check if this row looks like a material entry (PLC-CON, FT-DP, etc.)
                if (/PLC-CON|FAC-1|FWS-1|DW-LH|FT-|CABLE|OSPACC|WIRE|UNIT/i.test(text)) {
                    const item = clean(cells[0].innerText);
                    const qty = clean(cells[1].innerText);
                    if (item && qty && !item.includes('SELECT MATERIAL') && item.length < 100) {
                        // Check for duplicates
                        const exists = data.materialDetails.find(m => m.TYPE === item);
                        if (!exists) data.materialDetails.push({ ITEM: 'MATERIAL', TYPE: item, QTY: qty });
                    }
                }
            }
        });
    });

    // 7. SO EXTRACTION
    const url = window.location.href;
    const sodRegex = /[?&]sod=([A-Z0-9]+)/i;
    const match = url.match(sodRegex);
    if (match && match[1]) {
        data.soNum = match[1].toUpperCase();
    } else {
        const params = new URLSearchParams(window.location.search);
        data.soNum = (params.get('sod') || '').split('_')[0].toUpperCase();
    }
    if (!data.soNum) data.soNum = data.details['SERVICE ORDER'] || data.details['SOD'] || '';

    // Broadband Restriction
    const serviceType = (data.details['SERVICE TYPE'] || data.details['TYPE'] || '').toUpperCase();
    const pkg = (data.details['PACKAGE'] || '').toUpperCase();
    data.isBroadband = serviceType.includes('BROADBAND') || serviceType.includes('BB-INTERNET') || pkg.includes('BROADBAND') || pkg.includes('BB');

    // Save to Monitor
    if (chrome.runtime?.id) {
        chrome.storage.local.set({ lastScraped: data });
    }

    const foundCount = Math.max(Object.keys(data.details).length, data.materialDetails.length);
    updateLocalDiagnostics(foundCount, data.activeTab);

    if (data.soNum) {
        if (data.isBroadband) {
            updateIndicator('RESTRICTED (BB)', '#f59e0b');
            return data;
        }
        pushToERP(data);
    }
    return data;
}

async function pushToERP(data) {
    const currentHash = JSON.stringify({ details: data.details, materials: data.materialDetails, so: data.soNum });
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
