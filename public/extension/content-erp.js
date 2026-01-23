// This script runs on our ERP domain
function injectSignal() {
    const script = document.createElement('script');
    script.textContent = `
        (function() {
            window.SLT_BRIDGE_INSTALLED = true;
            window.SLT_BRIDGE_VERSION = "1.0.1";
            document.documentElement.setAttribute('data-slt-bridge-installed', 'true');
            
            // Dispatch to both window and document to be safe
            const event = new CustomEvent('SLT_BRIDGE_DETECTED', { 
                detail: { version: "1.0.1", status: 'active' } 
            });
            window.dispatchEvent(event);
            document.dispatchEvent(event);

            console.log("🚀 SLT-ERP Bridge Signal Injected Successfully");
        })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
}

// Run immediately
injectSignal();

// Also set attribute in content script world just in case
document.documentElement.setAttribute('data-slt-bridge-installed', 'true');
