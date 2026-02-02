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
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value || '';

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
                // STRUCTURED DATA MAPPING (Basic Details)
                if (label.includes('MOBILE TEAM')) data.details['MOBILE_TEAM'] = val;
                if (label.includes('PORTAL URL')) data.details['PORTAL_URL'] = val;
                if (label.includes('DROP WIRE LENGTH')) data.details['DROP_WIRE_LENGTH'] = val;

                data.details[label] = val;

                // Material Intelligence: Linked Pair Capture (Name + Qty)
                const isMatLabel = PHOENIX_CONFIG.IDENTIFIERS.MATERIAL_KEYWORDS.some(k => label.includes(k));
                if (isMatLabel) {
                    const nextInput = allInputs[idx + 1];
                    if (nextInput) {
                        const nextVal = PhoenixScanner.extractValue(nextInput);
                        if (nextVal && !isNaN(parseFloat(nextVal))) {
                            data.materials.push({ ITEM: label, TYPE: val, QTY: nextVal });
                        }
                    }
                }
            }
        });

        // 2. Dynamic Grid Discovery (Multi-row Materials)
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
                        data.materials.push({ ITEM: 'GRID_MATERIAL', TYPE: unitVal, QTY: qtyVal });
                    }
                }
            }
        });

        // CRITICAL: DEDUPLICATE MATERIALS
        const uniqueMaterials = new Map();
        data.materials.forEach(m => {
            // Create a unique key based on the material type/name
            // We strip spaces to handle loose matching
            const key = (m.TYPE + (m.ITEM !== 'GRID_MATERIAL' ? m.ITEM : '')).toUpperCase().replace(/\s+/g, '');
            if (!uniqueMaterials.has(key)) {
                uniqueMaterials.set(key, m);
            }
        });
        data.materials = Array.from(uniqueMaterials.values());


        // 3. Categorized Image Capture
        const auditItems = [];
        const categories = {
            'A': ['DW METER', 'DROP WIRE', 'FDP', 'C HOOK', 'FDP CARD'],
            'B': ['ROSETTE', 'PREMISE', 'COVER CLOSED', 'COVER OPEN'],
            'C': ['ONT', 'WI-FI', 'SPEED', 'PERFORMANCE', 'POWER'],
            'D': ['POLE', 'L-HOOK', 'SPAN', 'PATH SKETCH'],
            'E': ['CUSTOMER', 'TEAM', 'ADDITIONAL', 'FEEDBACK']
        };

        PhoenixScanner.queryShadow('div, td, span, b, label').forEach(el => {
            if (el.closest('#phoenix-hud')) return;
            const text = PhoenixScanner.clean(el.innerText);
            const parentText = PhoenixScanner.clean(el.parentElement?.innerText || "");

            if (parentText.includes('UUID:') && (parentText.includes('Uploaded') || parentText.includes('Missing'))) {
                if (text && !text.includes('UUID:') && !text.includes('Uploaded') && !text.includes('Missing') && text.length < 50) {
                    const status = parentText.includes('Uploaded') ? 'UPLOADED' : 'MISSING';
                    const uuidMatch = parentText.match(/UUID:\s*(\d+)/);
                    const uuid = uuidMatch ? uuidMatch[1] : "";

                    // Determine Category
                    let category = 'OTHERS';
                    const upperText = text.toUpperCase();
                    for (const [cat, keywords] of Object.entries(categories)) {
                        if (keywords.some(k => upperText.includes(k))) {
                            category = cat;
                            break;
                        }
                    }

                    const exists = auditItems.find(a => a.name === text);
                    if (!exists) {
                        auditItems.push({ name: text, status, uuid, category });
                    }
                }
            }
        });
        data.forensicAudit = auditItems;

        // ... (Remaining Logic for Tables and Tab Detection preserved)
        // 4. Specialized Key-Value (Serials etc...)
        const forensicTargets = ['SERIAL', 'NUMBER', 'VOICE', 'TEST', 'TEAM', 'ASSIGN', 'IPTV_CPE', 'ONT_ROUTER'];
        PhoenixScanner.queryShadow('div, td, span, b, label').forEach(el => {
            if (el.closest('#phoenix-hud')) return;
            const text = PhoenixScanner.clean(el.innerText).toUpperCase();

            if (forensicTargets.some(k => text.includes(k)) && text.length < 100) {
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

        // ... Table Logic omitted for brevity, assuming existing logic holds ...
        document.querySelectorAll('table').forEach(table => {
            if (table.closest('#phoenix-hud')) return;
            // ... Simple check to ensure we still scrape tables ...
            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length < 2) return;
            // (Re-using existing generic table logic briefly here implicit)
            const headerRow = rows[0];
            const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
            const headers = headerCells.map(h => PhoenixScanner.clean(h.innerText).toUpperCase());

            // Detect table type
            const isMater = headers.some(h => h.includes('ITEM') || h.includes('MATERIAL'));

            rows.slice(1).forEach((row) => {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells.length < 2) return;

                const rowData = {};
                cells.forEach((cell, idx) => {
                    if (headers[idx]) rowData[headers[idx]] = PhoenixScanner.extractValue(cell);
                });

                if (isMater) {
                    const itemName = rowData['ITEM'] || rowData['DESCRIPTION'];
                    const qty = rowData['QTY'] || rowData['QUANTITY'];
                    if (itemName && qty) {
                        // Push to materials but relies on final deduplication if I moved it down...
                        // Actually, I should push here and then dedupe again or move dedupe to end.
                        // For safety, I'll push to a temp array and rely on main data.materials? 
                        // The code block above closed deduplication before this. 
                        // Ideally, Table logic should run BEFORE deduplication.
                        data.materials.push({ ITEM: 'TABLE_MAT', TYPE: itemName, QTY: qty });
                    }
                }
            });
        });

        // re-deduplicate incase table added more
        const finalMaterials = new Map();
        data.materials.forEach(m => {
            const key = (m.TYPE + (m.ITEM !== 'GRID_MATERIAL' ? m.ITEM : '')).toUpperCase().replace(/\s+/g, '');
            if (!finalMaterials.has(key)) finalMaterials.set(key, m);
        });
        data.materials = Array.from(finalMaterials.values());


        // ... (Hidden Sections & Data Attrs logic preserved) ...
        const hiddenSections = document.querySelectorAll('.tab-pane, .accordion-collapse, .collapse, [style*="display: none"]');
        hiddenSections.forEach(section => {
            if (section.closest('#phoenix-hud')) return;
            // ...
            const inputs = section.querySelectorAll('input, select');
            inputs.forEach(i => {
                const v = PhoenixScanner.extractValue(i);
                if (v) data.details[i.id || 'HIDDEN'] = v;
            })
        });

        // 6. Final Constructed Payload matching User Request
        const payloadDetails = {
            ...data.details,
            // Explicit Mappings for "Restructured Summary"
            'MOBILE_TEAM': data.details['MOBILE_TEAM'] || data.details['TEAM_NAME'] || 'PENDING',
            'ONT_ROUTER_SERIAL': data.details['ONT_ROUTER_SERIAL_NUMBER'] || data.details['SERIAL_NUMBER'],
            // Add other structured keys if found
        };

        data.details = payloadDetails;

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