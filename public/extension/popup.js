document.addEventListener('DOMContentLoaded', () => {
    const detailsList = document.getElementById('details-list');
    const statusText = document.getElementById('status-text');

    function createItem(label, value, color = '#3b82f6', isHigh = false) {
        const div = document.createElement('div');
        div.className = 'detail-item';
        div.style.borderLeft = `4px solid ${color}`;
        if (isHigh) div.style.background = '#eff6ff';
        div.innerHTML = `
            <div class="label" style="color:${color}">${label}</div>
            <div class="value" style="${isHigh ? 'font-size:14px; font-weight:bold; color:#1e40af' : ''}">${value}</div>
        `;
        return div;
    }

    function update(data) {
        if (!data || !data.url || !data.url.includes('slt.lk')) {
            statusText.textContent = "SLT Portal Not Detected";
            detailsList.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8; font-size:11px;">Waiting for SLT i-Shamp Portal to be opened...</div>';
            return;
        }

        statusText.textContent = `User: ${data.currentUser || 'Detected'}`;
        detailsList.innerHTML = '';

        if (data.isBroadband) {
            const notice = document.createElement('div');
            notice.style = "background:#fff7ed; color:#9a3412; padding:8px; border-radius:6px; font-size:10px; margin-bottom:10px; border:1px solid #ffedd5; font-weight:bold; text-align:center";
            notice.textContent = "⚠️ BROADBAND DETECTED: SYNC RESTRICTED";
            detailsList.appendChild(notice);
        }

        if (data.soNum) {
            detailsList.appendChild(createItem('ACTIVE SERVICE ORDER', data.soNum, '#2563eb', true));
        }

        if (data.materialDetails && data.materialDetails.length > 0) {
            data.materialDetails.forEach(m => {
                const val = m.VALUE || m.QTY || 'N/A';
                detailsList.appendChild(createItem(`MATERIAL: ${m.ITEM}`, `${m.TYPE} (QTY: ${val})`, '#d97706'));
            });
        }

        const context = document.createElement('div');
        context.style = "font-size:10px; color:#64748b; margin-bottom:10px; text-align:center; border-top:1px solid #f1f5f9; padding-top:10px";
        context.textContent = `Tab: ${data.activeTab || 'N/A'}`;
        detailsList.appendChild(context);

        if (data.teamDetails) {
            Object.keys(data.teamDetails).forEach(k => detailsList.appendChild(createItem(k, data.teamDetails[k], '#0ea5e9')));
        }

        if (data.details) {
            Object.keys(data.details).forEach(k => {
                if (k === 'SERVICE ORDER' && data.details[k] === data.soNum) return;
                detailsList.appendChild(createItem(k, data.details[k]));
            });
        }
    }

    function refresh() {
        // 1. Get from storage cache first (always safe)
        chrome.storage.local.get(['lastScraped'], (res) => {
            if (res.lastScraped) update(res.lastScraped);
        });

        // 2. Request fresh data with AGGRESSIVE connection error suppression
        try {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (chrome.runtime.lastError || !tabs || tabs.length === 0) return;

                const tab = tabs[0];
                // Only attempt message if we are strictly on portal
                if (tab.url && tab.url.includes('serviceportal.slt.lk')) {
                    chrome.tabs.sendMessage(tab.id, { action: "getPortalData" }, (resp) => {
                        const err = chrome.runtime.lastError; // CRITICAL: Reading this suppresses the "Unchecked" error
                        if (!err && resp) {
                            update(resp);
                        }
                    });
                }
            });
        } catch {
            // Silently swallow any browser communication errors
        }
    }

    setInterval(refresh, 2000);
    refresh();
});
