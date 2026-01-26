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

    function createDetailItem(label, value, color = '#3b82f6', subtext = '') {
        const item = document.createElement('div');
        item.className = 'detail-item';
        item.style.borderLeftColor = color;
        item.innerHTML = `
            <div class="label" style="color:${color}">${label}</div>
            <div class="value">${value}</div>
            ${subtext ? `<div style="font-size:9px; color:#94a3b8; margin-top:2px">${subtext}</div>` : ''}
        `;
        return item;
    }

    function updateDataUI(data) {
        if (!data || !data.url.includes('slt.lk')) {
            statusText.textContent = "Please navigate to SLT Portal.";
            detailsList.innerHTML = '';
            statusText.style.color = '#ef4444';
            return;
        }

        statusText.textContent = `User: ${data.currentUser || 'Not Identified'}`;
        statusText.style.color = '#22c55e';
        detailsList.innerHTML = '';

        // Context Badge
        const contextBadge = document.createElement('div');
        contextBadge.style = "font-size:9px; font-weight:bold; background:#f1f5f9; padding:2px 8px; border-radius:10px; display:inline-block; margin-bottom:10px; color:#64748b";
        contextBadge.textContent = `ACTIVE TAB: ${data.activeTab || 'N/A'}`;
        detailsList.appendChild(contextBadge);

        // 1. Team Section
        if (data.teamDetails && Object.keys(data.teamDetails).length > 0) {
            Object.keys(data.teamDetails).forEach(key => {
                detailsList.appendChild(createDetailItem(key, data.teamDetails[key], '#0ea5e9'));
            });
        }

        // 2. Material Section
        if (data.materialDetails && data.materialDetails.length > 0) {
            data.materialDetails.forEach(mat => {
                const desc = mat.TYPE || '';
                const val = mat.VALUE || mat.QTY || '';
                const serial = mat.SERIAL ? ` | SN: ${mat.SERIAL}` : '';
                detailsList.appendChild(createDetailItem(mat.ITEM, `${desc}: ${val}${serial}`, '#d97706'));
            });
        }

        // 3. Hidden System Info (High Accuracy)
        if (data.hiddenInfo && Object.keys(data.hiddenInfo).length > 0) {
            const hkeys = Object.keys(data.hiddenInfo);
            const val = hkeys.map(k => `${k}:${data.hiddenInfo[k]}`).join(' | ');
            detailsList.appendChild(createDetailItem('SYSTEM TAGS', val, '#8b5cf6', 'Hidden identifiers captured from portal background.'));
        }

        // 4. Order Details
        const otherKeys = Object.keys(data.details || {});
        otherKeys.forEach(key => {
            detailsList.appendChild(createDetailItem(key, data.details[key]));
        });
    }

    async function refreshData() {
        // 1. Get from local storage first (last known state)
        chrome.storage.local.get(['lastScraped'], (result) => {
            if (result.lastScraped) updateDataUI(result.lastScraped);
        });

        // 2. Try to get fresh data from the active tab
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Only message if it's our target portal
            if (tab && tab.url && tab.url.includes('slt.lk')) {
                // Use promise-based sendMessage with a try-catch to suppress "Receiving end does not exist"
                const response = await chrome.tabs.sendMessage(tab.id, { action: "getPortalData" }).catch(err => {
                    // Suppress the error if the content script isn't ready or injected
                    return null;
                });

                if (response) updateDataUI(response);
            }
        } catch (err) {
            // Silently ignore tab query errors
        }
    }

    function refreshDiagnostics() {
        chrome.storage.local.get(['diagnostics_slt', 'diagnostics_erp'], (res) => {
            const slt = res.diagnostics_slt;
            if (slt && slt.status === 'ACTIVE') {
                document.getElementById('diag-slt-status').textContent = 'CONNECTED';
                document.getElementById('diag-slt-status').className = 'status-badge bg-green';
                document.getElementById('diag-last-sync').textContent = slt.lastScrapeTime || '-';
                document.getElementById('diag-fields').textContent = slt.elementsFound || '0';
            }

            const erp = res.diagnostics_erp;
            if (erp) {
                document.getElementById('diag-erp-status').textContent = 'DETECTED';
                document.getElementById('diag-erp-status').className = 'status-badge bg-green';
            }
        });
    }

    refreshData();
    setInterval(refreshData, 3000);
});
