/**
 * SLT-ERP PHOENIX OMNISCIENT v4.0.5
 * Engine: Hyper-Proximity Linking & Cross-Context Harvesting
 * Role: 100% Coverage SLT Portal Scraper
 */

console.log('%c🚀 [PHOENIX-OMNISCIENT] v4.0.5 Engaged (Hyper-Precision)', 'color: #8b5cf6; font-weight: bold; font-size: 18px;');

const PHOENIX_CONFIG = {
    IDENTIFIERS: {
        CYAN_RANGE: { r: [0, 200], g: [100, 255], b: [100, 255] },
        MATERIAL_KEYWORDS: ['WIRE', 'POLE', 'CABLE', 'SOCKET', 'ONT', 'IPTV', 'ROUT', 'STB', 'SPLITTER', 'CONNECTOR', 'FTTH', 'METER', 'DROP']
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
        if (text.length < 2 || text.length > 50) return false;

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
        return (isCyan || isBold || hasColon);
    }
};

class PhoenixOmniEngine {
    static async scan() {
        const data = { details: {}, materials: [], visuals: [] };

        // 1. Force Discovery: All Inputs
        const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select'));

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
                            console.log(`💎 [PHOENIX-MAT] Captured: ${label} -> ${val} (Qty: ${nextVal})`);
                            data.materials.push({ ITEM: label, TYPE: val, QTY: nextVal });
                        }
                    }
                }
            }
        });

        // 2. Fallback Table Scraper
        document.querySelectorAll('table').forEach(table => {
            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length < 2) return;
            const headers = Array.from(rows[0].querySelectorAll('th, td')).map(h => PhoenixScanner.clean(h.innerText).toUpperCase());

            rows.slice(1).forEach(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells.length < 2) return;
                const itmIdx = headers.findIndex(h => h.includes('ITEM') || h.includes('DESC') || h.includes('MAT'));
                const valIdx = headers.findIndex(h => h.includes('QTY') || h.includes('VALUE'));

                if (itmIdx !== -1 && valIdx !== -1) {
                    const k = PhoenixScanner.clean(cells[itmIdx].innerText);
                    const v = PhoenixScanner.extractValue(cells[valIdx]);
                    if (k && v) data.materials.push({ ITEM: 'TABLE_MAT', TYPE: k, QTY: v });
                }
            });
        });

        return data;
    }

    static getTab() {
        if (window.location.href.includes('materials')) return 'MATERIALS';
        const t = document.querySelector('.active a, .nav-link.active, .current-tab');
        return t ? PhoenixScanner.clean(t.innerText || t.textContent).toUpperCase() : 'GENERAL';
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
        teamDetails: { 'SELECTED TEAM': PhoenixScanner.extractValue(document.querySelector('#mobusr')) },
        materialDetails: GLOBAL_RECON.tabs['MATERIALS_REGISTRY'] || [],
        currentUser: PhoenixScanner.clean(document.querySelector('.user-profile-dropdown h6, #user_name')?.innerText || "").replace("Welcome, ", "")
    };

    const hash = JSON.stringify(GLOBAL_RECON.tabs) + JSON.stringify(payload.materialDetails);
    const currentHash = hash.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString();

    if (currentHash !== GLOBAL_RECON.lastHash) {
        GLOBAL_RECON.lastHash = currentHash;
        chrome.storage.local.set({ lastScraped: payload, [`sod_${soNum}`]: GLOBAL_RECON.tabs });
        chrome.runtime.sendMessage({ action: 'pushToERP', data: payload });
        const hud = document.getElementById('phoenix-hud');
        if (hud) {
            const count = Object.values(GLOBAL_RECON.tabs).reduce((a, b) => a + (Array.isArray(b) ? b.length : Object.keys(b).length), 0);
            hud.innerHTML = `<span style="color:#22c55e">●</span> PHOENIX OMNI <span style="background:#8b5cf6;color:white;padding:0 4px;margin:0 5px">${soNum}</span> [${count} DATA]`;
        }
    }
}

new MutationObserver(orchestrate).observe(document.body, { childList: true, subtree: true });
setInterval(orchestrate, PHOENIX_CONFIG.PULSE_RATE);
orchestrate();

if (!document.getElementById('phoenix-hud')) {
    const h = document.createElement('div');
    h.id = 'phoenix-hud';
    h.style.cssText = `position: fixed; top: 10px; right: 10px; z-index: 10000; background: rgba(15,23,42,0.9); color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; font-family: 'Inter', sans-serif; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(8px); pointer-events: none; transition: 0.3s;`;
    h.innerHTML = `PHOENIX OMNI v4.0.5`;
    document.body.appendChild(h);
}