// This script runs in the ISOLATED world (Default)
// It only sets DOM attributes which don't violate CSP
(function () {
    document.documentElement.setAttribute('data-slt-bridge-installed', 'true');
    document.documentElement.setAttribute('data-slt-bridge-version', "1.0.4");
    console.log("🛠️ SLT-ERP Bridge: DOM Attributes Set");
})();
