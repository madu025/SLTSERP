/**
 * SLT-ERP PHOENIX OMNISCIENT v4.0.3
 * Engine: Ultra-Aggressive Global Discovery & Semantic Reconstruction
 * Role: 100% Coverage SLT Portal Scraper
 */

console.log('%c🔥 [PHOENIX-OMNISCIENT] v4.0.3 Activated', 'color: #ef4444; font-weight: bold; font-size: 18px; text-shadow: 0 0 8px rgba(239, 68, 68, 0.4);');

const PHOENIX_CONFIG = {
    IDENTIFIERS: {
        CYAN_RANGE: { r: [0, 180], g: [100, 255], b: [100, 255] },
        MASH_KEYWORDS: [
            'RTOM', 'SERVICE ORDER', 'CIRCUIT', 'SERVICE', 'RECEIVED DATE',
            'CUSTOMER NAME', 'CONTACT NO', 'ADDRESS', 'STATUS', 'STATUS DATE',
            'ORDER TYPE', 'TASK', 'PACKAGE', 'EQUIPMENT CLASS', 'SALES PERSON'
        ],
        MATERIAL_KEYWORDS: ['WIRE', 'POLE', 'CABLE', 'SOCKET', 'ONT', 'IPTV', 'ROUT', 'STB', 'SPLITTER', 'CONNECTOR', 'FTTH', 'METER']
    },
    JUNK: [/WELCOME/i, /LOGOUT/i, /CLICK HERE/i, /DASHBOARD/i, /IMPORTANT/i, /WARNING/i, /PENDING IMAGES/i],
    PULSE_RATE: 2000
};

let GLOBAL_RECON = { so: '', tabs: {}, lastHash: '', stats: { fields: 0, tabs: 0 } };

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
        const style = window.getComputedStyle(el);
        const color = style.color;
        const text = PhoenixScanner.clean(el.innerText || '');
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
        const isMaterialHeading = PHOENIX_CONFIG.IDENTIFIERS.MATERIAL_KEYWORDS.some(k => text.toUpperCase().includes(k));

        return (isCyan || (isBold && hasColon) || (isCyan && isMaterialHeading)) && text.length > 1 && text.length < 50;
    },

    unmask: (text) => {
        const results = {};
        const keys = PHOENIX_CONFIG.IDENTIFIERS.MASH_KEYWORDS;
        keys.forEach((key) => {
            const start = text.indexOf(key);
            if (start === -1) return;
            let end = text.length;
            keys.forEach(k2 => {
                const nextIdx = text.indexOf(k2, start + key.length);
                if (nextIdx !== -1 && nextIdx < end) end = nextIdx;
            });
            let val = PhoenixScanner.clean(text.substring(start + key.length, end));
            if (val) results[key.toUpperCase()] = val;
        });
        return results;
    }
};

class PhoenixOmniEngine {
    static async scan() {
        const data = { details: {}, materials: [], visuals: [] };
        const activeTab = PhoenixOmniEngine.getTab();

        // Step 1: Material Dashboard Discovery (Aggressive)
        // Focus on the layout shown in the screenshot: Cyan labels with adjacent inputs
        if (activeTab === 'MATERIALS' || window.location.href.includes('materials')) {
            document.querySelectorAll('div, tr, .row').forEach(container => {
                const labels = Array.from(container.querySelectorAll('label, h1, h2, h3, h4, h5, b, strong, span, .text-cyan'))
                    .filter(el => PhoenixScanner.isKey(el));

                if (labels.length > 0) {
                    const inputs = Array.from(container.querySelectorAll('input, select, .form-control, .txtbg'))
                        .filter(i => i.style.display !== 'none' && i.type !== 'hidden');

                    if (inputs.length >= 2) {
                        const key = PhoenixScanner.clean(labels[0].innerText).replace(':', '').toUpperCase();
                        const itmName = PhoenixScanner.extractValue(inputs[0]);
                        const itmQty = PhoenixScanner.extractValue(inputs[1]);

                        if (itmName && itmQty && !isNaN(parseFloat(itmQty)) && itmName !== itmQty) {
                            data.materials.push({ ITEM: key, TYPE: itmName, QTY: itmQty });
                        }
                    }
                }
            });
        }

        // Step 2: Global Semantic Walk
        document.querySelectorAll('label, th, h1, h2, h3, h4, h5, b, strong, span, td, div').forEach(el => {
            if (PhoenixScanner.isKey(el)) {
                const key = PhoenixScanner.clean(el.innerText).replace(':', '').toUpperCase();
                let val = '';
                let next = el.nextElementSibling || el.nextSibling;
                while (next && (next.nodeType === 3 && !next.textContent.trim())) next = next.nextSibling;
                if (next) val = PhoenixScanner.extractValue(next);

                if (!val || val === key) {
                    const cell = el.closest('td');
                    if (cell?.nextElementSibling) val = PhoenixScanner.extractValue(cell.nextElementSibling);
                }

                if (val && val !== key && !PHOENIX_CONFIG.JUNK.some(p => p.test(val))) {
                    data.details[key] = val;
                    if (val.length > 50 && PHOENIX_CONFIG.IDENTIFIERS.MASH_KEYWORDS.some(k => val.includes(k))) {
                        Object.assign(data.details, PhoenixScanner.unmask(val));
                    }
                }
            }
        });

        // Step 3: Photo Synthesis
        if (activeTab.includes('IMAGE') || activeTab.includes('PHOTO')) {
            document.querySelectorAll('img').forEach(img => {
                const src = img.src || img.dataset.src;
                if (src && src.startsWith('http') && !src.includes('no-image')) {
                    const ctx = img.closest('.thumbnail, tr, td, div');
                    data.visuals.push({ url: src, label: img.alt || 'Asset', context: PhoenixScanner.clean(ctx?.innerText || '').substring(0, 100) });
                }
            });
        }

        return data;
    }

    static getTab() {
        const t = document.querySelector('.active a, .nav-link.active, .current-tab, #Materials_tab, .tab-active');
        let name = t ? PhoenixScanner.clean(t.innerText || t.textContent).toUpperCase() : 'GENERAL';
        if (window.location.href.includes('sod_materials') || window.location.href.includes('material')) name = 'MATERIALS';
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

    if (Object.keys(captured.details).length > 0 || captured.materials.length > 0) {
        const existing = GLOBAL_RECON.tabs[currentTab] || {};
        GLOBAL_RECON.tabs[currentTab] = { ...existing, ...captured.details };

        // Permanent Material Registry
        if (captured.materials.length > 0) {
            if (!GLOBAL_RECON.tabs['MATERIALS_LIST']) GLOBAL_RECON.tabs['MATERIALS_LIST'] = [];
            captured.materials.forEach(m => {
                const idx = GLOBAL_RECON.tabs['MATERIALS_LIST'].findIndex(x => x.ITEM === m.ITEM || x.TYPE === m.TYPE);
                if (idx === -1) {
                    GLOBAL_RECON.tabs['MATERIALS_LIST'].push(m);
                } else {
                    GLOBAL_RECON.tabs['MATERIALS_LIST'][idx] = m; // Update with latest values
                }
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
        materialDetails: GLOBAL_RECON.tabs['MATERIALS_LIST'] || [],
        visualDetails: captured.visuals,
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
            hud.innerHTML = `<span style="color:#22c55e">●</span> PHOENIX OMNI <span style="background:#f97316;color:black;padding:0 3px;margin:0 5px">${soNum}</span> [${count} DATA POINTS]`;
        }
    }
}

new MutationObserver(orchestrate).observe(document.body, { childList: true, subtree: true });
setInterval(orchestrate, PHOENIX_CONFIG.PULSE_RATE);
orchestrate();

if (!document.getElementById('phoenix-hud')) {
    const h = document.createElement('div');
    h.id = 'phoenix-hud';
    h.style.cssText = `position: fixed; top: 10px; right: 10px; z-index: 10000; background: rgba(15,23,42,0.9); color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; font-family: 'Inter', sans-serif; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(8px); box-shadow: 0 4px 20px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 8px; pointer-events: none;`;
    h.innerHTML = `PHOENIX OMNI v4.0.3`;
    document.body.appendChild(h);
}