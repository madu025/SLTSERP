/**
 * SLT-ERP Bridge (manifest-driven version)
 * Consent page controller — records the user's affirmative choice.
 * consentGiven === true is the ONLY signal that unlocks data collection
 * in the background worker, content scripts and popup.
 */

document.addEventListener('DOMContentLoaded', () => {
    const agreeBtn = document.getElementById('agree');
    const declineBtn = document.getElementById('decline');
    const status = document.getElementById('status');

    function lockButtons() {
        agreeBtn.disabled = true;
        declineBtn.disabled = true;
    }

    agreeBtn.addEventListener('click', () => {
        lockButtons();
        chrome.storage.local.set({
            consentGiven: true,
            consentAt: new Date().toISOString()
        }, () => {
            status.className = 'status ok';
            status.innerText = 'Consent recorded. Sync is now enabled — you can close this tab.';
            // Wake the background worker so the pending session sync runs now.
            chrome.runtime.sendMessage({ action: 'consentGranted' }, () => void chrome.runtime.lastError);
        });
    });

    declineBtn.addEventListener('click', () => {
        lockButtons();
        chrome.storage.local.set({
            consentGiven: false,
            consentAt: new Date().toISOString()
        }, () => {
            status.className = 'status warn';
            status.innerText = 'Consent declined. The extension will not collect or transmit any data — you can close this tab.';
        });
    });
});
