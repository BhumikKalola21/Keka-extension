// Default settings
const defaultSettings = {
  useCustomSettings: false,
  workHours: 9,
  workMinutes: 0,
};

// Current settings (will be loaded from storage)
let currentSettings = { ...defaultSettings };

document.addEventListener("DOMContentLoaded", function () {
  // Establish a connection with the background script
  // This allows the background script to detect when the popup closes
  const port = chrome.runtime.connect({ name: "popup" });

  // Load settings
  loadSettings();

  // Set up event listeners for settings UI
  setupSettingsUI();

  // Query the active tab to send a message to the content script
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const activeTab = tabs[0];
    const statusElement = document.getElementById("status");

    // Check if we're on a Keka domain
    if (activeTab && activeTab.url && activeTab.url.includes("keka.com")) {
      statusElement.textContent = "Connected to Keka";
      statusElement.style.backgroundColor = "#e3f6f7"; // Light teal color to match Keka theme
    } else {
      statusElement.textContent =
        "Please navigate to Keka to use this extension.";
      statusElement.style.backgroundColor = "#ffe8e6"; // Light red for warning
      statusElement.style.color = "#d9534f";
    }
  });
});

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(defaultSettings, function (settings) {
    currentSettings = settings;

    // Update UI with loaded settings
    document.getElementById("useCustomSettings").checked =
      settings.useCustomSettings;
    document.getElementById("workHours").value = settings.workHours;
    document.getElementById("workMinutes").value = settings.workMinutes;

    // Toggle custom settings group visibility
    document.getElementById("customSettingsGroup").style.display =
      settings.useCustomSettings ? "block" : "none";
  });
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

  const settings = {
    useCustomSettings,
    workHours,
    workMinutes,
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
  saveButton.textContent = "Saving...";
  saveButton.disabled = true;
  saveButton.style.backgroundColor = "#aaa";

  // Save to Chrome storage
  chrome.storage.sync.set(settings, function () {
    // Update input fields with the actual saved values
    document.getElementById("workHours").value = settings.workHours;
    document.getElementById("workMinutes").value = settings.workMinutes;

    // Show brief success message
    const status = document.getElementById("status");
    status.textContent = "Settings saved!";
    status.style.backgroundColor = "#e3f6f7"; // Light teal color to match Keka theme

    // Send message to content script to immediately update the display
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
      saveButton.style.backgroundColor = "#64c3d1";

      // Reset status message
      setTimeout(function () {
        status.textContent = "Connected to Keka";
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

