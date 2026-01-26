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

    function createDetailItem(label, value, color = '#3b82f6', subtext = '', isPrimary = false) {
        const item = document.createElement('div');
        item.className = 'detail-item';
        if (isPrimary) {
            item.style.borderLeftWidth = '5px';
            item.style.background = '#eff6ff';
        }
        item.style.borderLeftColor = color;
        item.innerHTML = `
            <div class="label" style="color:${color}">${label}</div>
            <div class="value" style="${isPrimary ? 'font-size:14px; color:#1e3a8a; font-weight:bold' : ''}">${value}</div>
            ${subtext ? `<div style="font-size:9px; color:#94a3b8; margin-top:2px">${subtext}</div>` : ''}
        `;
        return item;
    }

    function updateDataUI(data) {
        if (!data || !data.url.includes('slt.lk')) {
            statusText.textContent = "Please navigate to SLT Portal.";
            detailsList.innerHTML = '';
            return;
        }

        statusText.textContent = `User: ${data.currentUser || 'Identifying...'}`;
        statusText.style.color = '#22c55e';
        detailsList.innerHTML = '';

        // 0. Primary Service Order (Master Key)
        if (data.soNum) {
            detailsList.appendChild(createDetailItem('ACTIVE SERVICE ORDER', data.soNum, '#2563eb', 'Primary identifier being used for sync.', true));
        }

        // Context Badge
        const contextBadge = document.createElement('div');
        contextBadge.style = "font-size:9px; font-weight:bold; background:#f1f5f9; padding:2px 8px; border-radius:10px; display:inline-block; margin-bottom:10px; color:#64748b";
        contextBadge.textContent = `TAB: ${data.activeTab || 'N/A'}`;
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

        // 3. System Tags
        if (data.hiddenInfo && Object.keys(data.hiddenInfo).length > 0) {
            const hkeys = Object.keys(data.hiddenInfo);
            const val = hkeys.map(k => `${k}:${data.hiddenInfo[k]}`).join(' | ');
            detailsList.appendChild(createDetailItem('SYSTEM TAGS', val, '#8b5cf6'));
        }

        // 4. Core Details Table
        const coreKeys = Object.keys(data.details || {});
        coreKeys.forEach(key => {
            if (key === 'SERVICE ORDER' && data.details[key] === data.soNum) return; // Skip if redundant
            detailsList.appendChild(createDetailItem(key, data.details[key]));
        });

        // 5. Voice Test
        if (data.voiceTest && Object.keys(data.voiceTest).length > 0) {
            const vtKeys = Object.keys(data.voiceTest);
            const val = vtKeys.map(k => `${k}: ${data.voiceTest[k]}`).join(', ');
            detailsList.appendChild(createDetailItem('VOICE TEST RESULTS', val, '#10b981'));
        }
    }

    async function refreshData() {
        chrome.storage.local.get(['lastScraped'], (result) => {
            if (result.lastScraped) updateDataUI(result.lastScraped);
        });

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url && tab.url.includes('slt.lk')) {
                const response = await chrome.tabs.sendMessage(tab.id, { action: "getPortalData" }).catch(() => null);
                if (response) updateDataUI(response);
            }
        } catch (err) { }
    }

    function refreshDiagnostics() {
        chrome.storage.local.get(['diagnostics_slt', 'diagnostics_erp'], (res) => {
            const slt = res.diagnostics_slt;
            if (slt) {
                document.getElementById('diag-slt-status').textContent = 'ACTIVE';
                document.getElementById('diag-slt-status').className = 'status-badge bg-green';
                document.getElementById('diag-last-sync').textContent = slt.lastScrapeTime || '-';
                document.getElementById('diag-fields').textContent = slt.elementsFound || '0';
            }
        });
    }

    refreshData();
    setInterval(refreshData, 2000);
});
