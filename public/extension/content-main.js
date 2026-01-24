// This script runs in the MAIN world of the ERP page
// It has access to the page's window object directly
(function () {
    window.SLT_BRIDGE_INSTALLED = true;
    window.SLT_BRIDGE_VERSION = "1.0.8";

    // Dispatch events
    const event = new CustomEvent('SLT_BRIDGE_DETECTED', {
        detail: {
            version: "1.0.8",
            status: 'active'
        }
    });
    window.dispatchEvent(event);
    document.dispatchEvent(event);

    console.log("🚀 SLT-ERP Bridge Trace: Main-World Signal Active [v1.0.8]");
})();
