/**
 * SLT-ERP Bridge (manifest-driven version)
 * Content Script: SLT Portal Scraper
 * - Debounced MutationObserver (no duplicate setInterval)
 * - Consistent naming
 * - Version aligned
 */

const BRIDGE_VERSION = chrome.runtime.getManifest().version;

console.log(`%c[SLT-BRIDGE] v${BRIDGE_VERSION} Engaged`, 'color: #8b5cf6; font-weight: bold; font-size: 14px;');

const BRIDGE_CONFIG = {
    IDENTIFIERS: {
        CYAN_RANGE: { r: [0, 200], g: [100, 255], b: [100, 255] },
        MATERIAL_KEYWORDS: ['WIRE', 'POLE', 'CABLE', 'SOCKET', 'ONT', 'IPTV', 'ROUT', 'STB', 'SPLITTER', 'CONNECTOR', 'FTTH', 'METER', 'DROP']
    },
    JUNK: [/WELCOME/i, /LOGOUT/i, /CLICK HERE/i, /DASHBOARD/i, /IMPORTANT/i, /WARNING/i, /PENDING/i],
    DEBOUNCE_MS: 500,
    PULSE_RATE: 3000
};

let GLOBAL_RECON = { so: '', tabs: {}, lastHash: '' };
let debounceTimer = null;

// ─── Consent Gate (Chrome Web Store User Data policy) ────────────────
// Portal scraping and every ERP transmission only run after the user has
// affirmatively agreed on consent.html. Withdrawing consent in the popup
// Settings tab stops all collection here on the very next cycle.
async function bridgeHasConsent() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['consentGiven'], (res) => {
            resolve(res.consentGiven === true);
        });
    });
}

// ─── DOM Scanner Utilities ───────────────────────────────────────────
const Scanner = {
    clean: t => t ? t.replace(/\s+/g, ' ').trim() : '',

    extractValue: (el) => {
        if (!el) return '';
        if (el.nodeType === 3) return Scanner.clean(el.textContent);
        if (el.tagName === 'SELECT') return el.options[el.selectedIndex]?.text || '';
        if (el.tagName === 'INPUT') {
            if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? 'on' : 'off';
            return el.value || '';
        }
        if (el.tagName === 'TEXTAREA') return el.value || '';

        const input = (el.nodeType === 1 && typeof el.querySelector === 'function')
            ? el.querySelector('input, select, textarea')
            : null;
        if (input) return Scanner.extractValue(input);

        return Scanner.clean(el.innerText || el.textContent || '');
    },

    isKey: (el) => {
        if (!el || el.closest('#bridge-hud')) return false;

        const text = Scanner.clean(el.innerText || '').toUpperCase();
        if (text.length < 2 || text.length > 60) return false;

        const style = window.getComputedStyle(el);
        const color = style.color;
        const m = color.match(/\d+/g);
        let isCyan = false;
        if (m && m.length >= 3) {
            const r = parseInt(m[0]), g = parseInt(m[1]), b = parseInt(m[2]);
            const conf = BRIDGE_CONFIG.IDENTIFIERS.CYAN_RANGE;
            isCyan = r >= conf.r[0] && r <= conf.r[1] &&
                g >= conf.g[0] && g <= conf.g[1] &&
                b >= conf.b[0] && b <= conf.b[1];
        }

        const isBold = parseInt(style.fontWeight) >= 600;
        const hasColon = text.endsWith(':');
        const isLabelTag = el.tagName === 'LABEL';
        const hasLabelClass = el.className && typeof el.className === 'string' && (
            el.className.includes('label') || el.className.includes('field-name') || el.className.includes('form-label')
        );

        const nextEl = el.nextElementSibling;
        const hasInputSibling = nextEl && (
            nextEl.tagName === 'INPUT' || nextEl.tagName === 'SELECT' ||
            nextEl.tagName === 'TEXTAREA' || nextEl.querySelector('input, select, textarea')
        );

        return (isCyan || isBold || hasColon || isLabelTag || hasLabelClass || hasInputSibling);
    },

    queryShadow: (selector, root = document) => {
        const elements = [];
        if (root.querySelectorAll) elements.push(...root.querySelectorAll(selector));
        const allElements = (root === document) ? document.querySelectorAll('*') : root.querySelectorAll('*');
        allElements.forEach(el => {
            if (el.shadowRoot) elements.push(...Scanner.queryShadow(selector, el.shadowRoot));
        });
        return elements;
    }
};

// ─── Main Scan Engine ────────────────────────────────────────────────
class BridgeScanEngine {
    static async scan() {
        const data = { details: {}, materials: [], visuals: [], teamDetails: [], history: [] };

        // 1. Force Discovery: All Inputs (Regular + Shadow DOM)
        const allInputs = Scanner.queryShadow('input:not([type="hidden"]), select')
            .filter(i => !i.closest('#bridge-hud'));

        allInputs.forEach((input, idx) => {
            const val = Scanner.extractValue(input);
            if (!val || BRIDGE_CONFIG.JUNK.some(p => p.test(val))) return;

            let label = "";
            let current = input;

            for (let i = 0; i < 5; i++) {
                if (!current) break;
                const sibs = Array.from(current.parentElement?.children || []);
                const found = sibs.find(s => s !== current && Scanner.isKey(s));
                if (found) {
                    label = Scanner.clean(found.innerText).replace(':', '').toUpperCase();
                    break;
                }
                current = current.parentElement;
            }

            if (label && val) {
                data.details[label] = val;

                const isMatLabel = BRIDGE_CONFIG.IDENTIFIERS.MATERIAL_KEYWORDS.some(k => label.includes(k));
                if (isMatLabel) {
                    const nextInput = allInputs[idx + 1];
                    if (nextInput) {
                        const nextVal = Scanner.extractValue(nextInput);
                        if (nextVal && !isNaN(parseFloat(nextVal))) {
                            data.materials.push({ ITEM: label, TYPE: val, QTY: nextVal });
                        }
                    }
                }
            }
        });

        // 2. Dynamic Grid Discovery
        document.querySelectorAll('.row, tr, div[style*="display: flex"]').forEach(container => {
            const labels = Array.from(container.querySelectorAll('label, .text-cyan, span'))
                .map(l => Scanner.clean(l.innerText).toUpperCase());

            const hasUnit = labels.some(l => l.includes('UNIT DESIGNATOR'));
            const hasQty = labels.some(l => l.includes('QUANTITY'));

            if (hasUnit && hasQty) {
                const inputs = Array.from(container.querySelectorAll('input, select, .form-control'))
                    .filter(i => i.type !== 'hidden' && window.getComputedStyle(i).display !== 'none');

                if (inputs.length >= 2) {
                    const unitVal = Scanner.extractValue(inputs[0]);
                    const qtyVal = Scanner.extractValue(inputs[1]);

                    if (unitVal && unitVal !== 'SELECT MATERIAL ...' && qtyVal) {
                        data.materials.push({ ITEM: 'GRID_MATERIAL', TYPE: unitVal, QTY: qtyVal });
                    }
                }
            }
        });

        // 3. Forensic Photo Audit Capture
        const auditItems = [];
        Scanner.queryShadow('div, td, span, b, label').forEach(el => {
            if (el.closest('#bridge-hud')) return;
            const text = Scanner.clean(el.innerText);
            const parentText = Scanner.clean(el.parentElement?.innerText || "");

            if (parentText.includes('UUID:') && (parentText.includes('Uploaded') || parentText.includes('Missing'))) {
                if (text && !text.includes('UUID:') && !text.includes('Uploaded') && !text.includes('Missing') && text.length < 50) {
                    const status = parentText.includes('Uploaded') ? 'UPLOADED' : 'MISSING';
                    const uuidMatch = parentText.match(/UUID:\s*(\d+)/);
                    const uuid = uuidMatch ? uuidMatch[1] : "";

                    const exists = auditItems.find(a => a.name === text);
                    if (!exists) auditItems.push({ name: text, status, uuid });
                }
            }
        });
        data.forensicAudit = auditItems;

        // 4. Specialized Key-Value Capture
        const forensicTargets = ['SERIAL', 'NUMBER', 'VOICE', 'TEST', 'TEAM', 'ASSIGN', 'IPTV_CPE', 'ONT_ROUTER'];
        Scanner.queryShadow('div, td, span, b, label').forEach(el => {
            if (el.closest('#bridge-hud')) return;
            const text = Scanner.clean(el.innerText).toUpperCase();

            if (forensicTargets.some(k => text.includes(k)) && text.length < 100) {
                let val = "";
                let next = el.nextElementSibling;
                if (!next && el.parentElement) next = el.parentElement.nextElementSibling;

                if (next) {
                    val = Scanner.extractValue(next);
                    if (val && val !== text && val.length > 2 && val.length < 200) {
                        data.details[text.replace(/\s+/g, '_')] = val;
                    }
                }
            }
        });

        // 4b. Order Header Plain Text Capture (SLT portal renders these as non-input text)
        const ORDER_HEADER_FIELDS = [
            'RTOM', 'LEA', 'CON_RTOM', 'CON_CUS_NAME', 'CUS_NAME', 'CUSTOMER NAME',
            'ADDRE', 'ADDRESS', 'CON_TEC_CONTACT', 'CONTACT NO', 'CONTACT NUMBER',
            'CON_STATUS', 'STATUS', 'RECEIVED DATE', 'STATUS DATE', 'STATUSDATE',
            'CIRCUIT', 'VOICE NUMBER', 'VOICENUMBER', 'PRIMARY',
            'ORDER TYPE', 'ORDER_TYPE', 'S_TYPE', 'SERVICE TYPE', 'SERVICE',
            'PKG', 'PACKAGE', 'CON_NAME', 'CONTRACTOR', 'CONTRACTOR NAME'
        ];
        Scanner.queryShadow('div, td, span, b, label, p, strong, em').forEach(el => {
            if (el.closest('#bridge-hud')) return;
            const text = Scanner.clean(el.innerText).toUpperCase();
            if (text.length < 2 || text.length > 60) return;
            const normalizedText = text.replace(/[:\s]+$/, '').trim();
            const isHeaderField = ORDER_HEADER_FIELDS.some(f =>
                normalizedText === f || normalizedText === f.replace(/_/g, ' ') ||
                normalizedText === f.replace(/_/g, ' ') + ':' || normalizedText === f + ':'
            );
            if (!isHeaderField) return;
            let val = '';
            let next = el.nextElementSibling;
            if (!next && el.parentElement) {
                const parentNext = el.parentElement.nextElementSibling;
                if (parentNext && parentNext.tagName !== 'LABEL') next = parentNext;
            }
            if (next) {
                val = Scanner.extractValue(next);
                if (!val || val === normalizedText || val.length < 1 || val.length > 300) return;
                // Adjacent-label leak guard: the captured "value" is itself one of
                // the portal's field labels (CIRCUIT -> 'STATUS', ORDER TYPE -> 'LINE TYPE')
                // or a UI section/tab title (RTOM -> 'SERVICE ORDER').
                const UI_LABELS = ['SERVICE ORDER', 'MATERIALS', 'MATERIALS REGISTRY', 'HISTORY', 'EQUIPMENT CLASS', 'ATTRIBUTE NAME DEFAULT VALUE', 'NUMBER OF POLES', 'LINE TYPE', 'TEST TYPE'];
                const valUpper = val.toUpperCase().replace(/[:\s]+$/, '').trim();
                const isLeakedLabel = ORDER_HEADER_FIELDS.some(f => valUpper === f || valUpper === f.replace(/_/g, ' ')) ||
                    UI_LABELS.includes(valUpper);
                if (isLeakedLabel) return;
            }
            if (val) {
                const key = normalizedText.replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_');
                if (!data.details[key]) data.details[key] = val;
            }
        });

        // 4c. Portal URL status: sod_details URLs embed the real status token
        // (?sod=<SO>_<STATUS>_<ledgerId>_FTTH). The DOM label-value pairing on
        // these pages is unreliable, so prefer the URL when CON_STATUS is absent.
        const urlStatusMatch = window.location.href.match(/sod=[A-Z0-9]+_([A-Z_]+)_\d+/i);
        if (urlStatusMatch && !data.details['CON_STATUS']) {
            data.details['CON_STATUS'] = urlStatusMatch[1].toUpperCase();
        }

        // 5. Advanced Table Scraper
        document.querySelectorAll('table').forEach(table => {
            if (table.closest('#bridge-hud')) return;

            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length < 2) return;

            const headerCells = Array.from(rows[0].querySelectorAll('th, td'));
            let headers = headerCells.map(h => Scanner.clean(h.innerText).toUpperCase());

            if (headers.length === 0 || headers.every(h => h === '')) {
                const cellCount = rows[0].querySelectorAll('td').length;
                headers = Array.from({ length: cellCount }, (_, i) => `COL_${i}`);
            }

            const isMaterialTable = headers.some(h =>
                h.includes('ITEM') || h.includes('MATERIAL') || h.includes('QTY') ||
                h.includes('QUANTITY') || h.includes('UNIT') || h.includes('DESCRIPTION')
            );
            const isTeamTable = headers.some(h =>
                h.includes('TEAM') || h.includes('NAME') || h.includes('ASSIGNED') || h.includes('TECH')
            );
            const isHistoryTable = headers.some(h =>
                h.includes('DATE') || h.includes('STATUS') || h.includes('REMARKS') || h.includes('COMMENT')
            );

            rows.slice(1).forEach((row) => {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells.length < 2) return;

                const rowData = {};
                cells.forEach((cell, idx) => {
                    if (headers[idx]) rowData[headers[idx]] = Scanner.extractValue(cell);
                });

                if (isMaterialTable) {
                    const itemName = rowData['ITEM'] || rowData['DESCRIPTION'] || rowData['MATERIAL'] || rowData['COL_1'];
                    const qty = rowData['QTY'] || rowData['QUANTITY'] || rowData['COL_2'];
                    const unit = rowData['UNIT'] || rowData['UOM'] || '';
                    if (itemName && qty) {
                        data.materials.push({ ITEM: 'TABLE_MAT', TYPE: itemName, QTY: qty, UNIT: unit, RAW: rowData });
                    }
                } else if (isTeamTable) {
                    data.teamDetails.push(rowData);
                } else if (isHistoryTable) {
                    data.history.push(rowData);
                } else {
                    const keyCol = cells[0];
                    const valCol = cells[1];
                    if (keyCol && valCol) {
                        const key = Scanner.clean(keyCol.innerText).replace(':', '').toUpperCase();
                        const val = Scanner.extractValue(valCol);
                        if (key && val) data.details[key] = val;
                    }
                }
            });
        });

        // 6. Scrape hidden sections (temporarily reveal)
        document.querySelectorAll('.tab-pane, .accordion-collapse, .collapse, [style*="display: none"]').forEach(section => {
            if (section.closest('#bridge-hud')) return;
            const originalDisplay = section.style.display;
            section.style.display = 'block';

            section.querySelectorAll('input, select, textarea').forEach(input => {
                const val = Scanner.extractValue(input);
                if (val && !BRIDGE_CONFIG.JUNK.some(p => p.test(val))) {
                    let label = input.getAttribute('name') || input.getAttribute('id') || 'HIDDEN_FIELD';
                    const labelEl = document.querySelector(`label[for="${input.id}"]`);
                    if (labelEl) label = Scanner.clean(labelEl.innerText).replace(':', '');
                    data.details[`${label.toUpperCase()}_HIDDEN`] = val;
                }
            });

            section.style.display = originalDisplay;
        });

        // 7. Data attributes
        document.querySelectorAll('[data-value], [data-field], [data-so]').forEach(el => {
            if (el.closest('#bridge-hud')) return;
            const fieldName = el.getAttribute('data-field') || el.getAttribute('name') || 'DATA_ATTR';
            const fieldValue = el.getAttribute('data-value') || el.textContent;
            if (fieldValue?.trim()) data.details[`DATA_${fieldName.toUpperCase()}`] = fieldValue.trim();
        });

        return data;
    }

    static getTab() {
        const url = window.location.href;
        if (url.includes('materials')) return 'MATERIALS';
        if (url.includes('voice')) return 'VOICE_TEST';
        if (url.includes('serial')) return 'SERIALS';
        if (url.includes('team')) return 'TEAM';

        const t = document.querySelector('.active a, .nav-link.active, .current-tab');
        return t ? Scanner.clean(t.innerText || t.textContent).toUpperCase() : 'GENERAL';
    }
}

// ─── Manual Scrape Mode ──────────────────────────────────────────────
let manualScrapeMode = false;

function enableManualScrape() {
    manualScrapeMode = true;
    document.body.style.cursor = 'crosshair';

    const clickHandler = (e) => {
        if (!manualScrapeMode) return;
        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        const scrapedData = {
            tag: target.tagName,
            id: target.id,
            class: target.className,
            text: target.innerText?.substring(0, 100),
            value: target.value || target.textContent?.trim(),
            dataAttrs: {}
        };

        for (let attr of target.attributes) {
            if (attr.name.startsWith('data-')) scrapedData.dataAttrs[attr.name] = attr.value;
        }

        chrome.storage.local.get(['manualScrapes'], (res) => {
            const existing = res.manualScrapes || [];
            existing.push({ soNum: GLOBAL_RECON.so, timestamp: new Date().toISOString(), data: scrapedData });
            chrome.storage.local.set({ manualScrapes: existing });
            orchestrate();
        });

        const highlight = document.createElement('div');
        highlight.style.cssText = `position:fixed;left:${e.clientX - 25}px;top:${e.clientY - 25}px;width:50px;height:50px;border:3px solid #10b981;border-radius:50%;pointer-events:none;z-index:99999;animation:bridge-ping 0.8s ease-out forwards;`;
        document.body.appendChild(highlight);
        setTimeout(() => highlight.remove(), 800);

        manualScrapeMode = false;
        document.body.style.cursor = 'default';
        document.removeEventListener('click', clickHandler, true);

        const indicator = document.getElementById('bridge-manual-indicator');
        if (indicator) indicator.style.display = 'none';
    };

    document.addEventListener('click', clickHandler, true);

    const indicator = document.getElementById('bridge-manual-indicator');
    if (indicator) indicator.style.display = 'inline';
}

// ─── Orchestrator (Debounced) ────────────────────────────────────────
async function orchestrate() {
    if (!chrome.runtime?.id) return;
    // Consent gate: do not scrape portal pages or push data before consent.
    if (!(await bridgeHasConsent())) {
        const hudStatus = document.querySelector('#bridge-hud #bridge-status');
        if (hudStatus && !hudStatus.dataset.consentShown) {
            hudStatus.dataset.consentShown = '1';
            hudStatus.innerText = 'SLT-BRIDGE [CONSENT REQUIRED - OPEN POPUP]';
        }
        return;
    }
    const url = window.location.href;
    const soMatch = url.match(/[?&]sod=([A-Z0-9]+)/i);
    const soNum = soMatch ? soMatch[1].toUpperCase() : '';
    if (!soNum) return;

    if (soNum !== GLOBAL_RECON.so) {
        const stored = await new Promise(r => chrome.storage.local.get([`sod_${soNum}`], r));
        GLOBAL_RECON.so = soNum;
        GLOBAL_RECON.tabs = stored[`sod_${soNum}`] || {};
    }

    const currentTab = BridgeScanEngine.getTab();
    const captured = await BridgeScanEngine.scan();

    if (Object.keys(captured.details).length > 0 || captured.materials.length > 0) {
        GLOBAL_RECON.tabs[currentTab] = { ...(GLOBAL_RECON.tabs[currentTab] || {}), ...captured.details };

        if (captured.materials.length > 0) {
            if (!GLOBAL_RECON.tabs['MATERIALS_REGISTRY']) GLOBAL_RECON.tabs['MATERIALS_REGISTRY'] = [];
            captured.materials.forEach(m => {
                const exists = GLOBAL_RECON.tabs['MATERIALS_REGISTRY'].find(x => x.ITEM === m.ITEM && x.TYPE === m.TYPE);
                if (!exists) GLOBAL_RECON.tabs['MATERIALS_REGISTRY'].push(m);
            });
        }
    }

    const payload = {
        url, soNum, activeTab: currentTab, timestamp: new Date().toISOString(),
        details: captured.details,
        allTabs: GLOBAL_RECON.tabs,
        teamDetails: {
            'SELECTED TEAM': Scanner.extractValue(document.querySelector('#mobusr')),
            'LIST': captured.teamDetails || []
        },
        materialDetails: GLOBAL_RECON.tabs['MATERIALS_REGISTRY'] || [],
        history: captured.history || [],
        forensicAudit: captured.forensicAudit || [],
        currentUser: Scanner.clean(document.querySelector('.user-profile-dropdown h6, #user_name')?.innerText || "").replace("Welcome, ", "")
    };

    chrome.storage.local.set({ lastScraped: payload, [`sod_${soNum}`]: GLOBAL_RECON.tabs });

    const hash = JSON.stringify(GLOBAL_RECON.tabs) + JSON.stringify(payload.materialDetails) + JSON.stringify(payload.history) + JSON.stringify(payload.forensicAudit);
    const currentHash = hash.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString();

    if (currentHash !== GLOBAL_RECON.lastHash) {
        GLOBAL_RECON.lastHash = currentHash;
        chrome.runtime.sendMessage({ action: 'pushToERP', data: payload });

        const hud = document.getElementById('bridge-hud');
        if (hud) {
            const count = Object.values(GLOBAL_RECON.tabs).reduce((a, b) => a + (Array.isArray(b) ? b.length : Object.keys(b).length), 0);
            const status = hud.querySelector('#bridge-status');
            if (status) {
                status.innerHTML = `<span style="color:#22c55e">●</span> SLT-BRIDGE <span style="background:#8b5cf6;color:white;padding:0 4px;margin:0 5px">${soNum}</span> [${count} DATA]`;
            }
        }
    }
}

// Debounced orchestrate - called by MutationObserver
function debouncedOrchestrate() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(orchestrate, BRIDGE_CONFIG.DEBOUNCE_MS);
}

// ─── Initialize ──────────────────────────────────────────────────────
// Single MutationObserver with debounce (replaces old setInterval + undebounced observer)
new MutationObserver(debouncedOrchestrate).observe(document.body, { childList: true, subtree: true });

// Fallback pulse only when MutationObserver can't catch static pages
setInterval(orchestrate, BRIDGE_CONFIG.PULSE_RATE);

// Initial scan
orchestrate();

// ─── HUD Overlay ─────────────────────────────────────────────────────
if (!document.getElementById('bridge-hud')) {
    const style = document.createElement('style');
    style.innerHTML = `@keyframes bridge-ping { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }`;
    document.head.appendChild(style);

    const h = document.createElement('div');
    h.id = 'bridge-hud';
    h.style.cssText = `position: fixed; top: 10px; right: 10px; z-index: 10000; background: rgba(15,23,42,0.9); color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; font-family: 'Inter', sans-serif; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(8px); display: flex; align-items: center; pointer-events: none; transition: 0.3s;`;

    h.innerHTML = `
        <span style="display:inline-block; width:8px; height:8px; background:#22c55e; border-radius:50%; margin-right:6px; box-shadow:0 0 6px #22c55e;"></span>
        <span id="bridge-status">SLT-BRIDGE</span>
        <span id="bridge-manual-indicator" style="display:none; color:#fbbf24; margin-left:8px;">[MANUAL]</span>
        <button id="bridge-manual-btn" style="margin-left:8px; background:#8b5cf6; border:none; color:white; border-radius:4px; cursor:pointer; padding:2px 8px; font-size:12px; pointer-events:auto; transition:0.2s;">+</button>
    `;

    document.body.appendChild(h);

    const btn = h.querySelector('#bridge-manual-btn');
    if (btn) {
        btn.onclick = (e) => { e.stopPropagation(); enableManualScrape(); };
        btn.onmouseover = () => btn.style.background = '#7c3aed';
        btn.onmouseout = () => btn.style.background = '#8b5cf6';
    }
}

// ─── BOM Sync System ─────────────────────────────────────────────────
function initializeBOMSyncSystem() {
    if (!window.location.href.includes('/contr/bom_list')) return;
    if (document.getElementById('bom-sync-style')) return;

    // Consent gate: BOM rows are order data transmitted to the ERP - do not
    // inject sync controls until the user has consented.
    bridgeHasConsent().then((ok) => { if (ok) bootBOMSync(); });

    function bootBOMSync() {

    const style = document.createElement('style');
    style.id = 'bom-sync-style';
    style.innerHTML = `
        .bridge-sync-btn {
            background-color: #10b981 !important; color: white !important; border: none !important;
            border-radius: 4px !important; padding: 4px 8px !important; font-size: 10px !important;
            font-weight: bold !important; cursor: pointer !important; margin-left: 6px !important;
            transition: all 0.2s ease !important;
        }
        .bridge-sync-btn:hover { background-color: #059669 !important; transform: scale(1.05) !important; }
        .bridge-sync-btn:disabled { background-color: #6b7280 !important; cursor: not-allowed !important; }
        .bridge-status-badge {
            font-size: 9px !important; font-weight: bold !important; padding: 2px 6px !important;
            border-radius: 4px !important; margin-left: 6px !important; display: inline-block !important;
        }
        .bridge-status-success { background-color: #d1fae5 !important; color: #065f46 !important; }
        .bridge-status-fail { background-color: #fee2e2 !important; color: #991b1b !important; }
    `;
    document.head.appendChild(style);

    function enrichRows() {
        document.querySelectorAll('table tbody tr').forEach(row => {
            if (row.querySelector('.bridge-sync-btn') || row.querySelector('.bridge-status-badge')) return;

            const tds = row.querySelectorAll('td');
            if (tds.length < 4) return;

            const actionTd = tds[3];
            const downloadBtn = actionTd.querySelector('button, a');
            if (!downloadBtn) return;

            const onclickAttr = downloadBtn.getAttribute('onclick') || '';
            const match = onclickAttr.match(/bomDwnload\('([^']+)'\)/);
            const bomPath = match ? match[1] : tds[0].innerText.trim();
            if (!bomPath) return;

            const syncBtn = document.createElement('button');
            syncBtn.className = 'bridge-sync-btn';
            syncBtn.innerText = 'Sync to ERP';
            syncBtn.type = 'button';

            syncBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                syncBtn.disabled = true;
                syncBtn.innerText = 'Downloading...';

                try {
                    const cleanPath = bomPath.trim().replace(/\//g, '-');
                    const res = await fetch(`https://serviceportal.slt.lk/iShamp/files/${cleanPath}.csv`);
                    if (!res.ok) throw new Error(`Download Failed (HTTP ${res.status})`);

                    const csvText = await res.text();
                    syncBtn.innerText = 'Syncing...';

                    const stored = await new Promise(r => chrome.storage.local.get(['erpOrigin'], r));
                    const origin = stored.erpOrigin || 'https://sltserp.vercel.app';
                    const extensionKey = await new Promise(r => chrome.storage.local.get(['extensionKey'], r)).then(res => res.extensionKey || '');

                    const headers = { 'Content-Type': 'application/json' };
                    if (extensionKey) headers['x-extension-key'] = extensionKey;

                    const erpRes = await fetch(`${origin}/api/invoices/import-bom/csv`, {
                        method: 'POST', headers, body: JSON.stringify({ csvText, bomPath })
                    });

                    const erpResult = await erpRes.json();
                    if (!erpRes.ok) throw new Error(erpResult.message || 'ERP sync error');

                    syncBtn.remove();
                    const badge = document.createElement('span');
                    badge.className = 'bridge-status-badge bridge-status-success';
                    badge.innerText = `Synced (${erpResult.clientInvoiceNumber || 'OK'})`;
                    actionTd.appendChild(badge);
                } catch (err) {
                    syncBtn.disabled = false;
                    syncBtn.innerText = 'Sync to ERP';
                    const errLabel = document.createElement('span');
                    errLabel.className = 'bridge-status-badge bridge-status-fail';
                    errLabel.innerText = 'Failed';
                    errLabel.title = err?.message || 'Unknown error';
                    actionTd.appendChild(errLabel);
                    setTimeout(() => errLabel.remove(), 4000);
                }
            };

            actionTd.appendChild(syncBtn);
        });
    }

    function addPageSyncButton() {
        if (document.getElementById('bridge-page-sync-btn')) return;

        const container = document.querySelector('.card-header, .box-header, .panel-heading') || document.body;

        const pageSyncBtn = document.createElement('button');
        pageSyncBtn.id = 'bridge-page-sync-btn';
        pageSyncBtn.style.cssText = `float: right; background-color: #8b5cf6; color: white; border: none; border-radius: 6px; padding: 6px 12px; font-size: 11px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s ease;`;
        pageSyncBtn.innerText = 'Sync Page BOMs to ERP';

        pageSyncBtn.onclick = async () => {
            pageSyncBtn.disabled = true;
            pageSyncBtn.innerText = 'Syncing List...';

            try {
                const boms = [];
                document.querySelectorAll('table tbody tr').forEach(row => {
                    const tds = row.querySelectorAll('td');
                    if (tds.length < 3) return;

                    const downloadBtn = tds[3]?.querySelector('button, a');
                    const onclickAttr = downloadBtn?.getAttribute('onclick') || '';
                    const match = onclickAttr.match(/bomDwnload\('([^']+)'\)/);
                    const path = match ? match[1] : tds[0].innerText.trim();

                    if (tds[0].innerText.trim()) {
                        boms.push({ bomRef: tds[0].innerText.trim(), rtom: tds[1].innerText.trim(), contractor: tds[2].innerText.trim(), path });
                    }
                });

                if (boms.length === 0) throw new Error('No BOM rows detected.');

                const stored = await new Promise(r => chrome.storage.local.get(['erpOrigin'], r));
                const origin = stored.erpOrigin || 'https://sltserp.vercel.app';
                const extensionKey = await new Promise(r => chrome.storage.local.get(['extensionKey'], r)).then(res => res.extensionKey || '');

                const headers = { 'Content-Type': 'application/json' };
                if (extensionKey) headers['x-extension-key'] = extensionKey;

                const res = await fetch(`${origin}/api/invoices/slt-registry`, {
                    method: 'POST', headers, body: JSON.stringify(boms)
                });

                if (!res.ok) throw new Error('Failed to update ERP registry');

                pageSyncBtn.style.backgroundColor = '#10b981';
                pageSyncBtn.innerText = 'List Synced!';
                setTimeout(() => {
                    pageSyncBtn.disabled = false;
                    pageSyncBtn.style.backgroundColor = '#8b5cf6';
                    pageSyncBtn.innerText = 'Sync Page BOMs to ERP';
                }, 3000);
            } catch (err) {
                alert('BOM List Sync Error: ' + (err?.message || 'Unknown error'));
                pageSyncBtn.disabled = false;
                pageSyncBtn.innerText = 'Sync Page BOMs to ERP';
            }
        };

        if (container === document.body) {
            pageSyncBtn.style.position = 'fixed';
            pageSyncBtn.style.bottom = '20px';
            pageSyncBtn.style.right = '80px';
            pageSyncBtn.style.zIndex = '9999';
        }

        container.appendChild(pageSyncBtn);
    }

    setInterval(() => { enrichRows(); addPageSyncButton(); }, 1500);
    enrichRows();
    addPageSyncButton();
    } // bootBOMSync
}

initializeBOMSyncSystem();
