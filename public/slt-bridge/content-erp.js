/**
 * SLT-ERP i-SHAMP BRIDGE v4.5.0
 * World: ISOLATED
 * Role: ERP Identity & Bridge
 */

(function () {
    const version = "4.5.0";

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

    // Listen for background sync success
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'SYNC_SUCCESS') {
            console.log(`[i-SHAMP-BRIDGE] Notifying ERP UI of successful sync for ${msg.payload?.soNum}`);
            window.dispatchEvent(new CustomEvent('SLT_BRIDGE_SYNC_SUCCESS', {
                detail: msg.payload
            }));
        }
    });

    // Save ERP origin dynamically to chrome storage
    chrome.storage.local.set({ erpOrigin: window.location.origin }, () => {
        console.log(`[i-SHAMP-BRIDGE] Saved active ERP Origin: ${window.location.origin}`);
    });

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

