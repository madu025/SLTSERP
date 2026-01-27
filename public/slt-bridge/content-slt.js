/**
 * SLT-ERP PHOENIX ELITE v3.1.0
 * Engine: Omniscient Discovery & Adaptive Persistence
 * Role: SLT Portal Scraper
 */

console.log('%c🦅 [PHOENIX-ELITE] v3.1.0 Engaged', 'color: #f97316; font-weight: bold; font-size: 16px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);');

const ELITE_CONFIG = {
    INDICATORS: {
        CYAN_RANGE: { r: [0, 160], g: [130, 255], b: [130, 255] },
        HEX: '#0dcaf0'
    },
    JUNK_PATTERNS: [/1769/i, /WELCOME/i, /LOGOUT/i, /WARNING/i, /DASHBOARD/i, /CLICK HERE/i, /IMPORTANT/i],
    SCAN_INTERVAL: 2500
};

let SESSION_CACHE = { so: '', tabs: {}, lastHash: '' };

const EliteUtils = {
    clean: t => t ? t.replace(/\s+/g, ' ').trim() : '',

    isCyanLabel: el => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        if (!color) return false;

        // Match RGB components for wide Cyan support
        const m = color.match(/\d+/g);
        if (m && m.length >= 3) {
            const r = parseInt(m[0]), g = parseInt(m[1]), b = parseInt(m[2]);
            const conf = ELITE_CONFIG.INDICATORS.CYAN_RANGE;
            const isCyan = r >= conf.r[0] && r <= conf.r[1] &&
                g >= conf.g[0] && g <= conf.g[1] &&
                b >= conf.b[0] && b <= conf.b[1];

            const text = EliteUtils.clean(el.innerText || '');
            const isBold = parseInt(style.fontWeight) >= 600;
            return (isCyan || (isBold && text.endsWith(':'))) && text.length > 2 && text.length < 60;
        }
        return false;
    },

    getValue: el => {
        if (!el) return '';
        if (el.nodeType === 3) return EliteUtils.clean(el.textContent); // Handle Text Nodes
        if (el.nodeType !== 1) return EliteUtils.clean(el.innerText || el.textContent);

        if (el.tagName === 'SELECT') return el.options[el.selectedIndex]?.text || '';
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value || '';

        // Deep find hidden inputs or select in container
        const inner = el.querySelector ? el.querySelector('input, select, textarea') : null;
        if (inner) return EliteUtils.getValue(inner);

        return EliteUtils.clean(el.innerText || el.textContent);
    }
};

class PhoenixEliteEngine {
    static async harvest() {
        const payload = { details: {}, materials: [], visuals: [] };
        const activeTab = this.getTabName();

        // Layer 1: Semantic Pair Discovery
        document.querySelectorAll('label, b, strong, th, span, td, div').forEach(el => {
            if (EliteUtils.isCyanLabel(el)) {
                const k = EliteUtils.clean(el.innerText).replace(':', '').toUpperCase();
                if (payload.details[k]) return;

                let v = '';
                // Proximity Hook
                let next = el.nextElementSibling || el.nextSibling;
                while (next && (next.nodeType === 3 && !next.textContent.trim())) next = next.nextSibling;
                if (next) v = EliteUtils.getValue(next);

                // Grid/Table Parity
                if (!v || v === k) {
                    const cell = el.closest('td');
                    if (cell?.nextElementSibling) v = EliteUtils.getValue(cell.nextElementSibling);
                }

                if (v && v !== k && !ELITE_CONFIG.JUNK_PATTERNS.some(p => p.test(v))) {
                    payload.details[k] = v;
                }
            }
        });

        // Layer 2: Matrix Grid Indexing (Materials/Serials/Attributes)
        document.querySelectorAll('table').forEach(tbl => {
            const rows = Array.from(tbl.querySelectorAll('tr'));
            if (rows.length < 1) return;

            const firstRowCells = Array.from(rows[0].querySelectorAll('td, th'));
            const headers = firstRowCells.map(c => EliteUtils.clean(c.innerText).toUpperCase());

            rows.forEach((row, idx) => {
                const cells = Array.from(row.querySelectorAll('td, th'));
                if (cells.length < 2) return;

                // Case: Single Key-Value Row (Vertical Table)
                if (cells.length === 2 && idx > 0) {
                    const k = EliteUtils.clean(cells[0].innerText).toUpperCase();
                    const v = EliteUtils.getValue(cells[1]);
                    if (k && v && v !== k && !EliteUtils.isCyanLabel(cells[1])) {
                        payload.details[k] = v;
                    }
                }

                // Case: Horizontal Matrix (Materials/Serials)
                const itemCol = headers.findIndex(h => h.includes('ITEM') || h.includes('DESCRIPTION') || h.includes('ATTRIBUTE'));
                const valCol = headers.findIndex(h => h.includes('QTY') || h.includes('SERIAL') || h.includes('VALUE') || h.includes('DEFAULT'));

                if (itemCol !== -1 && valCol !== -1 && idx > 0 && cells.length > Math.max(itemCol, valCol)) {
                    const itm = EliteUtils.clean(cells[itemCol].innerText);
                    const val = EliteUtils.getValue(cells[valCol]);
                    if (itm && val) {
                        if (headers[itemCol].includes('ITEM') || headers[itemCol].includes('DESCRIPTION')) {
                            payload.materials.push({ ITEM: 'MATERIAL', TYPE: itm, QTY: val });
                        } else {
                            payload.details[itm.toUpperCase()] = val;
                        }
                    }
                }
            });
        });

        // Layer 3: Visual Asset Deep-Scan (Photos Tab)
        if (activeTab.includes('IMAGE') || activeTab.includes('PHOTO')) {
            document.querySelectorAll('img').forEach(img => {
                const src = img.src || img.dataset.src || img.getAttribute('src');
                if (src && src.startsWith('http') && !src.includes('no-image')) {
                    // Try to find a caption or date nearby
                    const container = img.closest('.thumbnail, .img-container, td, div');
                    const meta = container ? EliteUtils.clean(container.innerText) : '';
                    payload.visuals.push({ url: src, alt: img.alt || 'Asset', meta: meta.substring(0, 100) });
                }
            });
        }

        return payload;
    }

    static getTabName() {
        const active = document.querySelector('.nav-tabs .nav-link.active, .active a, .current-tab');
        return active ? EliteUtils.clean(active.innerText).toUpperCase() : 'GENERAL';
    }
}

async function pulse() {
    if (!chrome.runtime?.id) return;
    const url = window.location.href;
    const soMatch = url.match(/[?&]sod=([A-Z0-9]+)/i);
    const so = soMatch ? soMatch[1].toUpperCase() : '';
    if (!so) return;

    // Load session if changed
    if (so !== SESSION_CACHE.so) {
        const stored = await new Promise(r => chrome.storage.local.get([`sod_${so}`], r));
        SESSION_CACHE.so = so;
        SESSION_CACHE.tabs = stored[`sod_${so}`] || {};
    }

    const currentTab = PhoenixEliteEngine.getTabName();
    const harvested = await PhoenixEliteEngine.harvest();

    // Smart Persistence (Additive Only)
    if (Object.keys(harvested.details).length > 0 || harvested.materials.length > 0) {
        SESSION_CACHE.tabs[currentTab] = { ...(SESSION_CACHE.tabs[currentTab] || {}), ...harvested.details };

        // Gallery Storage
        if (harvested.visuals.length > 0) {
            if (!SESSION_CACHE.tabs['GALLERY']) SESSION_CACHE.tabs['GALLERY'] = [];
            harvested.visuals.forEach(v => {
                if (!SESSION_CACHE.tabs['GALLERY'].find(x => x.url === v.url)) SESSION_CACHE.tabs['GALLERY'].push(v);
            });
        }
    }

    const payload = {
        url,
        soNum: so,
        activeTab: currentTab,
        timestamp: new Date().toISOString(),
        details: harvested.details,
        allTabs: SESSION_CACHE.tabs,
        teamDetails: { 'SELECTED TEAM': EliteUtils.getValue(document.querySelector('#mobusr')) },
        materialDetails: harvested.materials,
        visualDetails: harvested.visuals,
        currentUser: EliteUtils.clean(document.querySelector('.user-profile-dropdown h6, #user_name')?.innerText || "").replace("Welcome, ", "")
    };

    const hash = btoa(JSON.stringify(payload.allTabs) + JSON.stringify(payload.materialDetails)).substring(0, 32);
    if (hash !== SESSION_CACHE.lastHash) {
        SESSION_CACHE.lastHash = hash;
        chrome.storage.local.set({ lastScraped: payload, [`sod_${so}`]: SESSION_CACHE.tabs });
        chrome.runtime.sendMessage({ action: 'pushToERP', data: payload });
    }
}

// Reactive Core
new MutationObserver(pulse).observe(document.body, { childList: true, subtree: true });
setInterval(pulse, ELITE_CONFIG.SCAN_INTERVAL);
pulse();

// Indicator HUD
if (!document.getElementById('phoenix-hud')) {
    const h = document.createElement('div');
    h.id = 'phoenix-hud';
    h.style.cssText = `position: fixed; top: 10px; left: 10px; z-index: 999999; background: rgba(0,0,0,0.8); color: #f97316; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-family: monospace; border: 1px solid #f97316; pointer-events: none; opacity: 0.8;`;
    h.innerHTML = `PHOENIX ELITE v3.1.0`;
    document.body.appendChild(h);
}