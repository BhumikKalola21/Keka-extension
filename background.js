// Track last fetch time per tab to prevent duplicate calls
const tabFetchTimestamps = new Map();
const FETCH_COOLDOWN = 10000; // 10 seconds cooldown between auto-fetches

// Store badge data for quick updates
let lastBadgeData = {
  text: "",
  hours: 0,
  minutes: 0
};

const DEFAULT_WORK_MINUTES = 9 * 60; // 9 hours

function fmtTime(h, m, s) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
}
function fmtTimeHMM(h, m) {
  const p = (n) => String(n).padStart(2, "0");
  return `${h}:${p(m)}`;
}
function fmt12(h, m, s) {
  const p = (n) => String(n).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${p(m)}:${p(s)} ${ampm}`;
}
function fmt12HMM(h, m) {
  const p = (n) => String(n).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${p(m)} ${ampm}`;
}
function timeFromIso(iso) {
  if (!iso) return null;
  const t = iso.split("T")[1];
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return fmt12HMM(h, m || 0);
}

// Compute full metrics from Keka API for popup when not on Keka tab
function computeFullMetricsFromTimeEntries(timeEntries, firstLogOfTheDay, workMinutes = DEFAULT_WORK_MINUTES) {
  const totalWorkMs = workMinutes * 60 * 1000;
  const empty = {
    firstCheckInFormatted: "--:--",
    lastClockInFormatted: "--:--",
    lastClockOutFormatted: "--:--",
    effectiveFormatted: "0:00",
    timeLeftFormatted: `${Math.floor(workMinutes / 60)}:${pad(workMinutes % 60)}`,
    grossFormatted: "0:00",
    breakMinutes: 0,
    expectedCheckout: "N/A",
    remainingMs: totalWorkMs,
  };
  if (!Array.isArray(timeEntries) || timeEntries.length === 0) {
    if (firstLogOfTheDay) empty.firstCheckInFormatted = timeFromIso(firstLogOfTheDay) || "--:--";
    return empty;
  }
  const sorted = timeEntries
    .filter((l) => !l.isDeleted)
    .map((l) => ({
      time: new Date(l.timestamp),
      status: l.modifiedPunchStatus ?? l.punchStatus,
    }))
    .filter((l) => l.status === 0 || l.status === 1)
    .sort((a, b) => a.time - b.time);
  let effectiveMs = 0;
  let openIn = null;
  let firstPunchTime = null;
  let lastPunchTime = null;
  let lastClockIn = null;
  let lastClockOut = null;
  const now = new Date();
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].status === 0 && !lastClockIn) lastClockIn = sorted[i].time;
    if (sorted[i].status === 1 && !lastClockOut) lastClockOut = sorted[i].time;
    if (lastClockIn && lastClockOut) break;
  }
  for (const log of sorted) {
    if (!firstPunchTime) firstPunchTime = log.time;
    lastPunchTime = log.time;
    if (log.status === 0) {
      if (!openIn) openIn = log.time;
    } else if (log.status === 1 && openIn) {
      effectiveMs += log.time - openIn;
      openIn = null;
    }
  }
  if (openIn) effectiveMs += now - openIn;
  const grossMs = firstPunchTime ? (openIn ? now : lastPunchTime) - firstPunchTime : 0;
  const breakMs = Math.max(0, grossMs - effectiveMs);
  const remainingMs = Math.max(0, totalWorkMs - effectiveMs);
  const effH = Math.floor(effectiveMs / 3600000);
  const effM = Math.floor((effectiveMs % 3600000) / 60000);
  const effS = Math.floor((effectiveMs % 60000) / 1000);
  const grossH = Math.floor(grossMs / 3600000);
  const grossM = Math.floor((grossMs % 3600000) / 60000);
  const grossS = Math.floor((grossMs % 60000) / 1000);
  const leftH = Math.floor(remainingMs / 3600000);
  const leftM = Math.floor((remainingMs % 3600000) / 60000);
  const leftS = Math.floor((remainingMs % 60000) / 1000);
  let expectedCheckout = "N/A";
  if (firstPunchTime && remainingMs > 0) {
    const outTime = new Date(firstPunchTime.getTime() + totalWorkMs + breakMs);
    expectedCheckout = fmt12HMM(outTime.getHours(), outTime.getMinutes());
  } else if (firstPunchTime && remainingMs <= 0) expectedCheckout = "Completed";
  const firstLog = firstLogOfTheDay || (firstPunchTime ? firstPunchTime.toISOString() : null);
  return {
    firstCheckInFormatted: timeFromIso(firstLog) || "--:--",
    lastClockInFormatted: lastClockIn ? fmt12HMM(lastClockIn.getHours(), lastClockIn.getMinutes()) : "--:--",
    lastClockOutFormatted: lastClockOut ? fmt12HMM(lastClockOut.getHours(), lastClockOut.getMinutes()) : "--:--",
    effectiveFormatted: fmtTimeHMM(effH, effM),
    timeLeftFormatted: remainingMs <= 0 ? "0:00" : fmtTimeHMM(leftH, leftM),
    grossFormatted: fmtTimeHMM(grossH, grossM),
    breakMinutes: Math.floor(breakMs / 60000),
    expectedCheckout,
    remainingMs,
  };
}

// Compute effective ms and remaining ms from Keka API time entries (for badge)
function computeMetricsFromTimeEntries(timeEntries, workMinutes = DEFAULT_WORK_MINUTES) {
  if (!Array.isArray(timeEntries) || timeEntries.length === 0) {
    return { effectiveMs: 0, remainingMs: workMinutes * 60 * 1000 };
  }
  const sorted = timeEntries
    .filter((l) => !l.isDeleted)
    .map((l) => ({
      time: new Date(l.timestamp),
      status: l.modifiedPunchStatus ?? l.punchStatus,
    }))
    .filter((l) => l.status === 0 || l.status === 1)
    .sort((a, b) => a.time - b.time);
  let effectiveMs = 0;
  let openIn = null;
  const now = new Date();
  for (const log of sorted) {
    if (log.status === 0) {
      if (!openIn) openIn = log.time;
    } else if (log.status === 1 && openIn) {
      effectiveMs += log.time - openIn;
      openIn = null;
    }
  }
  if (openIn) effectiveMs += now - openIn;
  const totalWorkMs = workMinutes * 60 * 1000;
  const remainingMs = Math.max(0, totalWorkMs - effectiveMs);
  return { effectiveMs, remainingMs };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function setBadgeFromTimeLeft(remainingMs) {
  const isDone = remainingMs <= 0;
  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const text = isDone ? "0" : `${hours}:${pad(minutes)}`;
  chrome.action.setBadgeText({ text });
  let badgeColor = "#3b82f6";
  if (isDone) badgeColor = "#10b981";
  else if (hours === 0 && minutes < 60) badgeColor = "#f59e0b";
  else if (hours < 3) badgeColor = "#3b82f6";
  else badgeColor = "#8b5cf6";
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  chrome.action.setTitle({
    title: isDone ? "Keka – Shift complete" : `Keka – Time left: ${text}`,
  });
}

// Background sync: fetch attendance from Keka API and update badge (so badge stays current without opening Keka tab)
async function backgroundSyncAttendance() {
  const { kekaAccessToken, kekaOrigin } = await chrome.storage.local.get([
    "kekaAccessToken",
    "kekaOrigin",
  ]);
  if (!kekaAccessToken || !kekaOrigin) return;
  const { workHours = 9, workMinutes: workMinutesSetting = 0, useCustomSettings } = await chrome.storage.sync.get({
    workHours: 9,
    workMinutes: 0,
    useCustomSettings: false,
  });
  const workMinutes = useCustomSettings ? workHours * 60 + workMinutesSetting : DEFAULT_WORK_MINUTES;
  try {
    const url = `${kekaOrigin.replace(/\/$/, "")}/k/attendance/api/mytime/attendance/summary`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${kekaAccessToken}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    const date = new Date().toISOString().split("T")[0];
    const todaysInfo = data.data?.find((d) => d.attendanceDate?.includes(date));
    const timeEntries = todaysInfo?.timeEntries || [];
    const firstLogOfTheDay = todaysInfo?.firstLogOfTheDay || null;
    const { remainingMs } = computeMetricsFromTimeEntries(timeEntries, workMinutes);
    setBadgeFromTimeLeft(remainingMs);
    // Store full metrics for popup when user is not on Keka tab
    const popupMetrics = computeFullMetricsFromTimeEntries(timeEntries, firstLogOfTheDay, workMinutes);
    await chrome.storage.local.set({
      lastPopupMetrics: popupMetrics,
      lastPopupMetricsTime: Date.now(),
    });
  } catch (e) {
    // Token expired or network error – leave badge as is
  }
}

// Background sync alarm: update badge every 2 minutes when user is not on Keka tab
chrome.alarms.create("syncAttendance", { periodInMinutes: 2 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "syncAttendance") {
    backgroundSyncAttendance();
  }
});

// Run sync once shortly after install/startup so badge is fresh
chrome.runtime.onStartup.addListener(() => {
  setTimeout(backgroundSyncAttendance, 5000);
});
chrome.runtime.onInstalled.addListener(() => {
  setTimeout(backgroundSyncAttendance, 5000);
});

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
    const { text, hours, minutes, isTimeLeft, isDone } = request;

    lastBadgeData = { text, hours, minutes };

    chrome.action.setBadgeText({ text: text || "" });

    // Badge color: time left (green when done, orange when <1h, blue when 1–3h, purple when >3h)
    let badgeColor = "#3b82f6";
    if (isTimeLeft) {
      if (isDone || (hours === 0 && minutes === 0)) {
        badgeColor = "#10b981"; // Green – shift complete
      } else if (hours === 0 && minutes < 60) {
        badgeColor = "#f59e0b"; // Orange – less than 1 hour left
      } else if (hours < 3) {
        badgeColor = "#3b82f6"; // Blue – 1–3 hours left
      } else {
        badgeColor = "#8b5cf6"; // Purple – more than 3 hours left
      }
    }

    chrome.action.setBadgeBackgroundColor({ color: badgeColor });

    const tooltip = isTimeLeft
      ? (isDone ? "Keka – Shift complete" : `Keka – Time left: ${text}`)
      : `Keka Tracker – ${text}`;
    chrome.action.setTitle({ title: tooltip });

    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open for async response
});

