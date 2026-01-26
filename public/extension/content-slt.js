// Comprehensive Scraper for SLT i-Shamp Portal v1.3.8
console.log('🚀 [SLT-BRIDGE] Content script injected and starting...');
const CURRENT_VERSION = '1.3.8';

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
        // Cyan-ish colors used in SLT portal
        if (color === 'rgb(13, 202, 240)' || color === 'rgb(0, 202, 240)' || color.includes('0dcaf0')) return true;
        const m = color.match(/\d+/g);
        if (m && m.length >= 3) {
            const r = parseInt(m[0]), g = parseInt(m[1]), b = parseInt(m[2]);
            return b > 180 && g > 130 && r < 150; // Broaden cyan detection
        }
        return false;
    };

    // 1. User Identifying
    const userEl = document.querySelector('.user-profile-dropdown h6');
    if (userEl) data.currentUser = clean(userEl.innerText).replace('Welcome, ', '');

    const activeTab = document.querySelector('.nav-tabs .nav-link.active');
    data.activeTab = activeTab ? clean(activeTab.innerText) : 'GENERAL';

    // 2. Hidden System Values
    ['iptv1', 'iptv2', 'iptv3', 'bb', 'voice2', 'sval'].forEach(id => {
        const el = document.getElementById(id);
        if (el) data.hiddenInfo[id.toUpperCase()] = el.value || '';
    });

    // 3. ULTRA-AGGRESSIVE UNIVERSAL SCRAPER (Expanded Tags)
    const allTextEls = document.querySelectorAll('label, b, strong, span, th, td, div, h1, h2, h3, h4, h5, h6');
    allTextEls.forEach(el => {
        // Skip too large elements or layout containers
        if (el.children.length > 5 && !['TD', 'TH'].includes(el.tagName)) return;

        const style = window.getComputedStyle(el);
        if (isCyanish(style.color)) {
            const key = clean(el.innerText).toUpperCase();
            if (!key || key.length > 100 || key === 'LATEST' || key.includes('VOICE TEST') || key.includes('TEST STATUS')) return;
            if (data.details[key]) return;

            let val = '';

            // Strategy A: Grid/Row Logic (Bootstrap)
            const col = el.closest('[class*="col-"]');
            const row = col?.parentElement;
            if (row && col && row.classList.contains('row')) {
                const colIdx = Array.from(row.children).indexOf(col);
                let nextRow = row.nextElementSibling;
                while (nextRow && nextRow.tagName !== 'DIV') nextRow = nextRow.nextElementSibling;

                if (nextRow && nextRow.classList.contains('row')) {
                    const target = nextRow.children[colIdx];
                    if (target) {
                        const sel = target.querySelector('select');
                        val = sel ? clean(sel.options[sel.selectedIndex]?.text || '') : clean(target.innerText);
                    }
                }
            }

            // Strategy B: Immediate Sibling Logic
            if (!val || val === key) {
                let next = el.nextElementSibling || el.nextSibling;
                while (next && next.nodeType === 3 && !next.textContent.trim()) next = next.nextSibling;
                if (next) {
                    const nextStyle = window.getComputedStyle(next.nodeType === 1 ? next : el);
                    if (!isCyanish(nextStyle.color)) {
                        val = clean(next.textContent || next.innerText);
                    }
                    // Handle Select inputs specifically
                    if (!val && next.nodeType === 1 && next.tagName === 'SELECT') {
                        val = clean(next.options[next.selectedIndex]?.text || '');
                    }
                }
            }

            // Strategy C: Absolute Positioning / Cell Logic
            if (!val || val === key) {
                if (el.tagName === 'TD' || el.tagName === 'TH') {
                    const tr = el.parentElement;
                    const cellIdx = Array.from(tr.children).indexOf(el);
                    const nextTr = tr.nextElementSibling;
                    if (nextTr && nextTr.children[cellIdx]) {
                        val = clean(nextTr.children[cellIdx].innerText);
                    }
                }
            }

            if (val && val !== key && val.length < 1000 && !val.includes('SELECT MATERIAL')) {
                data.details[key] = val;
            }
        }
    });

    // 4. Team Extraction
    const teamEl = document.getElementById('mobusr');
    if (teamEl && !teamEl.value.includes('-- Select Team --')) {
        data.teamDetails['SELECTED TEAM'] = teamEl.options[teamEl.selectedIndex]?.text || '';
    }

    // 5. Materials & Advanced Table Scraper
    document.querySelectorAll('table').forEach(table => {
        const rows = Array.from(table.querySelectorAll('tr'));
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                const itemName = clean(cells[0].innerText);
                const qty = clean(cells[1].innerText);
                if (qty && itemName && !itemName.toUpperCase().includes('ITEM') && !itemName.includes('SELECT')) {
                    // Filter for actual material nomenclature
                    if (itemName.includes('-') || itemName.includes('POLE') || itemName.includes('WIRE') || itemName.includes('CABLE') || /^[A-Z0-9-]+$/.test(itemName.split(' ')[0])) {
                        data.materialDetails.push({ ITEM: 'MATERIAL', TYPE: itemName, QTY: qty });
                    }
                }
            }
        });
    });

    // 6. SO Number (Fixed Universal Extraction)
    const url = window.location.href;
    const sodMatch = url.match(/[?&]sod=([A-Z0-9]+)/i);
    data.soNum = sodMatch ? sodMatch[1].toUpperCase() : '';
    if (!data.soNum) {
        data.soNum = data.details['SERVICE ORDER'] || data.details['SOD'] || '';
    }

    // 7. Broadband Check
    const svc = (data.details['SERVICE TYPE'] || '').toUpperCase();
    const pkg = (data.details['PACKAGE'] || '').toUpperCase();
    data.isBroadband = svc.includes('BROADBAND') || svc.includes('BB-INTERNET') || pkg.includes('BROADBAND') || pkg.includes('BB');

    // 8. Save to Monitor
    chrome.storage.local.set({ lastScraped: data });
    updateLocalDiagnostics(Object.keys(data.details).length, data.activeTab);

    // 9. Sync Logic
    if (data.soNum) {
        if (data.isBroadband) {
            updateIndicator('RESTRICTED (BB)', '#f59e0b');
            return data;
        }
        if (data.activeTab === 'IMAGES' || data.activeTab === 'PHOTOS') {
            updateIndicator('ACTIVE (SKIP TAB)', '#94a3b8');
            return data;
        }

        const currentHash = JSON.stringify({ so: data.soNum, details: data.details, materials: data.materialDetails });
        if (currentHash !== lastPushedHash) {
            chrome.runtime.sendMessage({ action: 'pushToERP', data }, (res) => {
                if (!chrome.runtime.lastError && res?.success) {
                    lastPushedHash = currentHash;
                    updateIndicator('SYNC OK', '#22c55e');
                } else {
                    updateIndicator('BRIDGE ERROR', '#ef4444');
                }
            });
        }
    }

    return data;
}

// Indicator Setup
if (!document.getElementById('slt-erp-indicator')) {
    const b = document.createElement('div');
    b.id = 'slt-erp-indicator';
    b.style.cssText = `position: fixed; top: 10px; right: 20px; z-index: 2147483647; background: #0f172a; color: #fff; padding: 6px 14px; font-size: 11px; font-weight: 600; border-radius: 8px; display: flex; align-items: center; gap: 8px; pointer-events: none;`;
    b.innerHTML = `<div style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e;" id="slt-erp-status-dot"></div><span id="slt-erp-status-tag">SLT BRIDGE v${CURRENT_VERSION}</span>`;
    document.body.appendChild(b);
}

// Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPortalData") {
        sendResponse(scrape());
    }
    return true;
});

setInterval(scrape, 1500); // Increased frequency for real-time feel
scrape();
