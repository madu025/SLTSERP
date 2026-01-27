/**
 * SLT-ERP PHOENIX OMNISCIENT v4.0.4
 * Engine: Universal Input Mapping & Cross-Frame Harvesting
 * Role: 100% Coverage SLT Portal Scraper
 */

console.log('%c🚀 [PHOENIX-OMNISCIENT] v4.0.4 Engaged (Universal)', 'color: #3b82f6; font-weight: bold; font-size: 18px;');

const PHOENIX_CONFIG = {
    IDENTIFIERS: {
        CYAN_RANGE: { r: [0, 200], g: [100, 255], b: [100, 255] },
        MASH_KEYWORDS: ['RTOM', 'SERVICE ORDER', 'CIRCUIT', 'SERVICE', 'CUSTOMER NAME', 'CONTACT NO', 'ADDRESS', 'STATUS', 'ORDER TYPE', 'PACKAGE', 'ONT', 'IPTV'],
        MATERIAL_KEYWORDS: ['WIRE', 'POLE', 'CABLE', 'SOCKET', 'ONT', 'IPTV', 'ROUT', 'STB', 'SPLITTER', 'CONNECTOR', 'FTTH', 'METER']
    },
    JUNK: [/WELCOME/i, /LOGOUT/i, /CLICK HERE/i, /DASHBOARD/i, /IMPORTANT/i, /WARNING/i, /PENDING/i],
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

        const isBold = parseInt(style.fontWeight) >= 600;
        const hasColon = text.endsWith(':');
        const isKnownKey = PHOENIX_CONFIG.IDENTIFIERS.MATERIAL_KEYWORDS.some(k => text.includes(k));

        return (isCyan || isBold || hasColon || isKnownKey);
    }
};

class PhoenixOmniEngine {
    static async scan() {
        const data = { details: {}, materials: [], visuals: [] };
        const activeTab = PhoenixOmniEngine.getTab();

        // Strategy 1: Smart Semantic Extraction
        document.querySelectorAll('label, th, b, strong, span, td, div, h1, h2, h3, h4, h5').forEach(el => {
            if (PhoenixScanner.isKey(el)) {
                const key = PhoenixScanner.clean(el.innerText).replace(':', '').toUpperCase();

                // Immediate Next Value
                let val = '';
                let next = el.nextElementSibling;
                if (!next) {
                    const parent = el.parentElement;
                    if (parent && parent.children.length > 1) {
                        next = Array.from(parent.children).find(c => c !== el);
                    }
                }

                if (next) val = PhoenixScanner.extractValue(next);

                // Grid fallback
                if (!val || val === key) {
                    const cell = el.closest('td');
                    if (cell?.nextElementSibling) val = PhoenixScanner.extractValue(cell.nextElementSibling);
                }

                if (val && val !== key && !PHOENIX_CONFIG.JUNK.some(p => p.test(val))) {
                    data.details[key] = val;
                }
            }
        });

        // Strategy 2: Universal Input -> Label Reverse Lookup (Brute Force)
        document.querySelectorAll('input:not([type="hidden"]), select').forEach(input => {
            const val = PhoenixScanner.extractValue(input);
            if (!val || val.length < 1 || PHOENIX_CONFIG.JUNK.some(p => p.test(val))) return;

            // Try to find the associated label
            let container = input.closest('div, tr, .row, .form-group');
            if (container) {
                const labelEl = Array.from(container.querySelectorAll('label, b, span, th, h1, h2, h3, h4, h5'))
                    .find(l => PhoenixScanner.isKey(l));
                if (labelEl) {
                    const key = PhoenixScanner.clean(labelEl.innerText).replace(':', '').toUpperCase();
                    data.details[key] = val;

                    // Specific Materials Tab support (Multiple inputs in one row)
                    if (activeTab === 'MATERIALS' || window.location.href.includes('materials')) {
                        const allInputs = Array.from(container.querySelectorAll('input, select'));
                        if (allInputs.length >= 2) {
                            const v1 = PhoenixScanner.extractValue(allInputs[0]);
                            const v2 = PhoenixScanner.extractValue(allInputs[1]);
                            if (v1 && v2 && !isNaN(parseFloat(v2))) {
                                data.materials.push({ ITEM: key, TYPE: v1, QTY: v2 });
                            }
                        }
                    }
                }
            }
        });

        return data;
    }

    static getTab() {
        const t = document.querySelector('.active a, .nav-link.active, .current-tab, #Materials_tab');
        let name = t ? PhoenixScanner.clean(t.innerText || t.textContent).toUpperCase() : 'GENERAL';
        if (window.location.href.includes('sod_materials')) name = 'MATERIALS';
        return name;
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

    // Persistent Merge
    if (Object.keys(captured.details).length > 0 || captured.materials.length > 0) {
        GLOBAL_RECON.tabs[currentTab] = { ...(GLOBAL_RECON.tabs[currentTab] || {}), ...captured.details };

        if (captured.materials.length > 0) {
            if (!GLOBAL_RECON.tabs['MATERIALS_REGISTRY']) GLOBAL_RECON.tabs['MATERIALS_REGISTRY'] = [];
            captured.materials.forEach(m => {
                const idx = GLOBAL_RECON.tabs['MATERIALS_REGISTRY'].findIndex(x => x.ITEM === m.ITEM);
                if (idx === -1) GLOBAL_RECON.tabs['MATERIALS_REGISTRY'].push(m);
                else GLOBAL_RECON.tabs['MATERIALS_REGISTRY'][idx] = m;
            });
        }
    }

    const payload = {
        url,
        soNum,
        activeTab: currentTab,
        timestamp: new Date().toISOString(),
        details: captured.details,
        allTabs: GLOBAL_RECON.tabs,
        teamDetails: { 'SELECTED TEAM': PhoenixScanner.extractValue(document.querySelector('#mobusr')) },
        materialDetails: GLOBAL_RECON.tabs['MATERIALS_REGISTRY'] || [],
        currentUser: PhoenixScanner.clean(document.querySelector('.user-profile-dropdown h6, #user_name')?.innerText || "").replace("Welcome, ", "")
    };

    const hash = btoa(JSON.stringify(GLOBAL_RECON.tabs) + JSON.stringify(payload.materialDetails)).substring(0, 32);
    if (hash !== GLOBAL_RECON.lastHash) {
        GLOBAL_RECON.lastHash = hash;
        chrome.storage.local.set({ lastScraped: payload, [`sod_${soNum}`]: GLOBAL_RECON.tabs });
        chrome.runtime.sendMessage({ action: 'pushToERP', data: payload });

        const hud = document.getElementById('phoenix-hud');
        if (hud) {
            const count = Object.values(GLOBAL_RECON.tabs).reduce((a, b) => a + (Array.isArray(b) ? b.length : Object.keys(b).length), 0);
            hud.innerHTML = `<span style="color:#22c55e">●</span> PHOENIX OMNI <span style="background:#3b82f6;color:white;padding:0 4px;margin:0 5px">${soNum}</span> [${count} FIELDS]`;
        }
    }
}

new MutationObserver(orchestrate).observe(document.body, { childList: true, subtree: true });
setInterval(orchestrate, PHOENIX_CONFIG.PULSE_RATE);
orchestrate();

if (!document.getElementById('phoenix-hud')) {
    const h = document.createElement('div');
    h.id = 'phoenix-hud';
    h.style.cssText = `position: fixed; top: 10px; right: 10px; z-index: 10000; background: rgba(15,23,42,0.9); color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; font-family: 'Inter', sans-serif; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(8px); pointer-events: none;`;
    h.innerHTML = `PHOENIX OMNI v4.0.4`;
    document.body.appendChild(h);
}