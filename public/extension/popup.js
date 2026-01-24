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

    function createDetailItem(label, value, color = '#3b82f6') {
        const item = document.createElement('div');
        item.className = 'detail-item';
        item.style.borderLeftColor = color;
        item.innerHTML = `
            <div class="label" style="color:${color}">${label}</div>
            <div class="value">${value}</div>
        `;
        return item;
    }

    function updateDataUI(data) {
        if (!data || !data.url.includes('slt.lk')) {
            statusText.textContent = "Please navigate to SLT Portal (e.g. SOD Details).";
            detailsList.innerHTML = '';
            return;
        }

        statusText.textContent = `Monitoring: ${data.soNum || 'Unknown SOD'}`;
        detailsList.innerHTML = '';

        // 1. Team & Serials Section
        if (data.teamDetails && Object.keys(data.teamDetails).length > 0) {
            const header = document.createElement('div');
            header.className = 'section-header';
            header.innerHTML = '<div class="label" style="background:#e0f2fe; padding:4px 8px; border-radius:4px; margin-bottom:8px">TEAM & SERIALS</div>';
            detailsList.appendChild(header);

            Object.keys(data.teamDetails).forEach(key => {
                detailsList.appendChild(createDetailItem(key, data.teamDetails[key], '#0ea5e9'));
            });
        }

        // 2. Material Section
        if (data.materialDetails && data.materialDetails.length > 0) {
            const header = document.createElement('div');
            header.className = 'section-header';
            header.innerHTML = '<div class="label" style="background:#fef3c7; padding:4px 8px; border-radius:4px; margin-top:12px; margin-bottom:8px">MATERIAL USAGE</div>';
            detailsList.appendChild(header);

            data.materialDetails.forEach((mat, idx) => {
                const matText = Object.entries(mat).map(([k, v]) => `${k}: ${v}`).join(' | ');
                detailsList.appendChild(createDetailItem(`ITEM ${idx + 1}`, matText, '#d97706'));
            });
        }

        // 3. Other Details
        const otherKeys = Object.keys(data.details || {});
        if (otherKeys.length > 0) {
            const header = document.createElement('div');
            header.className = 'section-header';
            header.innerHTML = '<div class="label" style="background:#f1f5f9; padding:4px 8px; border-radius:4px; margin-top:12px; margin-bottom:8px">ORDER DETAILS</div>';
            detailsList.appendChild(header);

            otherKeys.forEach(key => {
                detailsList.appendChild(createDetailItem(key, data.details[key]));
            });
        }

        if (detailsList.innerHTML === '') {
            detailsList.innerHTML = '<div class="empty-state">Waiting for data to load... Click on the tabs in SLT portal to trigger capture.</div>';
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
                }).catch(() => { });
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
