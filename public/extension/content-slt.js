// Comprehensive Scraper for SLT i-Shamp Portal v1.2.9
console.log('🚀 [SLT-BRIDGE] Content script injected and starting...');
const CURRENT_VERSION = '1.2.9';

// "High Accuracy" Edition

function updateLocalDiagnostics(foundItems, context) {
    if (!chrome.runtime?.id) return; // Context invalidated
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

    // 2. Capture Hidden System Values
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

    // 4. Universal Info Scraper
    const allLabels = document.querySelectorAll('label, b, strong, span');
    allLabels.forEach(l => {
        const style = window.getComputedStyle(l);
        const color = style.color;
        const isCyan = color === 'rgb(13, 202, 240)' || color === 'rgb(0, 202, 240)' || color.includes('0dcaf0');

        if (isCyan) {
            const key = clean(l.innerText).toUpperCase();
            if (!key || key.length > 50 || key.includes('VOICE TEST') || key === 'LATEST') return;

            if (data.details[key]) return;

            let val = '';

            // Strategy 1: Grid Logic
            const col = l.closest('[class*="col-"]') || l.parentElement;
            const row = col?.parentElement;
            if (row && col && row.classList.contains('row')) {
                const rowChildren = Array.from(row.children);
                const colIdx = rowChildren.indexOf(col);
                let nextRow = row.nextElementSibling;
                while (nextRow && nextRow.tagName !== 'DIV') nextRow = nextRow.nextElementSibling;

                if (nextRow && nextRow.classList.contains('row')) {
                    const targetCell = nextRow.children[colIdx];
                    if (targetCell) {
                        const subLabels = targetCell.querySelectorAll('label, b, strong, span');
                        let cellIsLabelRow = false;
                        subLabels.forEach(sl => {
                            const c = window.getComputedStyle(sl).color;
                            if (c === 'rgb(13, 202, 240)' || c === 'rgb(0, 202, 240)' || c.includes('0dcaf0')) cellIsLabelRow = true;
                        });

                        if (!cellIsLabelRow) {
                            const cellText = clean(targetCell.innerText);
                            if (cellText && cellText !== key) val = cellText;
                        }
                    }
                }
            }

            // Strategy 2: Sibling Logic
            if (!val) {
                let next = l.nextElementSibling || l.nextSibling;
                while (next && next.nodeType === 3 && !next.textContent.trim()) next = next.nextSibling;

                if (next) {
                    const nextStyle = window.getComputedStyle((next.nodeType === 1) ? next : l);
                    const nextColor = nextStyle.color;
                    const nextIsCyan = nextColor === 'rgb(13, 202, 240)' || nextColor === 'rgb(0, 202, 240)' || nextColor.includes('0dcaf0');

                    if (!nextIsCyan) {
                        val = clean(next.textContent || next.innerText);
                    }
                }
            }

            if (val && val !== key && val.length < 500) {
                data.details[key] = val;
            }
        }
    });

    // 5. Team & User Assignment
    const selectedTeam = getVal('mobusr');
    if (selectedTeam && !selectedTeam.includes('-- Select Team --')) {
        data.teamDetails['SELECTED TEAM'] = selectedTeam;
    }

    // 6. Detailed Material Scraping
    const dw = getVal('dwvalue');
    if (dw) data.materialDetails.push({ ITEM: 'DROPWIRE', VALUE: dw, TYPE: getVal('dw') });
    const pole = getVal('pole');
    if (pole && pole !== 'SELECT POLE ...') {
        data.materialDetails.push({ ITEM: 'POLE', TYPE: pole, QTY: getVal('qty'), SERIAL: getVal('snvalue') });
    }
    const oth = getVal('oth');
    if (oth && oth !== 'SELECT MATERIAL ...') {
        data.materialDetails.push({ ITEM: 'OTHER', TYPE: oth, VALUE: getVal('othvalue') });
    }

    // 7. Robust Voice Test Details Scraper
    data.voiceTest = {};
    const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, b, strong, td, label, div, span, a');

    const isCyanColor = (color) => {
        if (!color) return false;
        if (color === 'rgb(13, 202, 240)' || color === 'rgb(0, 202, 240)' || color.includes('0dcaf0')) return true;
        const parts = color.match(/\d+/g);
        if (parts && parts.length >= 3) {
            const r = parseInt(parts[0]);
            const g = parseInt(parts[1]);
            const b = parseInt(parts[2]);
            return b > 200 && g > 150 && r < 100;
        }
        return false;
    };

    allElements.forEach(el => {
        const text = clean(el.innerText).toUpperCase();
        if (/VOICE\s*TEST|V-TEST|V\s*TEST/i.test(text)) {
            let containerFound = el.closest('.card') || el.closest('.container') || el.closest('.form-body') || el.closest('.row');

            if (!containerFound) {
                let curr = el;
                for (let i = 0; i < 4; i++) {
                    if (!curr) break;
                    let next = curr.nextElementSibling;
                    while (next) {
                        if (next.tagName === 'TABLE' || next.classList.contains('card') || next.querySelectorAll('.row').length > 0) {
                            containerFound = next;
                            break;
                        }
                        next = next.nextElementSibling;
                    }
                    if (containerFound) break;
                    curr = curr.parentElement;
                }
            }

            if (containerFound) {
                const foundData = {};
                const possibleLabels = containerFound.querySelectorAll('label, b, strong, span');
                possibleLabels.forEach(l => {
                    const color = window.getComputedStyle(l).color;
                    if (isCyanColor(color) || /DATE|TIME|TEST|DURATION|TYPE|RESULT/i.test(l.innerText)) {
                        const key = clean(l.innerText).toUpperCase();
                        if (!key || key.length > 50 || key === 'LATEST') return;

                        let val = '';
                        let sib = l.nextElementSibling || l.nextSibling;
                        while (sib && sib.nodeType === 3 && !sib.textContent.trim()) sib = sib.nextSibling;
                        if (sib && sib.innerText && clean(sib.innerText) !== key) {
                            val = clean(sib.innerText);
                        }

                        if (!val) {
                            const col = l.closest('[class*="col-"]') || l.parentElement;
                            const row = col?.parentElement;
                            if (row && col && row.classList.contains('row')) {
                                const rowChildren = Array.from(row.children);
                                const colIdx = rowChildren.indexOf(col);
                                let nextRow = row.nextElementSibling;
                                while (nextRow && nextRow.tagName !== 'DIV') nextRow = nextRow.nextElementSibling;
                                if (nextRow && nextRow.classList.contains('row')) {
                                    const targetCell = nextRow.children[colIdx];
                                    if (targetCell) val = clean(targetCell.innerText);
                                }
                            }
                        }

                        if (val && val !== key) {
                            foundData[key] = val;
                        }
                    }
                });

                if (Object.keys(foundData).length > 0) {
                    if (text.includes('LATEST') || Object.keys(data.voiceTest).length === 0) {
                        data.voiceTest = { ...data.voiceTest, ...foundData };
                    }
                }
            } else if (text.includes('LATEST')) {
                console.warn('❌ [SLT-BRIDGE] Could not find a suitable data container near LATEST VOICE TEST header.');
            }
        }
    });

    // Capture SO Number (PRIORITIZATION FIX FOR v1.2.9)
    // 1. First Priority: The literal visible label on screen (Target for accuracy)
    const soRegex = /^[A-Z]{3}\d{10,}/;
    let labelSO = data.details['SERVICE ORDER'] || data.details['SOD'] || '';

    if (labelSO && soRegex.test(labelSO)) {
        data.soNum = labelSO;
    } else {
        // 2. Second Priority: URL Parameter (Fallback)
        const urlParams = new URLSearchParams(window.location.search);
        data.soNum = urlParams.get('sod')?.split('_')[0] || '';

        // 3. Third Priority: Hidden System Tag (Broadband fallback)
        if (!data.soNum || !soRegex.test(data.soNum)) {
            data.soNum = data.hiddenInfo['BB'] || '';
        }
    }

    const foundCount = Object.keys(data.details).length + data.materialDetails.length;
    updateLocalDiagnostics(foundCount, activeContext);

    if (chrome.runtime?.id) {
        chrome.storage.local.set({ lastScraped: data });
    }

    if (data.soNum) {
        if (data.activeTab === 'IMAGES' || data.activeTab === 'PHOTOS') {
            updateIndicator(`BRIDGE ACTIVE (SKIP ${data.activeTab})`, '#94a3b8');
            return data;
        }
        pushToERP(data);
    }

    return data;
}

async function pushToERP(data) {
    const currentHash = JSON.stringify({
        details: data.details,
        team: data.teamDetails,
        materials: data.materialDetails,
        tab: data.activeTab,
        voice: data.voiceTest
    });
    if (currentHash === lastPushedHash) return;
    if (!chrome.runtime?.id) return;
    chrome.runtime.sendMessage({ action: 'pushToERP', data }, (response) => {
        if (chrome.runtime.lastError) {
            updateIndicator('BRIDGE ERROR', '#ef4444');
            return;
        }
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
        dot.style.boxShadow = `0 0 8px ${color}`;
        if (status === 'SYNC OK') {
            setTimeout(() => {
                if (tag.textContent === 'SYNC OK') tag.textContent = 'SLT BRIDGE v' + CURRENT_VERSION;
            }, 3000);
        }
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPortalData") {
        sendResponse(scrape());
    }
    return true;
});

if (!document.getElementById('slt-erp-indicator')) {
    const banner = document.createElement('div');
    banner.id = 'slt-erp-indicator';
    banner.style.cssText = `
        position: fixed; top: 10px; right: 20px; z-index: 2147483647;
        background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(8px);
        color: #fff; padding: 6px 14px; font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 11px; font-weight: 600; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 8px;
        pointer-events: none; transition: all 0.3s ease;
    `;
    banner.innerHTML = `
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e;" id="slt-erp-status-dot"></div>
        <span id="slt-erp-status-tag" style="letter-spacing: 0.02em;">SLT BRIDGE v${CURRENT_VERSION}</span>
    `;

    const checkUpdates = async () => {
        try {
            const erpUrl = window.location.origin.includes('localhost') ? 'http://localhost:3000' : 'https://slts-erp.vercel.app';
            const response = await fetch(`${erpUrl}/extension/manifest.json?t=${Date.now()}`);
            if (response.ok) {
                const manifest = await response.json();
                if (manifest.version && manifest.version !== CURRENT_VERSION) {
                    updateIndicator(`UPDATE v${manifest.version} AVAILABLE`, '#f59e0b');
                    banner.style.cursor = 'pointer'; banner.style.pointerEvents = 'auto';
                    banner.onclick = () => window.open(`${erpUrl}/slt-bridge.zip`, '_blank');
                    banner.style.background = 'rgba(245, 158, 11, 0.95)';
                }
            }
        } catch (e) { }
    };
    checkUpdates();
    document.body.appendChild(banner);
}

let timeout;
const observer = new MutationObserver(() => {
    if (!chrome.runtime?.id) { observer.disconnect(); return; }
    clearTimeout(timeout);
    timeout = setTimeout(scrape, 1000);
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true });

try { scrape(); } catch (e) { console.error('💥 [SLT-BRIDGE] Fatal error:', e); }
