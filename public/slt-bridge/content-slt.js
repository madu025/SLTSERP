/**
 * SLT-ERP PHOENIX OMNISCIENT v4.4.3
 * Engine: Dynamic Grid & Multi-Material Recon
 * Role: 100% Coverage SLT Portal Scraper
 */

console.log('%c[i-SHAMP-BRIDGE] v4.4.3 Engaged', 'color: #8b5cf6; font-weight: bold; font-size: 18px;');

const PHOENIX_CONFIG = {
    IDENTIFIERS: {
        CYAN_RANGE: { r: [0, 200], g: [100, 255], b: [100, 255] },
        MATERIAL_KEYWORDS: ['WIRE', 'POLE', 'CABLE', 'SOCKET', 'ONT', 'IPTV', 'ROUT', 'STB', 'SPLITTER', 'CONNECTOR', 'FTTH', 'METER', 'DROP']
    },
    JUNK: [/WELCOME/i, /LOGOUT/i, /CLICK HERE/i, /DASHBOARD/i, /IMPORTANT/i, /WARNING/i, /PENDING/i, /PHOENIX OMNI/i],
    PULSE_RATE: 2000
};

let GLOBAL_RECON = { so: '', tabs: {}, lastHash: '' };

const PhoenixScanner = {
    clean: t => t ? t.replace(/\s+/g, ' ').trim() : '',

    extractValue: (el) => {
        if (!el) return '';
        if (el.nodeType === 3) return PhoenixScanner.clean(el.textContent);
        if (el.tagName === 'SELECT') return el.options[el.selectedIndex]?.text || '';
        if (el.tagName === 'INPUT') {
            if (el.type === 'checkbox' || el.type === 'radio') {
                return el.checked ? 'on' : 'off';
            }
            return el.value || '';
        }
        if (el.tagName === 'TEXTAREA') return el.value || '';

        const input = (el.nodeType === 1 && typeof el.querySelector === 'function')
            ? el.querySelector('input, select, textarea')
            : null;
        if (input) return PhoenixScanner.extractValue(input);

        return PhoenixScanner.clean(el.innerText || el.textContent || '');
    },

    isKey: (el) => {
        if (!el || el.closest('#phoenix-hud')) return false;

        const text = PhoenixScanner.clean(el.innerText || '').toUpperCase();
        if (text.length < 2 || text.length > 60) return false;

        const style = window.getComputedStyle(el);
        const color = style.color;
        const m = color.match(/\d+/g);
        let isCyan = false;
        if (m && m.length >= 3) {
            const r = parseInt(m[0]), g = parseInt(m[1]), b = parseInt(m[2]);
            const conf = PHOENIX_CONFIG.IDENTIFIERS.CYAN_RANGE;
            isCyan = r >= conf.r[0] && r <= conf.r[1] &&
                g >= conf.g[0] && g <= conf.g[1] &&
                b >= conf.b[0] && b <= conf.b[1];
        }

        // Check for common label indicators
        const isBold = parseInt(style.fontWeight) >= 600;
        const hasColon = text.endsWith(':');
        const isLabelTag = el.tagName === 'LABEL';
        const hasLabelClass = el.className && (
            typeof el.className === 'string' && (
                el.className.includes('label') ||
                el.className.includes('field-name') ||
                el.className.includes('form-label')
            )
        );

        // Check position (labels usually come before inputs)
        const nextEl = el.nextElementSibling;
        const hasInputSibling = nextEl && (
            nextEl.tagName === 'INPUT' ||
            nextEl.tagName === 'SELECT' ||
            nextEl.tagName === 'TEXTAREA' ||
            nextEl.querySelector('input, select, textarea')
        );

        return (isCyan || isBold || hasColon || isLabelTag || hasLabelClass || hasInputSibling);
    },

    isShadow: (el) => !!(el.shadowRoot),

    queryShadow: (selector, root = document) => {
        const elements = [];
        // Query regular DOM (if root has querySelectorAll)
        if (root.querySelectorAll) {
            elements.push(...root.querySelectorAll(selector));
        }

        // Query inside shadow roots
        const allElements = (root === document) ? document.querySelectorAll('*') : root.querySelectorAll('*');
        allElements.forEach(el => {
            if (el.shadowRoot) {
                elements.push(...PhoenixScanner.queryShadow(selector, el.shadowRoot));
            }
        });
        return elements;
    }
};

class PhoenixOmniEngine {
    static async scan() {
        const data = { details: {}, materials: [], visuals: [], teamDetails: [], history: [] };

        // 1. Force Discovery: All Inputs (Regular + Shadow DOM)
        const allInputs = PhoenixScanner.queryShadow('input:not([type="hidden"]), select')
            .filter(i => !i.closest('#phoenix-hud'));

        allInputs.forEach((input, idx) => {
            const val = PhoenixScanner.extractValue(input);
            if (!val || PHOENIX_CONFIG.JUNK.some(p => p.test(val))) return;

            // Find nearest Label by hierarchy or proximity
            let label = "";
            let current = input;

            // Look sideways and up for Cyan labels
            for (let i = 0; i < 5; i++) {
                if (!current) break;
                // Check siblings
                const sibs = Array.from(current.parentElement?.children || []);
                const found = sibs.find(s => s !== current && PhoenixScanner.isKey(s));
                if (found) {
                    label = PhoenixScanner.clean(found.innerText).replace(':', '').toUpperCase();
                    break;
                }
                current = current.parentElement;
            }

            if (label && val) {
                data.details[label] = val;

                // Material Intelligence: Linked Pair Capture (Name + Qty)
                const isMatLabel = PHOENIX_CONFIG.IDENTIFIERS.MATERIAL_KEYWORDS.some(k => label.includes(k));
                if (isMatLabel) {
                    // Look for a paired value (e.g., next input if this is item name)
                    const nextInput = allInputs[idx + 1];
                    if (nextInput) {
                        const nextVal = PhoenixScanner.extractValue(nextInput);
                        if (nextVal && !isNaN(parseFloat(nextVal))) {
                            console.log(`[i-SHAMP-MAT] Captured: ${label} -> ${val} (Qty: ${nextVal})`);
                            data.materials.push({ ITEM: label, TYPE: val, QTY: nextVal });
                        }
                    }
                }
            }
        });

        // 1. Dynamic Grid Discovery (Multi-row Materials like Unit Designator/Quantity)
        document.querySelectorAll('.row, tr, div[style*="display: flex"]').forEach(container => {
            const labels = Array.from(container.querySelectorAll('label, .text-cyan, span'))
                .map(l => PhoenixScanner.clean(l.innerText).toUpperCase());

            const hasUnit = labels.some(l => l.includes('UNIT DESIGNATOR'));
            const hasQty = labels.some(l => l.includes('QUANTITY'));

            if (hasUnit && hasQty) {
                const inputs = Array.from(container.querySelectorAll('input, select, .form-control'))
                    .filter(i => i.type !== 'hidden' && window.getComputedStyle(i).display !== 'none');

                if (inputs.length >= 2) {
                    const unitVal = PhoenixScanner.extractValue(inputs[0]);
                    const qtyVal = PhoenixScanner.extractValue(inputs[1]);

                    if (unitVal && unitVal !== 'SELECT MATERIAL ...' && qtyVal) {
                        console.log(`[i-SHAMP-GRID] Captured: ${unitVal} -> Qty: ${qtyVal}`);
                        data.materials.push({ ITEM: 'GRID_MATERIAL', TYPE: unitVal, QTY: qtyVal });
                    }
                }
            }
        });

        // 2. Forensic Photo Audit Capture
        const auditItems = [];
        PhoenixScanner.queryShadow('div, td, span, b, label').forEach(el => {
            if (el.closest('#phoenix-hud')) return;
            const text = PhoenixScanner.clean(el.innerText);
            const parentText = PhoenixScanner.clean(el.parentElement?.innerText || "");

            // Check for Forensic patterns: Name + UUID + Status
            if (parentText.includes('UUID:') && (parentText.includes('Uploaded') || parentText.includes('Missing'))) {
                // If this is the name (usually before UUID)
                if (text && !text.includes('UUID:') && !text.includes('Uploaded') && !text.includes('Missing') && text.length < 50) {
                    const status = parentText.includes('Uploaded') ? 'UPLOADED' : 'MISSING';
                    const uuidMatch = parentText.match(/UUID:\s*(\d+)/);
                    const uuid = uuidMatch ? uuidMatch[1] : "";

                    const exists = auditItems.find(a => a.name === text);
                    if (!exists) {
                        auditItems.push({ name: text, status, uuid });
                    }
                }
            }
        });
        data.forensicAudit = auditItems;

        // 3. Specialized Key-Value Capture (Serials, Voice, Team)
        const forensicTargets = ['SERIAL', 'NUMBER', 'VOICE', 'TEST', 'TEAM', 'ASSIGN', 'IPTV_CPE', 'ONT_ROUTER'];


        PhoenixScanner.queryShadow('div, td, span, b, label').forEach(el => {
            if (el.closest('#phoenix-hud')) return;
            const text = PhoenixScanner.clean(el.innerText).toUpperCase();

            if (forensicTargets.some(k => text.includes(k)) && text.length < 100) {
                // Try to find the value in the next element or parent's next element
                let val = "";
                let next = el.nextElementSibling;
                if (!next && el.parentElement) next = el.parentElement.nextElementSibling;

                if (next) {
                    val = PhoenixScanner.extractValue(next);
                    if (val && val !== text && val.length > 2 && val.length < 200) {
                        data.details[text.replace(/\s+/g, '_')] = val;
                    }
                }
            }
        });

        // 3. Advanced Table Scraper (Multiple Table Types)
        document.querySelectorAll('table').forEach(table => {
            // Skip if table is inside HUD
            if (table.closest('#phoenix-hud')) return;

            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length < 2) return;

            // Try to find headers
            let headers = [];
            const headerRow = rows[0];

            // Check for th elements first, then td
            const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
            headers = headerCells.map(h => PhoenixScanner.clean(h.innerText).toUpperCase());

            // If no headers found, use index-based approach
            if (headers.length === 0 || headers.every(h => h === '')) {
                // Assume first row is data, create generic headers
                const firstDataRow = rows[0];
                const cellCount = firstDataRow.querySelectorAll('td').length;
                headers = Array.from({ length: cellCount }, (_, i) => `COL_${i}`);
            }

            console.log('[PHOENIX] Table detected with headers:', headers);

            // Detect table type based on content
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
                    if (headers[idx]) {
                        rowData[headers[idx]] = PhoenixScanner.extractValue(cell);
                    }
                });

                // Categorize based on table type
                if (isMaterialTable) {
                    // Extract material info
                    const itemName = rowData['ITEM'] || rowData['DESCRIPTION'] || rowData['MATERIAL'] || rowData['COL_1'];
                    const qty = rowData['QTY'] || rowData['QUANTITY'] || rowData['COL_2'];
                    const unit = rowData['UNIT'] || rowData['UOM'] || '';

                    if (itemName && qty) {
                        data.materials.push({
                            ITEM: 'TABLE_MAT',
                            TYPE: itemName,
                            QTY: qty,
                            UNIT: unit,
                            RAW: rowData // Keep full row for reference
                        });
                    }
                } else if (isTeamTable) {
                    data.teamDetails.push(rowData);
                } else if (isHistoryTable) {
                    data.history.push(rowData);
                } else {
                    // Generic table - store as key-value pairs
                    const keyCol = cells[0];
                    const valCol = cells[1];
                    if (keyCol && valCol) {
                        const key = PhoenixScanner.clean(keyCol.innerText).replace(':', '').toUpperCase();
                        const val = PhoenixScanner.extractValue(valCol);
                        if (key && val) data.details[key] = val;
                    }
                }
            });
        });

        // 3. Force open hidden tabs/accordions to scrape lazy-loaded content
        const hiddenSections = document.querySelectorAll('.tab-pane, .accordion-collapse, .collapse, [style*="display: none"]');
        hiddenSections.forEach(section => {
            if (section.closest('#phoenix-hud')) return;
            // Temporarily show to scrape
            const originalDisplay = section.style.display;
            section.style.display = 'block';

            // Scrape inputs inside
            const hiddenInputs = section.querySelectorAll('input, select, textarea');
            hiddenInputs.forEach(input => {
                const val = PhoenixScanner.extractValue(input);
                if (val && !PHOENIX_CONFIG.JUNK.some(p => p.test(val))) {
                    // Find label
                    let label = input.getAttribute('name') || input.getAttribute('id') || 'HIDDEN_FIELD';
                    const labelEl = document.querySelector(`label[for="${input.id}"]`);
                    if (labelEl) {
                        label = PhoenixScanner.clean(labelEl.innerText).replace(':', '');
                    }
                    data.details[`${label.toUpperCase()}_HIDDEN`] = val;
                }
            });

            // Restore original display
            section.style.display = originalDisplay;
        });

        // 4. Scrape Data Attributes (SLT sometimes stores data in data-* attributes)
        document.querySelectorAll('[data-value], [data-field], [data-so]').forEach(el => {
            if (el.closest('#phoenix-hud')) return;
            const fieldName = el.getAttribute('data-field') || el.getAttribute('name') || 'DATA_ATTR';
            const fieldValue = el.getAttribute('data-value') || el.textContent;
            if (fieldValue && fieldValue.trim().length > 0) {
                data.details[`DATA_${fieldName.toUpperCase()}`] = fieldValue.trim();
            }
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
        return t ? PhoenixScanner.clean(t.innerText || t.textContent).toUpperCase() : 'GENERAL';
    }
}

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
            if (attr.name.startsWith('data-')) {
                scrapedData.dataAttrs[attr.name] = attr.value;
            }
        }

        console.log('🎯 [PHOENIX-MANUAL] Scraped:', scrapedData);

        chrome.storage.local.get(['manualScrapes'], (res) => {
            const existing = res.manualScrapes || [];
            existing.push({
                soNum: GLOBAL_RECON.so,
                timestamp: new Date().toISOString(),
                data: scrapedData
            });
            chrome.storage.local.set({ manualScrapes: existing });

            // Re-sync ERP with manual data
            orchestrate();
        });

        const highlight = document.createElement('div');
        highlight.style.cssText = `position:fixed;left:${e.clientX - 25}px;top:${e.clientY - 25}px;width:50px;height:50px;border:3px solid #10b981;border-radius:50%;pointer-events:none;z-index:99999;animation:phoenix-ping 0.8s ease-out forwards;`;
        document.body.appendChild(highlight);
        setTimeout(() => highlight.remove(), 800);

        manualScrapeMode = false;
        document.body.style.cursor = 'default';
        document.removeEventListener('click', clickHandler, true);

        const indicator = document.getElementById('phoenix-manual-indicator');
        if (indicator) indicator.style.display = 'none';
    };

    document.addEventListener('click', clickHandler, true);

    const indicator = document.getElementById('phoenix-manual-indicator');
    if (indicator) {
        indicator.style.display = 'inline';
    }
}

async function orchestrate() {
    if (!chrome.runtime?.id) return;
    const url = window.location.href;
    const soMatch = url.match(/[?&]sod=([A-Z0-9]+)/i);
    const soNum = soMatch ? soMatch[1].toUpperCase() : '';
    if (!soNum) return;

    if (soNum !== GLOBAL_RECON.so) {
        const stored = await new Promise(r => chrome.storage.local.get([`sod_${soNum}`], r));
        GLOBAL_RECON.so = soNum;
        GLOBAL_RECON.tabs = stored[`sod_${soNum}`] || {};
    }

    const currentTab = PhoenixOmniEngine.getTab();
    const captured = await PhoenixOmniEngine.scan();

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
            'SELECTED TEAM': PhoenixScanner.extractValue(document.querySelector('#mobusr')),
            'LIST': captured.teamDetails || []
        },
        materialDetails: GLOBAL_RECON.tabs['MATERIALS_REGISTRY'] || [],
        history: captured.history || [],
        forensicAudit: captured.forensicAudit || [],
        currentUser: PhoenixScanner.clean(document.querySelector('.user-profile-dropdown h6, #user_name')?.innerText || "").replace("Welcome, ", "")
    };

    const hash = JSON.stringify(GLOBAL_RECON.tabs) + JSON.stringify(payload.materialDetails) + JSON.stringify(payload.history) + JSON.stringify(payload.forensicAudit);

    const currentHash = hash.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString();

    if (currentHash !== GLOBAL_RECON.lastHash) {
        GLOBAL_RECON.lastHash = currentHash;
        chrome.storage.local.set({ lastScraped: payload, [`sod_${soNum}`]: GLOBAL_RECON.tabs });
        chrome.runtime.sendMessage({ action: 'pushToERP', data: payload });
        const hud = document.getElementById('phoenix-hud');
        if (hud) {
            const count = Object.values(GLOBAL_RECON.tabs).reduce((a, b) => a + (Array.isArray(b) ? b.length : Object.keys(b).length), 0);
            const status = hud.querySelector('#phoenix-status');
            if (status) {
                status.innerHTML = `<span style="color:#22c55e">●</span> PHOENIX OMNI <span style="background:#8b5cf6;color:white;padding:0 4px;margin:0 5px">${soNum}</span> [${count} DATA]`;
            }
        }
    }
}

new MutationObserver(orchestrate).observe(document.body, { childList: true, subtree: true });
setInterval(orchestrate, PHOENIX_CONFIG.PULSE_RATE);
orchestrate();

if (!document.getElementById('phoenix-hud')) {
    const style = document.createElement('style');
    style.innerHTML = `@keyframes phoenix-ping { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }`;
    document.head.appendChild(style);

    const h = document.createElement('div');
    h.id = 'phoenix-hud';
    h.style.cssText = `position: fixed; top: 10px; right: 10px; z-index: 10000; background: rgba(15,23,42,0.9); color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; font-family: 'Inter', sans-serif; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(8px); display: flex; align-items: center; pointer-events: none; transition: 0.3s;`;

    h.innerHTML = `
        <span id="phoenix-status">PHOENIX OMNI v4.4.0</span>
        <span id="phoenix-manual-indicator" style="display:none; color:#fbbf24; margin-left:8px;">[MANUAL MODE]</span>
        <button id="phoenix-manual-btn" style="margin-left:8px; background:#8b5cf6; border:none; color:white; border-radius:4px; cursor:pointer; padding:2px 8px; font-size:12px; pointer-events:auto; transition:0.2s;">+</button>
    `;

    document.body.appendChild(h);

    const btn = h.querySelector('#phoenix-manual-btn');
    if (btn) {
        btn.onclick = (e) => {
            e.stopPropagation();
            enableManualScrape();
        };
        btn.onmouseover = () => btn.style.background = '#7c3aed';
        btn.onmouseout = () => btn.style.background = '#8b5cf6';
    }
}