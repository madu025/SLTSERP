// Comprehensive Scraper for SLT i-Shamp Portal v1.3.2
console.log('🚀 [SLT-BRIDGE] Content script injected and starting...');
const CURRENT_VERSION = '1.3.2';

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

    // 1. Identify Logged-in User
    const userEl = document.querySelector('.user-profile-dropdown h6');
    if (userEl) data.currentUser = clean(userEl.innerText).replace('Welcome, ', '');

    // 2. Capture Hidden System Values
    const hiddenIds = ['iptv1', 'iptv2', 'iptv3', 'bb', 'voice2', 'sval'];
    hiddenIds.forEach(id => {
        const val = getVal(id);
        if (val) data.hiddenInfo[id.toUpperCase()] = val;
    });

    // 3. Determine Active Tab
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
            if (!val) {
                let next = l.nextElementSibling || l.nextSibling;
                while (next && next.nodeType === 3 && !next.textContent.trim()) next = next.nextSibling;
                if (next) {
                    const nextStyle = window.getComputedStyle((next.nodeType === 1) ? next : l);
                    if (nextStyle.color !== 'rgb(13, 202, 240)' && nextStyle.color !== 'rgb(0, 202, 240)') {
                        val = clean(next.textContent || next.innerText);
                    }
                }
            }
            if (val && val !== key && val.length < 500) data.details[key] = val;
        }
    });

    // 5. Materials & Team
    const selectedTeam = getVal('mobusr');
    if (selectedTeam && !selectedTeam.includes('-- Select Team --')) data.teamDetails['SELECTED TEAM'] = selectedTeam;

    const dw = getVal('dwvalue');
    if (dw) data.materialDetails.push({ ITEM: 'DROPWIRE', VALUE: dw, TYPE: getVal('dw') });

    const pole = getVal('pole');
    if (pole && pole !== 'SELECT POLE ...') {
        data.materialDetails.push({ ITEM: 'POLE', TYPE: pole, QTY: getVal('qty'), SERIAL: getVal('snvalue') });
    }

    // 6. Voice Test
    data.voiceTest = {};
    const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, b, strong, td, label, div, span, a');
    allElements.forEach(el => {
        const text = clean(el.innerText).toUpperCase();
        if (/VOICE\s*TEST|V-TEST/i.test(text)) {
            let containerFound = el.closest('.card') || el.closest('.container') || el.closest('.row');
            if (containerFound) {
                const foundData = {};
                containerFound.querySelectorAll('label, b, strong, span').forEach(l => {
                    const k = clean(l.innerText).toUpperCase();
                    if (!k || k.length > 50 || k === 'LATEST') return;
                    let val = '';
                    let sib = l.nextElementSibling || l.nextSibling;
                    while (sib && sib.nodeType === 3 && !sib.textContent.trim()) sib = sib.nextSibling;
                    if (sib && sib.innerText && clean(sib.innerText) !== k) val = clean(sib.innerText);
                    if (val) foundData[k] = val;
                });
                if (Object.keys(foundData).length > 0) {
                    if (text.includes('LATEST') || Object.keys(data.voiceTest).length === 0) data.voiceTest = foundData;
                }
            }
        }
    });

    // 7. SO Number - ULTRA ACCURATE TARGETING
    const url = window.location.href;
    const sodMatch = url.match(/sod=([A-Z]{3}\d+)/i);
    if (sodMatch) {
        data.soNum = sodMatch[1].toUpperCase();
        console.log('🎯 [SLT-BRIDGE] SO extracted from URL match:', data.soNum);
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        data.soNum = urlParams.get('sod')?.split('_')[0] || '';
    }

    if (!data.soNum) {
        data.soNum = data.details['SERVICE ORDER'] || data.details['SOD'] || data.hiddenInfo['BB'] || '';
    }

    // Final Data Validation for Monitor
    const foundCount = Object.keys(data.details).length + data.materialDetails.length;
    updateLocalDiagnostics(foundCount, activeContext);

    // CRITICAL: Always save to local storage so Data Monitor works
    if (chrome.runtime?.id) {
        chrome.storage.local.set({ lastScraped: data });
    }

    // 8. ERP Sync Restriction Logic
    if (data.soNum) {
        const serviceType = (data.details['SERVICE TYPE'] || data.details['TYPE'] || '').toUpperCase();
        const packageInfo = (data.details['PACKAGE'] || '').toUpperCase();
        const isBroadband = serviceType.includes('BROADBAND') || serviceType.includes('BB-INTERNET') || packageInfo.includes('BROADBAND') || packageInfo.includes('BB');

        if (isBroadband) {
            updateIndicator('RESTRICTED (BB)', '#f59e0b');
            return data;
        }

        if (data.activeTab === 'IMAGES' || data.activeTab === 'PHOTOS') {
            updateIndicator('ACTIVE (SKIP TAB)', '#94a3b8');
            return data;
        }

        pushToERP(data);
    }

    return data;
}

async function pushToERP(data) {
    const currentHash = JSON.stringify({ details: data.details, team: data.teamDetails, materials: data.materialDetails, voice: data.voiceTest });
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
        dot.style.boxShadow = `0 0 8px ${color}`;
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
    const banner = document.createElement('div'); banner.id = 'slt-erp-indicator';
    banner.style.cssText = `position: fixed; top: 10px; right: 20px; z-index: 2147483647; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(8px); color: #fff; padding: 6px 14px; font-family: sans-serif; font-size: 11px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 8px; pointer-events: none; transition: all 0.3s ease;`;
    banner.innerHTML = `<div style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e;" id="slt-erp-status-dot"></div><span id="slt-erp-status-tag" style="letter-spacing: 0.02em;">SLT BRIDGE v${CURRENT_VERSION}</span>`;
    document.body.appendChild(banner);
}

let timeout;
const observer = new MutationObserver(() => {
    if (!chrome.runtime?.id) { observer.disconnect(); return; }
    clearTimeout(timeout); timeout = setTimeout(scrape, 1000);
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true });
try { scrape(); } catch (e) { }
