document.addEventListener('DOMContentLoaded', () => {
    const tabData = document.getElementById('tab-data');
    const tabDiag = document.getElementById('tab-diag');
    const viewData = document.getElementById('view-data');
    const viewDiag = document.getElementById('view-diag');
    const detailsList = document.getElementById('details-list');
    const statusText = document.getElementById('status-text');

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
        if (!data || !data.url.includes('slt.lk')) {
            statusText.textContent = "Please navigate to the SLT Portal to see data.";
            detailsList.innerHTML = '';
            return;
        }

        statusText.textContent = "Monitoring SLT Portal Data";
        detailsList.innerHTML = '';

        const details = data.details || {};
        const keys = Object.keys(details);

        if (keys.length === 0) {
            detailsList.innerHTML = '<div class="empty-state">No specific details detected yet. Try refreshing the SLT page.</div>';
            return;
        }

        keys.forEach(key => {
            const item = document.createElement('div');
            item.className = 'detail-item';
            item.innerHTML = `
                <div class="label">${key}</div>
                <div class="value">${details[key]}</div>
            `;
            detailsList.appendChild(item);
        });
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
                }).catch(() => {
                    // Script not injected yet?
                });
            }
        });
    }

    function refreshDiagnostics() {
        chrome.storage.local.get(['diagnostics_slt', 'diagnostics_erp'], (res) => {
            const slt = res.diagnostics_slt;
            const sltStatus = document.getElementById('diag-slt-status');
            if (slt && slt.status === 'ACTIVE') {
                sltStatus.textContent = 'CONNECTED';
                sltStatus.className = 'status-badge bg-green';
                document.getElementById('diag-last-sync').textContent = slt.lastScrapeTime || '-';
                document.getElementById('diag-fields').textContent = slt.elementsFound || '0';
            } else {
                sltStatus.textContent = 'NOT FOUND';
                sltStatus.className = 'status-badge bg-red';
            }

            const erp = res.diagnostics_erp;
            const erpStatus = document.getElementById('diag-erp-status');
            if (erp) {
                erpStatus.textContent = 'DETECTED';
                erpStatus.className = 'status-badge bg-green';
            } else {
                erpStatus.textContent = 'NOT FOUND';
                erpStatus.className = 'status-badge bg-red';
            }
        });
    }

    refreshData();
    setInterval(refreshData, 3000);
});
