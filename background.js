// Track last fetch time per tab to prevent duplicate calls
const tabFetchTimestamps = new Map();
const FETCH_COOLDOWN = 10000; // 10 seconds cooldown between auto-fetches

// Store badge data for quick updates
let lastBadgeData = {
  text: "",
  hours: 0,
  minutes: 0
};

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the page is fully loaded and is a Keka page
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("keka.com")
  ) {
    // Check if we recently fetched for this tab
    const lastFetchTime = tabFetchTimestamps.get(tabId) || 0;
    const now = Date.now();

    if (now - lastFetchTime < FETCH_COOLDOWN) {
      return;
    }

    tabFetchTimestamps.set(tabId, now);

    // Wait a moment for the page to be fully initialized
    setTimeout(() => {
      // Send message to content script to trigger data fetch
      chrome.tabs.sendMessage(
        tabId,
        { action: "autoFetchData" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.log(
              `❌ Tab ${tabId}: Failed to send message:`,
              chrome.runtime.lastError.message
            );
          } else {
            console.log(`✅ Tab ${tabId}: AutoFetch response:`, response);
          }
        }
      );
    }, 2000); // Wait 2 seconds for the page to fully initialize
  }
});

// Clean up timestamps when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabFetchTimestamps.delete(tabId);
});

// Listen for popup disconnect events
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    // When the popup connects, we note the connection
    port.onDisconnect.addListener(() => {
      // When the popup disconnects, send a message to ensure the timer keeps running
      chrome.tabs.query({ url: "*://*.keka.com/*" }, (tabs) => {
        if (tabs.length > 0) {
          tabs.forEach((tab) => {
            chrome.tabs.sendMessage(
              tab.id,
              { action: "ensureTimerRunning" },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.log(
                    `❌ Tab ${tab.id}: Failed to ensure timer:`,
                    chrome.runtime.lastError.message
                  );
                } else {
                  console.log(`✅ Tab ${tab.id}: Timer ensured`);
                }
              }
            );
          });
        }
      });
    });
  }
});

// Optional: Clear old timestamps periodically (cleanup)
setInterval(() => {
  const now = Date.now();
  for (const [tabId, timestamp] of tabFetchTimestamps.entries()) {
    if (now - timestamp > 300000) {
      // 5 minutes old
      tabFetchTimestamps.delete(tabId);
    }
  }
}, 60000); // Run cleanup every minute

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateBadge") {
    // Update badge with effective hours
    const { text, hours, minutes } = request;
    
    // Store last badge data
    lastBadgeData = { text, hours, minutes };
    
    // Set badge text (e.g., "6:30")
    chrome.action.setBadgeText({ text: text });
    
    // Set badge background color based on hours
    let badgeColor = "#3b82f6"; // Blue (default)
    
    if (hours >= 9) {
      badgeColor = "#10b981"; // Green (9+ hours - target reached)
    } else if (hours >= 7) {
      badgeColor = "#f59e0b"; // Orange (7-9 hours - almost there)
    } else if (hours >= 5) {
      badgeColor = "#3b82f6"; // Blue (5-7 hours - halfway)
    } else {
      badgeColor = "#8b5cf6"; // Purple (0-5 hours - just started)
    }
    
    chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    
    // Set tooltip text
    chrome.action.setTitle({ 
      title: `Keka Tracker - Effective: ${text} hrs` 
    });
    
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open for async response
});

