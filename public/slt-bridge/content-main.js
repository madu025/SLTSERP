/**
 * SLT-ERP PHOENIX ELITE v4.4.0
 * World: MAIN
 * Role: ERP Smart Injector
 */

console.log('%c[i-SHAMP-INJECTOR] Engaged', 'color: #3b82f6; font-weight: bold;');

// 1. Identity Verification (Shared with ERP UI)
(function () {
    const version = "4.4.2";
    document.documentElement.setAttribute('data-ishamp-bridge', 'active');
    document.documentElement.setAttribute('data-ishamp-version', version);

    // Legacy support
    document.documentElement.setAttribute('data-phoenix-bridge', 'active');
    document.documentElement.setAttribute('data-slt-bridge-installed', 'true');

    // Dispatch for React components (Now in MAIN world, so this works!)
    window.dispatchEvent(new CustomEvent('SLT_BRIDGE_DETECTED', {
        detail: { version: version }
    }));

    console.log(`%c[i-SHAMP] Bridge Identity Verified (v${version})`, 'color: #10b981; font-weight: bold;');
})();

window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data.payload) return;

    if (event.data.type === 'FROM_PHOENIX_BRIDGE') {
        const data = event.data.payload;
        console.log('[PHOENIX-INJECTOR] Processing SO:', data.soNum);
        applySmartFill(data);
    }
});

function applySmartFill(data) {
    const allCaptured = data.allTabs || {};

    // Combine all captured data for maximum coverage
    const masterData = {};
    Object.values(allCaptured).forEach(tabData => {
        Object.assign(masterData, tabData);
    });

    Object.keys(masterData).forEach(key => {
        const val = masterData[key];
        if (!val) return;

        // Strategy 1: ID Mapping (e.g. "SERVICE ORDER" -> id="service_order")
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
    // Avoid overwriting if manual input exists
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !el.value) {
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`%c[PHOENIX] Filled ${el.id || el.name}: ${val}`, 'color: #10b981');
    } else if (el.tagName === 'SELECT') {
        // Find best matching option
        const options = Array.from(el.options);
        const match = options.find(o => o.text.toUpperCase() === val.toUpperCase() || val.toUpperCase().includes(o.text.toUpperCase()));
        if (match) {
            el.value = match.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}