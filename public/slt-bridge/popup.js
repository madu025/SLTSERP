/**
 * PHOENIX BRIDGE v3.0.0
 * Popup Logic: Modern Reactive Bridge
 */

document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('list');
    const statusText = document.getElementById('status-text');

    // Tab Management
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const viewData = document.getElementById('view-data');
            const viewDiag = document.getElementById('view-diag');
            if (tab.id === 'tab-data') {
                viewData.style.display = 'block';
                viewDiag.style.display = 'none';
            } else {
                viewData.style.display = 'none';
                viewDiag.style.display = 'block';
            }
        });
    });

    function render(data) {
        if (!data || !data.soNum) {
            statusText.innerText = "Waiting for SLT Portal...";
            list.innerHTML = `<div class="empty">📡<br><br><span style="font-size:11px">Navigate to a Service Order to begin synchronization.</span></div>`;
            return;
        }

        statusText.innerText = `PHOENIX ACTIVE: ${data.soNum}`;
        list.innerHTML = '';

        // 1. Details
        const details = data.details || {};
        Object.entries(details).forEach(([k, v]) => {
            const card = document.createElement('div');
            card.className = 'detail-card';
            card.innerHTML = `<div class="label">${k}</div><div class="value">${v}</div>`;
            list.appendChild(card);
        });

        // 2. Materials
        if (data.materialDetails?.length > 0) {
            const matCard = document.createElement('div');
            matCard.className = 'detail-card';
            matCard.style.borderLeftColor = '#f59e0b';
            matCard.innerHTML = `<div class="label">MATERIALS</div><div class="value">${data.materialDetails.length} Items Captured</div>`;
            list.appendChild(matCard);
        }

        // Diagnostics
        document.getElementById('diag-so').innerText = data.soNum;
        document.getElementById('diag-fields').innerText = `${Object.keys(details).length + (data.materialDetails?.length || 0)} Fields`;

        const lastSync = new Date(data.timestamp);
        const diff = Math.floor((new Date() - lastSync) / 1000);
        document.getElementById('diag-sync').innerText = diff < 5 ? 'Real-time' : `${diff}s ago`;
    }

    // Polling
    setInterval(() => {
        chrome.storage.local.get(['lastScraped'], res => render(res.lastScraped));
    }, 1500);

    chrome.storage.local.get(['lastScraped'], res => render(res.lastScraped));
});
