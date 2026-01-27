/**
 * SLT-ERP PHOENIX ELITE v3.1.0
 * World: ISOLATED
 * Role: ERP Identity & Bridge
 */

(function () {
    const version = "3.1.0";

    // Set identity for ERP website to detect the extension
    document.documentElement.setAttribute('data-phoenix-bridge', 'active');
    document.documentElement.setAttribute('data-phoenix-version', version);

    // Legacy support for ERP Header Detection
    document.documentElement.setAttribute('data-slt-bridge-installed', 'true');
    document.documentElement.setAttribute('data-slt-bridge-version', version);

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

    console.log(`%c⚡ PHOENIX ELITE v${version} Ready on ERP`, 'color: #10b981; font-weight: bold;');
})();
