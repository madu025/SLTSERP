// This script runs on SLT Portal (serviceportal.slt.lk)
console.log("🔍 SLT Bridge Scraper Active on Portal");

function scrapePortalData() {
    // This is a placeholder for real scraping logic
    // We will look for SO numbers, customer names, etc.
    const data = {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        title: document.title
    };

    // Example: Find SO Number if present on page
    const text = document.body.innerText;
    const soMatch = text.match(/SO\/\d+/);
    if (soMatch) {
        data.soNum = soMatch[0];
    }

    return data;
}

// Update storage so popup can see it
chrome.storage.local.set({ lastScraped: scrapePortalData() });

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPortalData") {
        sendResponse(scrapePortalData());
    }
});
