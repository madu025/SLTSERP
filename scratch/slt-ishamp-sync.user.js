// ==UserScript==
// @name         SLTS Nexus - i-Shamp PAT Auto-Sync
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatically synchronize PAT details and comments from SLT iShamp portal to SLTSERP.
// @author       SLTS Dev
// @match        https://serviceportal.slt.lk/iShamp/contr/pat_details?sod=*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-end
// ==UserScript==

(function() {
    'use strict';

    // 1. Create Premium UI Indicator/Console overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.bottom = '20px';
    overlay.style.right = '20px';
    overlay.style.padding = '12px 18px';
    overlay.style.backgroundColor = '#1e293b';
    overlay.style.color = '#f8fafc';
    overlay.style.fontFamily = 'Inter, system-ui, sans-serif';
    overlay.style.fontSize = '12px';
    overlay.style.borderRadius = '8px';
    overlay.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.gap = '10px';
    overlay.style.border = '1px solid #334155';
    overlay.style.transition = 'all 0.3s ease';

    const statusDot = document.createElement('span');
    statusDot.style.width = '8px';
    statusDot.style.height = '8px';
    statusDot.style.borderRadius = '50%';
    statusDot.style.backgroundColor = '#fbbf24'; // Warning amber initially
    statusDot.style.display = 'inline-block';

    const statusText = document.createElement('span');
    statusText.textContent = 'SLTS Sync: Initializing...';
    statusText.style.fontWeight = '500';

    overlay.appendChild(statusDot);
    overlay.appendChild(statusText);
    document.body.appendChild(overlay);

    function updateStatus(text, type) {
        statusText.textContent = `SLTS Sync: ${text}`;
        if (type === 'success') {
            statusDot.style.backgroundColor = '#10b981'; // green
            overlay.style.borderColor = '#10b981';
        } else if (type === 'error') {
            statusDot.style.backgroundColor = '#ef4444'; // red
            overlay.style.borderColor = '#ef4444';
        } else if (type === 'warn') {
            statusDot.style.backgroundColor = '#f59e0b'; // orange
            overlay.style.borderColor = '#f59e0b';
        } else {
            statusDot.style.backgroundColor = '#fbbf24'; // amber
            overlay.style.borderColor = '#334155';
        }
    }

    // 2. Parse URL to get SOD Number
    const urlParams = new URLSearchParams(window.location.search);
    const sodNum = urlParams.get('sod')?.split('_')[0]; // Extract primary SO Number

    if (!sodNum) {
        updateStatus('No SOD number in URL', 'error');
        return;
    }

    // 3. Scrape PAT details from the DOM (strictly read-only)
    function scrapePageData() {
        const allTabs = {};
        const teamDetails = {};
        const materialDetails = [];
        const forensicAudit = [];

        // Scrape key-value pairs from tables
        const mainDetails = {};
        document.querySelectorAll('table tr').forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 2) {
                const label = cells[0].textContent?.trim().replace(/:$/, '');
                const val = cells[1].textContent?.trim();
                if (label && val && !cells[1].querySelector('input, textarea')) {
                    mainDetails[label] = val;
                }
            }
        });
        allTabs['Details'] = mainDetails;

        // Scrape comments and input values
        document.querySelectorAll('input[type="text"], textarea, select').forEach(el => {
            const label = el.closest('td')?.previousElementSibling?.textContent?.trim() || el.name || el.id;
            if (label && el.value) {
                mainDetails[label] = el.value || el.options?.[el.selectedIndex]?.text || '';
            }
        });

        // Scrape comments if they exist in tables
        const commentsList = [];
        document.querySelectorAll('table').forEach(table => {
            const text = table.textContent.toLowerCase();
            if (text.includes('comment date') || text.includes('comment user') || text.includes('comment')) {
                table.querySelectorAll('tr').forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 3) {
                        const dateText = cells[0].textContent?.trim();
                        const userText = cells[1].textContent?.trim();
                        const commentText = cells[2].textContent?.trim();
                        if (dateText && commentText && !dateText.toLowerCase().includes('date')) {
                            commentsList.push({
                                date: dateText,
                                user: userText,
                                comment: commentText
                            });
                        }
                    }
                });
            }
        });

        // Scrape materials if they exist in tables
        document.querySelectorAll('table').forEach(table => {
            const text = table.textContent.toLowerCase();
            if (text.includes('material') || text.includes('qty')) {
                table.querySelectorAll('tr').forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const mName = cells[0].textContent?.trim();
                        const mQty = cells[1].textContent?.trim();
                        if (mName && mQty && !isNaN(parseFloat(mQty))) {
                            materialDetails.push({
                                NAME: mName,
                                QTY: mQty,
                                qty: parseFloat(mQty),
                                SERIAL: cells[2]?.textContent?.trim() || ''
                            });
                        }
                    }
                });
            }
        });

        // Try to identify current logged-in user from header
        let currentUser = 'SLT_USER';
        const userEl = document.querySelector('.username, .profile-info, .user-name, #user-name');
        if (userEl) currentUser = userEl.textContent.trim();

        return {
            soNum: sodNum,
            allTabs,
            teamDetails,
            materialDetails,
            commentsList,
            forensicAudit,
            currentUser,
            activeTab: 'PAT_DETAILS',
            url: window.location.href
        };
    }

    // 4. Send background POST request to local SLTSERP endpoint
    async function triggerSync() {
        updateStatus('Extracting page data...', 'running');
        const payload = scrapePageData();

        updateStatus('Syncing with SLTSERP...', 'running');

        // We use GM_xmlhttpRequest to bypass CORS restrictions
        GM_xmlhttpRequest({
            method: 'POST',
            url: 'http://localhost:3000/api/service-orders/bridge-sync',
            headers: {
                'Content-Type': 'application/json',
                'x-extension-key': 'slt-bridge-secret-2026' // Extension secret auth
            },
            data: JSON.stringify(payload),
            onload: function(response) {
                if (response.status === 200) {
                    const res = JSON.parse(response.responseText);
                    if (res.success) {
                        updateStatus('Successfully Synchronized!', 'success');
                    } else {
                        updateStatus(res.error || 'Sync update failed', 'error');
                    }
                } else if (response.status === 409) {
                    updateStatus('Sync Blocked: Update in progress by another user', 'warn');
                } else {
                    updateStatus(`HTTP ${response.status} - Sync Error`, 'error');
                }
            },
            onerror: function(err) {
                console.error('Tampermonkey sync error:', err);
                updateStatus('Cannot connect to SLTSERP server (Is it running?)', 'error');
            }
        });
    }

    // Run automatically after a 1.5s delay to allow DOM dynamic elements to render
    setTimeout(triggerSync, 1500);

})();
