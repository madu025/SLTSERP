// Comprehensive Scraper for SLT i-Shamp Portal v1.2.2
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

    // 4. Universal Info Scraper (Finds all Cyan-themed labels and their values)
    const allLabels = document.querySelectorAll('label, b, strong, span');
    allLabels.forEach(l => {
        const style = window.getComputedStyle(l);
        const color = style.color;
        const isCyan = color === 'rgb(13, 202, 240)' || color === 'rgb(0, 202, 240)' || color.includes('0dcaf0');

        if (isCyan) {
            const key = clean(l.innerText).toUpperCase();
            if (!key || key.length > 50 || key.includes('VOICE TEST') || key === 'LATEST') return;

            // Look for value: 1. Next sibling
            let val = '';
            let next = l.nextElementSibling || l.nextSibling;

            // Skip text nodes that are just whitespace
            while (next && next.nodeType === 3 && !next.textContent.trim()) next = next.nextSibling;

            if (next) {
                val = clean(next.textContent || next.innerText);
            }

            // 2. If no sibling, check parent's next elements (for grids)
            if (!val || val === key) {
                const parent = l.parentElement;
                const grandParent = parent?.parentElement;

                // Try sibling of parent
                if (parent?.nextElementSibling) {
                    val = clean(parent.nextElementSibling.innerText);
                }

                // Try sibling of grandparent (multi-row grids)
                if ((!val || val === key) && grandParent?.classList.contains('row')) {
                    const rowIdx = Array.from(grandParent.parentElement.children).indexOf(grandParent);
                    const nextRow = grandParent.parentElement.children[rowIdx + 1];
                    if (nextRow) {
                        const colIdx = Array.from(grandParent.children).indexOf(parent);
                        const targetCol = nextRow.children[colIdx];
                        if (targetCol) val = clean(targetCol.innerText);
                    }
                }
            }

            if (val && val !== key && val.length < 500) {
                data.details[key] = val;
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

    // 7. Robust Voice Test Details Scraper
    data.voiceTest = {};
    const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, b, strong, td, label, div, span, a');

    const isCyanColor = (color) => {
        if (!color) return false;
        // Exact matches
        if (color === 'rgb(13, 202, 240)' || color === 'rgb(0, 202, 240)' || color.includes('0dcaf0')) return true;
        // Fuzzy match for Cyan-like (High Blue, High Green, Lower Red)
        const parts = color.match(/\d+/g);
        if (parts && parts.length >= 3) {
            const r = parseInt(parts[0]);
            const g = parseInt(parts[1]);
            const b = parseInt(parts[2]);
            return b > 200 && g > 150 && r < 100; // Cyanish
        }
        return false;
    };

    allElements.forEach(el => {
        const text = clean(el.innerText).toUpperCase();
        if (/VOICE\s*TEST|V-TEST|V\s*TEST/i.test(text)) {
            console.log('🔍 [SLT-BRIDGE] Voice Test Header found:', text);
            let containerFound = el.closest('.card') || el.closest('.container') || el.parentElement?.closest('div');

            if (containerFound) {
                console.log('📦 [SLT-BRIDGE] Container identified for scraping:', containerFound);
                const foundData = {};
                // Strategy A: Find all Blue-ish labels
                const possibleLabels = containerFound.querySelectorAll('label, b, strong, span');
                possibleLabels.forEach(l => {
                    const color = window.getComputedStyle(l).color;
                    if (isCyanColor(color) || /DATE|TIME|TEST|DURATION|TYPE|RESULT/i.test(l.innerText)) {
                        const key = clean(l.innerText).toUpperCase();
                        if (!key || key.length > 50 || key === 'LATEST') return;

                        let val = '';
                        // Find Value: 
                        // 1. Next sibling
                        let sib = l.nextElementSibling || l.nextSibling;
                        while (sib && sib.nodeType === 3 && !sib.textContent.trim()) sib = sib.nextSibling;
                        if (sib && sib.innerText && clean(sib.innerText) !== key) {
                            val = clean(sib.innerText);
                        }

                        // 2. Grid Position
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
                            console.log(` ✨ [SLT-BRIDGE] Found Pair (Strategy A): [${key}] = [${val}]`);
                            foundData[key] = val;
                        }
                    }
                });

                // Strategy B: If still empty, Brute Force the rows
                if (Object.keys(foundData).length === 0) {
                    console.log('⚠️ [SLT-BRIDGE] Strategy A found nothing. Attempting Strategy B (Brute Force Rows)...');
                    const rows = Array.from(containerFound.querySelectorAll('.row'));
                    if (rows.length >= 2) {
                        const labels = Array.from(rows[0].querySelectorAll('div[class*="col-"]'));
                        const values = Array.from(rows[1].querySelectorAll('div[class*="col-"]'));
                        console.log(` 📊 [SLT-BRIDGE] Brute Force: Found ${labels.length} potential label columns and ${values.length} value columns.`);
                        if (labels.length > 0 && values.length === labels.length) {
                            labels.forEach((l, i) => {
                                const k = clean(l.innerText).toUpperCase();
                                const v = clean(values[i].innerText);
                                if (k && v && k !== v && k.length < 50) {
                                    console.log(` ✨ [SLT-BRIDGE] Found Pair (Strategy B): [${k}] = [${v}]`);
                                    foundData[k] = v;
                                }
                            });
                        }
                    }
                }

                if (Object.keys(foundData).length > 0) {
                    console.log('✅ [SLT-BRIDGE] Voice Test Scraping Successful. Total fields:', Object.keys(foundData).length);
                    if (text.includes('LATEST') || Object.keys(data.voiceTest).length === 0) {
                        data.voiceTest = { ...data.voiceTest, ...foundData };
                    }
                } else {
                    console.warn('❌ [SLT-BRIDGE] Failed to extract any voice test data from container.');
                }
            } else {
                console.warn('❌ [SLT-BRIDGE] Could not find a suitable data container near header.');
            }
        }
    });

    console.log(`[SLT-BRIDGE] Scrape complete. Found ${Object.keys(data.details).length} core fields, ${data.materialDetails.length} materials, ${Object.keys(data.voiceTest).length} voice tests.`);

    // Capture SO Number
    data.soNum = data.details['SERVICE ORDER'] || data.details['SOD'] || data.hiddenInfo['BB'] || '';
    if (!data.soNum) {
        const urlParams = new URLSearchParams(window.location.search);
        data.soNum = urlParams.get('sod')?.split('_')[0] || '';
    }

    const foundCount = Object.keys(data.details).length + data.materialDetails.length;
    updateLocalDiagnostics(foundCount, activeContext);

    if (chrome.runtime?.id) {
        chrome.storage.local.set({ lastScraped: data });
    }

    // Push to ERP (Background Sync)
    if (data.soNum) {
        // Skip sync for specific tabs as requested
        if (data.activeTab === 'IMAGES' || data.activeTab === 'PHOTOS') {
            console.log('ℹ️ [SLT-BRIDGE] Skipping sync for tab:', data.activeTab);
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

    if (!chrome.runtime?.id) return; // Context invalidated

    console.log('🛠️ [SLT-BRIDGE] Requesting background sync for SO:', data.soNum);

    chrome.runtime.sendMessage({ action: 'pushToERP', data }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn('❌ [SLT-BRIDGE] Background sync message failed:', chrome.runtime.lastError.message);
            updateIndicator('BRIDGE ERROR', '#ef4444');
            return;
        }

        if (response && response.success) {
            console.log('✅ [SLT-BRIDGE] Background sync success.');
            lastPushedHash = currentHash;
            updateIndicator('SYNC OK', '#22c55e');
        } else {
            console.warn('❌ [SLT-BRIDGE] Background sync: ERP targets unreachable.');
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
                if (tag.textContent === 'SYNC OK') tag.textContent = 'SLT BRIDGE v1.2.2';
            }, 3000);
        }
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
    banner.style.cssText = `
        position: fixed;
        top: 10px;
        right: 20px;
        z-index: 2147483647;
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(8px);
        color: #fff;
        padding: 6px 14px;
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        font-size: 11px;
        font-weight: 600;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1);
        display: flex;
        align-items: center;
        gap: 8px;
        pointer-events: none;
        transition: all 0.3s ease;
    `;
    banner.innerHTML = `
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e;" id="slt-erp-status-dot"></div>
        <span id="slt-erp-status-tag" style="letter-spacing: 0.02em;">SLT BRIDGE v1.2.2</span>
    `;
    document.body.appendChild(banner);
}

// Debounced observation
let timeout;
const observer = new MutationObserver(() => {
    if (!chrome.runtime?.id) {
        observer.disconnect();
        return;
    }
    clearTimeout(timeout);
    timeout = setTimeout(scrape, 1000);
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true });

scrape();
