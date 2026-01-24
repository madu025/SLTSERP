// This script runs in the ISOLATED world (Default)
(function () {
    const diagInfo = {
        detectedAt: new Date().toISOString(),
        version: "1.0.9",
        status: 'ACTIVE'
    };

    document.documentElement.setAttribute('data-slt-bridge-installed', 'true');
    document.documentElement.setAttribute('data-slt-bridge-version', "1.0.9");

    // Update storage so popup can see it
    chrome.storage.local.set({ diagnostics_erp: diagInfo });

    console.log("🛠️ SLT-ERP Bridge: Isolated Identity Set");
})();
