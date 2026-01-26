// Comprehensive Scraper for SLT i-Shamp Portal v1.4.0
console.log('🚀 [SLT-BRIDGE] Content script injected and starting...');
const CURRENT_VERSION = '1.4.0';

let lastPushedHash = "";

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

function updateIndicator(status, color) {
    const tag = document.getElementById('slt-erp-status-tag');
    const dot = document.getElementById('slt-erp-status-dot');
    if (tag && dot) {
        tag.textContent = status;
        dot.style.background = color;
        dot.style.boxShadow = `0 0 8px ${color}`;
        if (status === 'SYNC OK') {
            setTimeout(() => { if (tag.textContent === 'SYNC OK') tag.textContent = 'SLT BRIDGE v' + CURRENT_VERSION; }, 3000);
        }
    }
}

function scrape() {
    if (!chrome.runtime?.id) return;

    const data = {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        details: {},
        teamDetails: {},
        materialDetails: [],
        hiddenInfo: {},
        currentUser: '',
        isBroadband: false
    };

    const clean = (txt) => txt ? txt.replace(/\s+/g, ' ').trim() : '';

    const isCyanish = (color) => {
        if (!color) return false;
        // Exact Portal Cyan
        if (color === 'rgb(13, 202, 240)' || color === 'rgb(0, 202, 240)' || color.includes('0dcaf0')) return true;

        const m = color.match(/\d+/g);
        if (m && m.length >= 3) {
            const r = parseInt(m[0]), g = parseInt(m[1]), b = parseInt(m[2]);
            // Cyan filter: Green and Blue should be high, Red should be significantly lower
            return g > 150 && b > 150 && r < 100;
        }
        return false;
    };

    // 1. User
    const userEl = document.querySelector('.user-profile-dropdown h6');
    if (userEl) data.currentUser = clean(userEl.innerText).replace('Welcome, ', '');

    data.activeTab = (document.querySelector('.nav-tabs .nav-link.active')) ? clean(document.querySelector('.nav-tabs .nav-link.active').innerText) : 'GENERAL';

    // 2. Hidden
    ['iptv1', 'iptv2', 'iptv3', 'bb', 'voice2', 'sval'].forEach(id => {
        const el = document.getElementById(id);
        if (el) data.hiddenInfo[id.toUpperCase()] = el.value || '';
    });

    // 3. TABLE / LIST SCRAPER (AGGRESSIVE FOR SERIAL NUMBERS AND GRIDS)
    document.querySelectorAll('table').forEach(table => {
        const trs = Array.from(table.querySelectorAll('tr'));
        let attrColIdx = -1;
        let valColIdx = -1;

        // Scrape tables with Attribute Name / Default Value headers
        trs.forEach((tr, idx) => {
            const cells = Array.from(tr.querySelectorAll('td, th'));
            cells.forEach((cell, cIdx) => {
                const txt = clean(cell.innerText).toUpperCase();
                if (txt.includes('ATTRIBUTE NAME')) attrColIdx = cIdx;
                if (txt.includes('DEFAULT VALUE') || (txt.includes('VALUE') && attrColIdx !== -1)) valColIdx = cIdx;
            });

            // If we have indices and this is a data row
            if (attrColIdx !== -1 && valColIdx !== -1) {
                const rowCells = Array.from(tr.querySelectorAll('td'));
                if (rowCells.length > Math.max(attrColIdx, valColIdx)) {
                    const k = clean(rowCells[attrColIdx].innerText).toUpperCase();
                    const v = clean(rowCells[valColIdx].innerText);
                    if (k && v && !k.includes('ATTRIBUTE NAME')) {
                        data.details[k] = v;
                    }
                }
            }
        });
    });

    // 4. UNIVERSAL SCRAPER (Labels with robustness)
    document.querySelectorAll('label, b, strong, span, th, td, div').forEach(el => {
        // Skip large containers
        if (el.children.length > 3 && !['TD', 'TH'].includes(el.tagName)) return;

        const style = window.getComputedStyle(el);
        if (isCyanish(style.color)) {
            const key = clean(el.innerText).toUpperCase();
            if (!key || key.length > 80 || data.details[key] || key === 'LATEST') return;

            let val = '';
            // Strategy: Sibling
            let next = el.nextElementSibling || el.nextSibling;
            while (next && next.nodeType === 3 && !next.textContent.trim()) next = next.nextSibling;
            if (next) {
                const nextStyle = window.getComputedStyle(next.nodeType === 1 ? next : el);
                if (!isCyanish(nextStyle.color)) val = clean(next.textContent || next.innerText);
            }

            // Grid Fallback
            if (!val || val === key) {
                const col = el.closest('[class*="col-"]');
                const row = col?.parentElement;
                if (row && col && row.classList.contains('row')) {
                    const idx = Array.from(row.children).indexOf(col);
                    let nextR = row.nextElementSibling;
                    while (nextR && nextR.tagName !== 'DIV') nextR = nextR.nextElementSibling;
                    if (nextR && nextR.classList.contains('row')) {
                        const target = nextR.children[idx];
                        if (target) val = clean(target.innerText);
                    }
                }
            }

            if (val && val !== key && val.length < 500 && !val.includes('SELECT MATERIAL')) {
                data.details[key] = val;
            }
        }
    });

    // 5. Team & Added Materials
    const teamEl = document.getElementById('mobusr');
    if (teamEl && !teamEl.value.includes('-- Select Team --')) data.teamDetails['SELECTED TEAM'] = teamEl.options[teamEl.selectedIndex]?.text || '';

    // Material Table Scraper (Picks up PLC-CON, etc.)
    document.querySelectorAll('table').forEach(table => {
        const text = clean(table.innerText).toUpperCase();
        if (text.includes('ITEM') || text.includes('QTY')) {
            table.querySelectorAll('tr').forEach(row => {
                const td = row.querySelectorAll('td');
                if (td.length >= 2) {
                    const item = clean(td[0].innerText);
                    const qty = clean(td[1].innerText);
                    if (qty && item && !item.includes('ITEM') && !item.includes('SELECT')) {
                        if (item.includes('-') || item.includes('POLE') || /^[A-Z0-9-]+$/.test(item.split(' ')[0])) {
                            data.materialDetails.push({ ITEM: 'MATERIAL', TYPE: item, QTY: qty });
                        }
                    }
                }
            });
        }
    });

    // 6. SO & Broadband
    const url = window.location.href;
    const sodMatch = url.match(/[?&]sod=([A-Z0-9]+)/i);
    data.soNum = sodMatch ? sodMatch[1].toUpperCase() : '';
    if (!data.soNum) data.soNum = data.details['SERVICE ORDER'] || data.details['SOD'] || '';

    const svc = (data.details['SERVICE TYPE'] || '').toUpperCase();
    const pkg = (data.details['PACKAGE'] || '').toUpperCase();
    data.isBroadband = svc.includes('BROADBAND') || svc.includes('BB-INTERNET') || pkg.includes('BROADBAND') || pkg.includes('BB');

    chrome.storage.local.set({ lastScraped: data });
    updateLocalDiagnostics(Object.keys(data.details).length, data.activeTab);

    if (data.soNum) {
        if (data.isBroadband) { updateIndicator('RESTRICTED (BB)', '#f59e0b'); return data; }
        if (data.activeTab === 'IMAGES' || data.activeTab === 'PHOTOS') { updateIndicator('ACTIVE (SKIP TAB)', '#94a3b8'); return data; }

        const hash = JSON.stringify({ so: data.soNum, details: data.details, materials: data.materialDetails });
        if (hash !== lastPushedHash) {
            chrome.runtime.sendMessage({ action: 'pushToERP', data }, (res) => {
                if (!chrome.runtime.lastError && res?.success) { lastPushedHash = hash; updateIndicator('SYNC OK', '#22c55e'); }
                else { updateIndicator('BRIDGE ERROR', '#ef4444'); }
            });
        }
    }
    return data;
}

if (!document.getElementById('slt-erp-indicator')) {
    const b = document.createElement('div');
    b.id = 'slt-erp-indicator';
    b.style.cssText = `position: fixed; top: 10px; right: 20px; z-index: 2147483647; background: #0f172a; color: #fff; padding: 6px 14px; font-size: 11px; font-weight: 600; border-radius: 8px; display: flex; align-items: center; gap: 8px; pointer-events: none;`;
    b.innerHTML = `<div style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e;" id="slt-erp-status-dot"></div><span id="slt-erp-status-tag">SLT BRIDGE v${CURRENT_VERSION}</span>`;
    document.body.appendChild(b);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPortalData") sendResponse(scrape());
    return true;
});

setInterval(scrape, 2000);
scrape();
