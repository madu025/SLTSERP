// Comprehensive Scraper for SLT i-Shamp Portal v1.1.5
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

    // 4. Core Info Scraper (Label and Next Value)
    const labels = document.querySelectorAll('label');
    labels.forEach(l => {
        const text = clean(l.innerText).toUpperCase();
        if (l.style.color === 'rgb(13, 202, 240)' || l.style.color === '#0dcaf0') {
            const valNode = l.nextElementSibling?.nextElementSibling;
            if (valNode && valNode.tagName === 'LABEL') {
                data.details[text] = clean(valNode.innerText);
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
    const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, b, strong, td, label, div, span');

    allElements.forEach(el => {
        const text = el.innerText.toUpperCase();
        if (text.includes('VOICE TEST') || text.includes('V-TEST')) {
            // Find the nearest container following this text header
            let next = el;
            let containerFound = null;

            // Look ahead to find a table or a data container
            for (let i = 0; i < 8; i++) {
                if (!next) break;

                // Priority 1: Table
                if (next.tagName === 'TABLE') {
                    containerFound = next;
                    break;
                }
                const innerTable = next.querySelector('table');
                if (innerTable) {
                    containerFound = innerTable;
                    break;
                }

                // Priority 2: List-like structure (divs with labels)
                if (next.querySelectorAll('.row, .form-group').length > 1) {
                    containerFound = next;
                    // don't break yet, maybe a table is nearby
                }

                next = next.nextElementSibling || next.parentElement?.nextElementSibling;
            }

            if (containerFound) {
                const foundData = {};
                if (containerFound.tagName === 'TABLE') {
                    const rows = containerFound.querySelectorAll('tr');
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td, th');
                        if (cells.length >= 2) {
                            const key = clean(cells[0].innerText).replace(':', '').trim();
                            const val = clean(cells[1].innerText).trim();
                            if (key && key.length < 50 && val) {
                                foundData[key] = val;
                            }
                        }
                    });
                } else {
                    // Method A: Row/Column Grid (Labels in one Row, Values in another)
                    const gridRows = containerFound.querySelectorAll('.row');
                    let gridSuccess = false;

                    if (gridRows.length >= 2) {
                        const headerCols = gridRows[0].querySelectorAll('[class*="col-"]');
                        const valueCols = gridRows[1].querySelectorAll('[class*="col-"]');

                        if (headerCols.length > 0 && valueCols.length > 0) {
                            headerCols.forEach((hCol, idx) => {
                                const key = clean(hCol.innerText).toUpperCase();
                                const vCol = valueCols[idx];
                                if (key && key.length < 50 && vCol) {
                                    const val = clean(vCol.innerText);
                                    if (val) {
                                        foundData[key] = val;
                                        gridSuccess = true;
                                    }
                                }
                            });
                        }
                    }

                    // Method B: Label/Value sibling pairs (Fallback or Parallel)
                    if (!gridSuccess) {
                        const pairs = containerFound.querySelectorAll('label, b, strong, span');
                        pairs.forEach(p => {
                            const pText = clean(p.innerText).replace(':', '');
                            if (pText.length > 2 && pText.length < 50) {
                                const val = clean(p.nextSibling?.textContent || p.nextElementSibling?.innerText || '');
                                if (val && val.length < 100) {
                                    foundData[pText.toUpperCase()] = val;
                                }
                            }
                        });
                    }
                }

                // If this is the "LATEST" voice test, or if we haven't found any yet, update
                if (text.includes('LATEST') || Object.keys(data.voiceTest).length === 0) {
                    data.voiceTest = { ...data.voiceTest, ...foundData };
                }
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
                if (tag.textContent === 'SYNC OK') tag.textContent = 'SLT BRIDGE v1.1.5';
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
        <span id="slt-erp-status-tag" style="letter-spacing: 0.02em;">SLT BRIDGE v1.1.5</span>
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
