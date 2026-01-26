// Comprehensive Scraper for SLT i-Shamp Portal v1.3.6
console.log('🚀 [SLT-BRIDGE] Content script injected and starting...');
const CURRENT_VERSION = '1.3.6';

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
    if (!chrome.runtime?.id) return; // Context invalidated

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

    // 1. User Identifying
    const userEl = document.querySelector('.user-profile-dropdown h6');
    if (userEl) data.currentUser = clean(userEl.innerText).replace('Welcome, ', '');

    // 2. Tab Context
    const activeTab = document.querySelector('.nav-tabs .nav-link.active');
    data.activeTab = activeTab ? clean(activeTab.innerText) : 'GENERAL';

    // 3. Hidden Fields
    ['iptv1', 'iptv2', 'iptv3', 'bb', 'voice2', 'sval'].forEach(id => {
        const el = document.getElementById(id);
        if (el) data.hiddenInfo[id.toUpperCase()] = el.value || '';
    });

    // 4. Core Details (Label-Value Strategy)
    document.querySelectorAll('label, b, strong, span').forEach(l => {
        const style = window.getComputedStyle(l);
        const color = style.color;
        if (color === 'rgb(13, 202, 240)' || color === 'rgb(0, 202, 240)' || color.includes('0dcaf0')) {
            const key = clean(l.innerText).toUpperCase();
            if (!key || key.length > 50 || key.includes('VOICE TEST') || key === 'LATEST') return;
            if (data.details[key]) return;

            let val = '';
            let next = l.nextElementSibling || l.nextSibling;

            // Handle Dropdowns
            const sel = (next && next.nodeType === 1 && next.tagName === 'SELECT') ? next : (next && next.querySelector ? next.querySelector('select') : null);
            if (sel) {
                val = clean(sel.options[sel.selectedIndex]?.text || '');
            } else {
                while (next && next.nodeType === 3 && !next.textContent.trim()) next = next.nextSibling;
                if (next && next.textContent && clean(next.textContent) !== key) {
                    if (next.textContent.length < 300) val = clean(next.textContent);
                }
            }

            // Grid Fallback
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
                                val = clean(target.innerText);
                            }
                        }
                    }
                }
            }
            if (val && val !== key && !val.includes('SELECT MATERIAL')) {
                data.details[key] = val;
            }
        }
    });

    // 5. Team
    const teamEl = document.getElementById('mobusr');
    if (teamEl && !teamEl.value.includes('-- Select Team --')) {
        data.teamDetails['SELECTED TEAM'] = teamEl.options[teamEl.selectedIndex]?.text || '';
    }

    // 6. Materials Table Scraper
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        const headerText = clean(table.innerText).toUpperCase();
        if (headerText.includes('ITEM') || headerText.includes('QTY')) {
            table.querySelectorAll('tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    const itemName = clean(cells[0].innerText);
                    const qty = clean(cells[1].innerText);
                    if (qty && itemName && !itemName.includes('ITEM') && !itemName.includes('SELECT')) {
                        data.materialDetails.push({ ITEM: 'MATERIAL', TYPE: itemName, QTY: qty });
                    }
                }
            });
        }
    });

    // 7. SO Number (URL Master)
    const url = window.location.href;
    const sodMatch = url.match(/[?&]sod=([A-Z0-9]+)/i);
    data.soNum = sodMatch ? sodMatch[1].toUpperCase() : '';
    if (!data.soNum) data.soNum = data.details['SERVICE ORDER'] || data.details['SOD'] || '';

    // 8. Broadband Restriction
    const svc = (data.details['SERVICE TYPE'] || '').toUpperCase();
    const pkg = (data.details['PACKAGE'] || '').toUpperCase();
    data.isBroadband = svc.includes('BROADBAND') || svc.includes('BB-INTERNET') || pkg.includes('BROADBAND') || pkg.includes('BB');

    // Save to Local Store for Monitor
    chrome.storage.local.set({ lastScraped: data });
    updateLocalDiagnostics(Object.keys(data.details).length, data.activeTab);

    // Sync Logic
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
            chrome.runtime.sendMessage({ action: 'pushToERP', data }, (response) => {
                if (chrome.runtime.lastError) {
                    updateIndicator('BRIDGE ERROR', '#ef4444');
                } else if (response && response.success) {
                    lastPushedHash = currentHash;
                    updateIndicator('SYNC OK', '#22c55e');
                }
            });
        }
    }

    return data;
}

// Initial Setup
if (!document.getElementById('slt-erp-indicator')) {
    const banner = document.createElement('div');
    banner.id = 'slt-erp-indicator';
    banner.style.cssText = `position: fixed; top: 10px; right: 20px; z-index: 2147483647; background: #0f172a; color: #fff; padding: 6px 14px; font-size: 11px; font-weight: 600; border-radius: 8px; display: flex; align-items: center; gap: 8px; pointer-events: none;`;
    banner.innerHTML = `<div style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e;" id="slt-erp-status-dot"></div><span id="slt-erp-status-tag">SLT BRIDGE v${CURRENT_VERSION}</span>`;
    document.body.appendChild(banner);
}

// Listen for Popup Requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPortalData") {
        sendResponse(scrape());
    }
    return true;
});

const observer = new MutationObserver(() => {
    if (chrome.runtime?.id) scrape();
});
observer.observe(document.body, { childList: true, subtree: true });

scrape();
