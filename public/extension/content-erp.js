// Enhanced Detection & Diagnostics for ERP Domain
function injectSignal() {
    // Generate diagnostic info
    const diagInfo = {
        extensionId: chrome.runtime.id,
        manifestVersion: chrome.runtime.getManifest().version,
        detectedAt: new Date().toISOString(),
        url: window.location.href
    };

    const script = document.createElement('script');
    script.textContent = `
        (function() {
            window.SLT_BRIDGE_INSTALLED = true;
            window.SLT_BRIDGE_VERSION = "${diagInfo.manifestVersion}";
            window.SLT_BRIDGE_DIAGNOSTICS = ${JSON.stringify(diagInfo)};
            document.documentElement.setAttribute('data-slt-bridge-installed', 'true');
            document.documentElement.setAttribute('data-slt-bridge-version', "${diagInfo.manifestVersion}");
            
            const event = new CustomEvent('SLT_BRIDGE_DETECTED', { 
                detail: { 
                    version: "${diagInfo.manifestVersion}", 
                    status: 'active',
                    diagnostics: ${JSON.stringify(diagInfo)}
                } 
            });
            window.dispatchEvent(event);
            document.dispatchEvent(event);

            console.log("🚀 SLT-ERP Bridge Trace: Signal Injected [v${diagInfo.manifestVersion}]");
        })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();

    // Update internal storage
    chrome.storage.local.set({ diagnostics_erp: diagInfo });
}

injectSignal();
document.documentElement.setAttribute('data-slt-bridge-installed', 'true');
