// Comprehensive Scraper for SLT i-Shamp Portal v1.3.5
console.log('🚀 [SLT-BRIDGE] Content script injected and starting...');
const CURRENT_VERSION = '1.3.5';

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

    const userEl = document.querySelector('.user-profile-dropdown h6');
    if (userEl) data.currentUser = clean(userEl.innerText).replace('Welcome, ', '');

    const activeTab = document.querySelector('.nav-tabs .nav-link.active');
    data.activeTab = activeTab ? clean(activeTab.innerText) : 'GENERAL';

    // 1. Capture Hidden Values
    ['iptv1', 'iptv2', 'iptv3', 'bb', 'voice2', 'sval'].forEach(id => {
        const el = document.getElementById(id);
        if (el) data.hiddenInfo[id.toUpperCase()] = el.value || '';
    });

    // 2. Universal Info Scraper (Core Details)
    document.querySelectorAll('label, b, strong, span').forEach(l => {
        const style = window.getComputedStyle(l);
        if (style.color === 'rgb(13, 202, 240)' || style.color === 'rgb(0, 202, 240)' || style.color.includes('0dcaf0')) {
            const key = clean(l.innerText).toUpperCase();
            if (!key || key.length > 50 || key.includes('VOICE TEST') || key === 'LATEST') return;
            if (data.details[key]) return;

            let val = '';
            let next = l.nextElementSibling || l.nextSibling;

            // Check for Select (Dropdowns)
            const sel = (next && next.nodeType === 1 && next.tagName === 'SELECT') ? next : (next && next.querySelector ? next.querySelector('select') : null);
            if (sel) {
                val = clean(sel.options[sel.selectedIndex]?.text || '');
            } else {
                while (next && next.nodeType === 3 && !next.textContent.trim()) next = next.nextSibling;
                if (next && next.textContent && clean(next.textContent) !== key) {
                    if (next.textContent.length < 300) val = clean(next.textContent);
                }
            }
            if (val && val !== key && !val.includes('SELECT MATERIAL')) data.details[key] = val;
        }
    });

    // 3. Team Handling
    const teamEl = document.getElementById('mobusr');
    if (teamEl && !teamEl.value.includes('-- Select Team --')) {
        data.teamDetails['SELECTED TEAM'] = teamEl.options[teamEl.selectedIndex]?.text || '';
    }

    // 4. Advanced Material Scraper (Support for Added Items Table)
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        const headerText = clean(table.innerText).toUpperCase();
        // Identify Material Tables
        if (headerText.includes('ITEM') || headerText.includes('MATERIAL') || headerText.includes('QTY')) {
            const rows = Array.from(table.querySelectorAll('tr'));
            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells.length >= 2) {
                    const itemName = clean(cells[0].innerText);
                    const qty = clean(cells[1].innerText);
                    // Match against common material patterns
                    if (qty && (itemName.includes('-') || itemName.includes('POLE') || itemName.includes('CABLE') || itemName.includes('HOOK') || /^[A-Z0-9-]+$/.test(itemName.split(' ')[0]))) {
                        if (!itemName.includes('SELECT') && !itemName.toUpperCase().includes('ITEM')) {
                            data.materialDetails.push({ ITEM: 'MATERIAL', TYPE: itemName, QTY: qty });
                        }
                    }
                }
            });
        }
    });

    // 5. SO Number extraction (URL First)
    const url = window.location.href;
    const sodMatch = url.match(/[?&]sod=([A-Z0-9]+)/i);
    data.soNum = sodMatch ? sodMatch[1].toUpperCase() : '';
    if (!data.soNum) data.soNum = data.details['SERVICE ORDER'] || data.details['SOD'] || '';

    // 6. Broadband check
    const svc = (data.details['SERVICE TYPE'] || '').toUpperCase();
    const pkg = (data.details['PACKAGE'] || '').toUpperCase();
    data.isBroadband = svc.includes('BROADBAND') || svc.includes('BB-INTERNET') || pkg.includes('BROADBAND') || pkg.includes('BB');

    // Save to local storage for monitor
    if (chrome.runtime?.id) chrome.storage.local.set({ lastScraped: data });

    updateLocalDiagnostics(Object.keys(data.details).length, data.activeTab);

    // Sync only if not broadband
    if (data.soNum && !data.isBroadband) {
        if (data.activeTab !== 'IMAGES') {
            const hash = JSON.stringify({ so: data.soNum, details: data.details, materials: data.materialDetails });
            if (hash !== window.lastPushedHash) {
                chrome.runtime.sendMessage({ action: 'pushToERP', data }, (res) => {
                    if (res?.success) window.lastPushedHash = hash;
                });
            }
        }
    }
    return data;
}

// Indicator Logic
if (!document.getElementById('slt-erp-indicator')) {
    const b = document.createElement('div'); b.id = 'slt-erp-indicator';
    b.style.cssText = `position: fixed; top: 10px; right: 20px; z-index: 999999; background: #0f172a; color: #fff; padding: 6px 12px; font-size: 11px; border-radius: 8px; display: flex; align-items: center; gap: 8px; pointer-events: none;`;
    b.innerHTML = `<div style="width:8px; height:8px; border-radius:50%; background:#22c55e;" id="dot"></div><span id="tag">SLT BRIDGE v${CURRENT_VERSION}</span>`;
    document.body.appendChild(b);
}

setInterval(scrape, 2000);
scrape();
