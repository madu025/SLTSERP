// Comprehensive Scraper for SLT i-Shamp Portal v1.3.7
console.log('🚀 [SLT-BRIDGE] Content script injected and starting...');
const CURRENT_VERSION = '1.3.7';

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

    // Fuzzy Color Match (Cyan-ish)
    const isCyanish = (color) => {
        if (!color) return false;
        if (color === 'rgb(13, 202, 240)' || color === 'rgb(0, 202, 240)' || color.includes('0dcaf0')) return true;
        // Check RGB parts if possible
        const m = color.match(/\d+/g);
        if (m && m.length >= 3) {
            const r = parseInt(m[0]), g = parseInt(m[1]), b = parseInt(m[2]);
            return b > 200 && g > 150 && r < 120; // Matches cyan-like shades
        }
        return false;
    };

    // 1. Identifying
    const userEl = document.querySelector('.user-profile-dropdown h6');
    if (userEl) data.currentUser = clean(userEl.innerText).replace('Welcome, ', '');

    const activeTab = document.querySelector('.nav-tabs .nav-link.active');
    data.activeTab = activeTab ? clean(activeTab.innerText) : 'GENERAL';

    // 2. Hidden System Values
    ['iptv1', 'iptv2', 'iptv3', 'bb', 'voice2', 'sval'].forEach(id => {
        const el = document.getElementById(id);
        if (el) data.hiddenInfo[id.toUpperCase()] = el.value || '';
    });

    // 3. AGGRESSIVE UNIVERSAL SCRAPER
    // Scan all potential labels
    const allTextEls = document.querySelectorAll('label, b, strong, span, th, td');
    allTextEls.forEach(el => {
        const style = window.getComputedStyle(el);
        if (isCyanish(style.color)) {
            const key = clean(el.innerText).toUpperCase();
            if (!key || key.length > 50 || key === 'LATEST' || key.includes('VOICE TEST')) return;
            if (data.details[key]) return;

            let val = '';

            // Strategy A: Bootstrap Grid Logic
            const col = el.closest('[class*="col-"]');
            const row = col?.parentElement;
            if (row && row.classList.contains('row')) {
                const colIdx = Array.from(row.children).indexOf(col);
                let nextRow = row.nextElementSibling;
                // Skip non-divs to find next row
                while (nextRow && nextRow.tagName !== 'DIV') nextRow = nextRow.nextElementSibling;

                if (nextRow && nextRow.classList.contains('row')) {
                    const target = nextRow.children[colIdx];
                    if (target) {
                        // Check for Select
                        const sel = target.querySelector('select');
                        if (sel) {
                            val = clean(sel.options[sel.selectedIndex]?.text || '');
                        } else {
                            val = clean(target.innerText);
                        }
                    }
                }
            }

            // Strategy B: Sibling Logic (Immediate)
            if (!val || val === key) {
                let next = el.nextElementSibling || el.nextSibling;
                while (next && next.nodeType === 3 && !next.textContent.trim()) next = next.nextSibling;
                if (next) {
                    const nextStyle = window.getComputedStyle(next.nodeType === 1 ? next : el);
                    if (!isCyanish(nextStyle.color)) {
                        val = clean(next.textContent || next.innerText);
                    }
                }
            }

            // Strategy C: Table Cell Logic
            if (!val || val === key) {
                if (el.tagName === 'TD' || el.tagName === 'TH') {
                    const row = el.parentElement;
                    const cellIdx = Array.from(row.children).indexOf(el);
                    const nextRow = row.nextElementSibling;
                    if (nextRow && nextRow.children[cellIdx]) {
                        val = clean(nextRow.children[cellIdx].innerText);
                    }
                }
            }

            if (val && val !== key && val.length < 500 && !val.includes('SELECT MATERIAL')) {
                data.details[key] = val;
            }
        }
    });

    // 4. Team Extraction
    const teamEl = document.getElementById('mobusr');
    if (teamEl && !teamEl.value.includes('-- Select Team --')) {
        data.teamDetails['SELECTED TEAM'] = teamEl.options[teamEl.selectedIndex]?.text || '';
    }

    // 5. Advanced Material & Table Scraper
    // (Picks up anything that looks like a data table)
    document.querySelectorAll('table').forEach(table => {
        const rows = Array.from(table.querySelectorAll('tr'));
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                const itemName = clean(cells[0].innerText);
                const qty = clean(cells[1].innerText);
                // Regex for materials and common identifier patterns
                if (qty && itemName && !itemName.toUpperCase().includes('ITEM') && !itemName.includes('SELECT')) {
                    if (itemName.includes('-') || itemName.includes('POLE') || itemName.includes('WIRE') || itemName.includes('CABLE') || /^[A-Z0-9-]+$/.test(itemName.split(' ')[0])) {
                        data.materialDetails.push({ ITEM: 'MATERIAL', TYPE: itemName, QTY: qty });
                    }
                }
            }
        });
    });

    // 6. SO Number (Absolute URL Priority v1.3.7)
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
    b.style.cssText = `position: fixed; top: 10px; right: 20px; z-index: 999999; background: #0f172a; color: #fff; padding: 6px 14px; font-size: 11px; font-weight: 600; border-radius: 8px; display: flex; align-items: center; gap: 8px; pointer-events: none;`;
    b.innerHTML = `<div style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e;" id="slt-erp-status-dot"></div><span id="slt-erp-status-tag">SLT BRIDGE v${CURRENT_VERSION}</span>`;
    document.body.appendChild(b);
}

// Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPortalData") sendResponse(scrape());
    return true;
});

setInterval(scrape, 2000);
scrape();
