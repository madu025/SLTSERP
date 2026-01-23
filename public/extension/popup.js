document.addEventListener('DOMContentLoaded', () => {
    // Check local storage for last scraped data
    chrome.storage.local.get(['lastScraped'], (result) => {
        if (result.lastScraped) {
            updateUI(result.lastScraped);
        }
    });

    // Also try to get fresh data via message
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.url.includes('slt.lk')) {
            chrome.tabs.sendMessage(activeTab.id, { action: "getPortalData" }, (response) => {
                if (response) {
                    updateUI(response);
                }
            });
        }
    });

    function updateUI(data) {
        document.getElementById('page-title').textContent = data.title || 'Unknown';
        document.getElementById('so-number').textContent = data.soNum || 'Not found on this page';
        if (data.soNum) {
            document.getElementById('so-number').style.color = '#2563eb';
            document.getElementById('so-number').style.fontWeight = 'bold';
        }
    }
});
