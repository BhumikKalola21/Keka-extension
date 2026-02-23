// Default settings (must match content.js)
const defaultSettings = {
  useCustomSettings: false,
  workHours: 9,
  workMinutes: 0,
  chipTheme: "default",
};

let currentSettings = { ...defaultSettings };

// Legend short name → full name (same as navbar tooltips)
const LEGEND_FULL_NAMES = {
  FI: "First Clock In",
  LIn: "Last Clock In",
  LOut: "Last Clock Out",
  Left: "Time Left to complete target",
  Eff: "Effective Hours",
  Gr: "Gross Hours",
  Br: "Break Time",
  EOut: "Expected Checkout",
};

document.addEventListener("DOMContentLoaded", function () {
  const port = chrome.runtime.connect({ name: "popup" });
  loadSettings();
  setupSettingsUI();
  loadMetricsFromTab();
  document.getElementById("status").textContent = "Connecting…";
});

function loadSettings() {
  chrome.storage.sync.get(defaultSettings, function (settings) {
    currentSettings = settings;
    document.getElementById("useCustomSettings").checked = settings.useCustomSettings;
    document.getElementById("workHours").value = settings.workHours;
    document.getElementById("workMinutes").value = settings.workMinutes;
    const themeEl = document.getElementById("chipTheme");
    if (themeEl) themeEl.value = settings.chipTheme || "default";
    document.getElementById("customSettingsGroup").style.display =
      settings.useCustomSettings ? "block" : "none";
  });
}

function loadMetricsFromTab() {
  const statusEl = document.getElementById("status");
  const metricsContent = document.getElementById("metricsContent");
  const metricsPlaceholder = document.getElementById("metricsPlaceholder");

  function showStoredMetrics() {
    chrome.storage.local.get(["lastPopupMetrics", "lastPopupMetricsTime"], function (data) {
      const m = data.lastPopupMetrics;
      const t = data.lastPopupMetricsTime;
      if (m) {
        metricsPlaceholder.style.display = "none";
        metricsContent.style.display = "grid";
        renderMetrics(m);
        const mins = t ? Math.round((Date.now() - t) / 60000) : null;
        statusEl.textContent = mins != null ? "Last synced " + (mins < 1 ? "just now" : mins === 1 ? "1 min ago" : mins + " min ago") : "From background sync";
        statusEl.className = "status connected";
      } else {
        statusEl.textContent = "Open Keka once to enable sync, then data will appear here.";
        statusEl.className = "status warning";
        metricsContent.style.display = "none";
        metricsPlaceholder.style.display = "block";
        metricsPlaceholder.textContent = "Open Keka in a tab once to log in. After that, this popup will show your attendance even when you're on other tabs.";
      }
    });
  }

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    if (!tab || !tab.url || !tab.url.includes("keka.com")) {
      showStoredMetrics();
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "getMetrics" }, function (response) {
      if (chrome.runtime.lastError || !response || !response.success) {
        showStoredMetrics();
        return;
      }
      statusEl.textContent = "Connected to Keka";
      statusEl.className = "status connected";
      metricsPlaceholder.style.display = "none";
      metricsContent.style.display = "grid";
      renderMetrics(response.metrics);
    });
  });
}

function renderMetrics(m) {
  const grid = document.getElementById("metricsContent");
  const rows = [
    { short: "FI", full: LEGEND_FULL_NAMES.FI, value: m.firstCheckInFormatted },
    { short: "LIn", full: LEGEND_FULL_NAMES.LIn, value: m.lastClockInFormatted },
    { short: "LOut", full: LEGEND_FULL_NAMES.LOut, value: m.lastClockOutFormatted },
    { short: "Left", full: LEGEND_FULL_NAMES.Left, value: m.timeLeftFormatted, highlight: true, done: m.remainingMs <= 0 },
    { short: "Eff", full: LEGEND_FULL_NAMES.Eff, value: m.effectiveFormatted },
    { short: "Gr", full: LEGEND_FULL_NAMES.Gr, value: m.grossFormatted },
    { short: "Br", full: LEGEND_FULL_NAMES.Br, value: m.breakMinutes + " min" },
    { short: "EOut", full: LEGEND_FULL_NAMES.EOut, value: m.expectedCheckout },
  ];
  grid.innerHTML = rows
    .map(
      (r) => `
    <div class="metric-row">
      <span class="metric-label" title="${r.full}">${r.short}</span>
      <span class="metric-value ${r.highlight ? "highlight" : ""} ${r.done ? "done" : ""}">${r.value}</span>
    </div>
  `
    )
    .join("");
}

// Save settings to storage
function saveSettings() {
  // Get input values
  const useCustomSettings =
    document.getElementById("useCustomSettings").checked;
  const workHoursInput = document.getElementById("workHours").value;
  const workMinutesInput = document.getElementById("workMinutes").value;

  // Parse input values, properly handling 0 values
  const workHours =
    workHoursInput === "" || isNaN(parseInt(workHoursInput))
      ? defaultSettings.workHours
      : parseInt(workHoursInput);

  const workMinutes =
    workMinutesInput === "" || isNaN(parseInt(workMinutesInput))
      ? defaultSettings.workMinutes
      : parseInt(workMinutesInput);

  const chipTheme = (document.getElementById("chipTheme") || {}).value || "default";
  const settings = {
    useCustomSettings,
    workHours,
    workMinutes,
    chipTheme,
  };

  // Validate work hours and minutes
  if (settings.workHours < 0 || settings.workHours > 12) {
    settings.workHours = defaultSettings.workHours;
  }

  if (settings.workMinutes < 0 || settings.workMinutes > 59) {
    settings.workMinutes = defaultSettings.workMinutes;
  }

  // Show saving animation on the button
  const saveButton = document.getElementById("saveSettings");
  const originalText = saveButton.textContent;
  saveButton.textContent = "Saving…";
  saveButton.disabled = true;
  saveButton.style.opacity = "0.7";

  // Save to Chrome storage
  chrome.storage.sync.set(settings, function () {
    // Update input fields with the actual saved values
    document.getElementById("workHours").value = settings.workHours;
    document.getElementById("workMinutes").value = settings.workMinutes;

    const status = document.getElementById("status");
    status.textContent = "Settings saved!";
    status.className = "status connected";

    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0] && tabs[0].url.includes("keka.com")) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "settingsUpdated",
            settings: settings,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.log(
                "Failed to send settings update:",
                chrome.runtime.lastError.message
              );
            } else {
              console.log("Settings updated successfully:", response);
            }
          }
        );
      }
    });

    // Reset button after short delay
    setTimeout(function () {
      saveButton.textContent = originalText;
      saveButton.disabled = false;
      saveButton.style.opacity = "1";

      setTimeout(function () {
        status.textContent = "Connected to Keka";
        status.className = "status connected";
      }, 1000);
    }, 500);
  });
}

// Set up event listeners for settings UI
function setupSettingsUI() {
  // Save button
  document
    .getElementById("saveSettings")
    .addEventListener("click", saveSettings);

  // Custom settings checkbox
  const customSettingsCheckbox = document.getElementById("useCustomSettings");
  const customSettingsGroup = document.getElementById("customSettingsGroup");

  customSettingsCheckbox.addEventListener("change", function () {
    // Smooth transition for showing/hiding settings
    if (this.checked) {
      customSettingsGroup.style.display = "block";
      customSettingsGroup.style.opacity = "0";
      setTimeout(() => {
        customSettingsGroup.style.opacity = "1";
      }, 10);
    } else {
      customSettingsGroup.style.opacity = "0";
      setTimeout(() => {
        customSettingsGroup.style.display = "none";
      }, 200);
    }
  });

  // Add input validation for hours and minutes
  document.getElementById("workHours").addEventListener("input", function () {
    if (this.value > 12) this.value = 12;
    if (this.value < 0) this.value = 0;
  });

  document.getElementById("workMinutes").addEventListener("input", function () {
    if (this.value > 59) this.value = 59;
    if (this.value < 0) this.value = 0;
  });
}

