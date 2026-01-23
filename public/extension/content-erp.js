// This script runs on our ERP domain to signal presence
(function () {
    window.SLT_BRIDGE_VERSION = "1.0.0";
    document.documentElement.setAttribute('data-slt-bridge-installed', 'true');

    // Dispatch event so React components can listen
    window.dispatchEvent(new CustomEvent('SLT_BRIDGE_DETECTED', {
        detail: { version: "1.0.0", status: 'active' }
    }));

    console.log("🚀 SLT-ERP Bridge Detected & Signaling ERP...");
})();
