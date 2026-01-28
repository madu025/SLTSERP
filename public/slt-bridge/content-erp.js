/**
 * SLT-ERP i-SHAMP BRIDGE v4.4.0
 * World: ISOLATED
 * Role: ERP Identity & Bridge
 */

(function () {
    const version = "4.4.0";

    // Set identity for ERP website to detect the extension
    document.documentElement.setAttribute('data-ishamp-bridge', 'active');
    document.documentElement.setAttribute('data-ishamp-version', version);

    // Legacy support
    document.documentElement.setAttribute('data-phoenix-bridge', 'active');
    document.documentElement.setAttribute('data-slt-bridge-installed', 'true');
    document.documentElement.setAttribute('data-slt-bridge-version', version);

    // Dispatch detection event for React components
    window.dispatchEvent(new CustomEvent('SLT_BRIDGE_DETECTED', {
        detail: { version: version }
    }));

    // Sync Diagnostics
    chrome.storage.local.get(['lastScraped'], (res) => {
        const info = {
            detectedAt: new Date().toISOString(),
            version: version,
            status: 'CONNECTED',
            lastSO: res.lastScraped?.soNum || 'NONE'
        };
        chrome.storage.local.set({ diagnostics_erp: info });
    });

    console.log(`%c[i-SHAMP] Bridge v${version} Ready on ERP`, 'color: #10b981; font-weight: bold;');
})();

