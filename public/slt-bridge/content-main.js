/**
 * SLT-ERP Bridge (manifest-driven version)
 * World: MAIN
 * Role: ERP Smart Injector (fills ERP forms from scraped SLT Portal data)
 */

// MAIN world has no chrome.runtime.getManifest(), but content-erp.js (ISOLATED,
// document_start) has already stamped the real manifest version on <html> before
// this script runs, so read it from there instead of hardcoding a drifting literal.
const BRIDGE_VERSION = document.documentElement.getAttribute('data-slt-bridge-version')
    || 'unknown';

console.log(`%c[SLT-BRIDGE] Injector v${BRIDGE_VERSION} Engaged`, 'color: #3b82f6; font-weight: bold;');

// ─── Identity & Discovery ────────────────────────────────────────────
(function () {
    document.documentElement.setAttribute('data-slt-bridge', 'active');
    document.documentElement.setAttribute('data-slt-bridge-version', BRIDGE_VERSION);
    document.documentElement.setAttribute('data-slt-bridge-detected', new Date().toISOString());

    const dispatchDiscovery = () => {
        window.dispatchEvent(new CustomEvent('SLT_BRIDGE_DETECTED', {
            detail: { version: BRIDGE_VERSION, timestamp: new Date().toISOString() }
        }));
    };

    // Staggered dispatches to catch React hydration
    dispatchDiscovery();
    setTimeout(dispatchDiscovery, 1000);
    setTimeout(dispatchDiscovery, 3000);

    // Global Identity Exposure (MAIN world only)
    window.SLT_BRIDGE = {
        version: BRIDGE_VERSION,
        status: 'CONNECTED',
        detected: true
    };
})();

// ─── Smart Fill from Bridge Data ─────────────────────────────────────
window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data.payload) return;

    if (event.data.type === 'FROM_SLT_BRIDGE') {
        const data = event.data.payload;
        applySmartFill(data);
    }
});

function applySmartFill(data) {
    const allCaptured = data.allTabs || {};

    // Combine all captured data
    const masterData = {};
    Object.values(allCaptured).forEach(tabData => {
        Object.assign(masterData, tabData);
    });

    Object.keys(masterData).forEach(key => {
        const val = masterData[key];
        if (!val) return;

        // Strategy 1: ID Mapping
        const id = key.toLowerCase().replace(/\s/g, '_');
        const elById = document.getElementById(id);
        if (elById) {
            safeFill(elById, val);
            return;
        }

        // Strategy 2: Label Heuristics
        const labels = Array.from(document.querySelectorAll('label'));
        const targetLabel = labels.find(l => {
            const txt = l.innerText.toUpperCase().replace(':', '').trim();
            return txt === key || txt.includes(key);
        });

        if (targetLabel) {
            const input = document.getElementById(targetLabel.getAttribute('for')) ||
                targetLabel.querySelector('input, select, textarea') ||
                targetLabel.parentElement.querySelector('input, select, textarea') ||
                targetLabel.closest('.form-group, .row')?.querySelector('input, select, textarea');

            if (input) safeFill(input, val);
        }
    });
}

function safeFill(el, val) {
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !el.value) {
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.tagName === 'SELECT') {
        const options = Array.from(el.options);
        const match = options.find(o => o.text.toUpperCase() === val.toUpperCase() || val.toUpperCase().includes(o.text.toUpperCase()));
        if (match) {
            el.value = match.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}
