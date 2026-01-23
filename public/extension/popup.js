document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabData = document.getElementById('tab-data');
    const tabDiag = document.getElementById('tab-diag');
    const viewData = document.getElementById('view-data');
    const viewDiag = document.getElementById('view-diag');

    tabData.addEventListener('click', () => {
        tabData.classList.add('active');
        tabDiag.classList.remove('active');
        viewData.style.display = 'block';
        viewDiag.style.display = 'none';
        refreshData();
    });

    tabDiag.addEventListener('click', () => {
        tabDiag.classList.add('active');
        tabData.classList.remove('active');
        viewDiag.style.display = 'block';
        viewData.style.display = 'none';
        refreshDiagnostics();
    });

    function updateDataUI(data) {
        if (data && data.url.includes('slt.lk')) {
            document.getElementById('status-text').textContent = "Monitoring SLT Portal";
            document.getElementById('data-card').style.display = 'block';
            document.getElementById('so-number').textContent = data.soNum || 'Searching for SO...';
            document.getElementById('cust-status').textContent = `${data.customerName || 'No Name'} | ${data.status || 'No Status'}`;
        } else {
            document.getElementById('status-text').textContent = "Please open SLT Portal to sync data";
            document.getElementById('data-card').style.display = 'none';
        }
    }

    function refreshData() {
        chrome.storage.local.get(['lastScraped'], (result) => {
            if (result.lastScraped) updateDataUI(result.lastScraped);
        });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab && activeTab.url.includes('slt.lk')) {
                chrome.tabs.sendMessage(activeTab.id, { action: "getPortalData" }, (response) => {
                    if (response) updateDataUI(response);
                });
            }
        });
    }

    function refreshDiagnostics() {
        chrome.storage.local.get(['diagnostics_slt', 'diagnostics_erp'], (res) => {
            // SLT Diagnostics
            const slt = res.diagnostics_slt;
            const sltStatus = document.getElementById('diag-slt-status');
            if (slt && slt.status === 'ACTIVE') {
                sltStatus.textContent = 'CONNECTED';
                sltStatus.className = 'status-badge bg-green';
                document.getElementById('diag-last-sync').textContent = slt.lastScrapeTime || '-';
                document.getElementById('diag-fields').textContent = slt.elementsFound || '0';
            } else {
                sltStatus.textContent = 'NO PORTAL TAB';
                sltStatus.className = 'status-badge bg-red';
            }

            // ERP Diagnostics
            const erp = res.diagnostics_erp;
            const erpStatus = document.getElementById('diag-erp-status');
            if (erp) {
                erpStatus.textContent = 'DETECTED';
                erpStatus.className = 'status-badge bg-green';
            } else {
                erpStatus.textContent = 'NOT DETECTED';
                erpStatus.className = 'status-badge bg-red';
            }
        });
    }

    // Initial Load
    refreshData();
    setInterval(refreshData, 3000);
});
