/**
 * Keka Attendance Tracker - Content Script
 * Enhanced version with API-based fetching, navbar chip, and profile badge
 */

(function () {
  'use strict';

  /* ========= Settings & Globals ========= */
  const defaultSettings = {
    useCustomSettings: false,
    workHours: 9,
    workMinutes: 0,
  };

  let currentSettings = { ...defaultSettings };
  let is24HourFormatEnabled = false;
  let timeDisplayElement = null;
  let navbarChipElement = null;
  let hasNotified = false;
  let cachedAttendanceLogs = null;
  let lastFetchTime = null;
  let isFetchingLogs = false;
  let isInitialized = false;
  let checkInTime = "";
  let updateTimer = null;

  const themeColors = {
    dark: {
      background: "rgb(10, 29, 44)",
      border: "1px solid rgb(20, 55, 82)",
      text: "white",
      divider: "rgb(20, 55, 82)",
      progressBg: "rgba(100, 195, 209, 0.2)",
      progressFill: "#64c3d1",
      warningText: "#F5B153",
      chipBg: "rgba(100, 195, 209, 0.15)",
      chipText: "white",
      chipBorder: "rgba(100, 195, 209, 0.3)",
    },
    light: {
      background: "#f5f7f9",
      border: "1px solid #e0e4e8",
      text: "white",
      divider: "#e0e4e8",
      progressBg: "rgba(100, 195, 209, 0.15)",
      progressFill: "#64c3d1",
      warningText: "#e67e22",
      chipBg: "rgba(100, 195, 209, 0.12)",
      chipText: "white",
      chipBorder: "rgba(100, 195, 209, 0.25)",
    },
  };

  const defaultKekaFontFamily =
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

  /* ========= Utility Helpers ========= */

  function getKekaFontFamily() {
    try {
      const kekaElement = document.querySelector(".card-body") || document.body;
      if (kekaElement) {
        const fontFamily = window
          .getComputedStyle(kekaElement)
          .getPropertyValue("font-family");
        if (fontFamily) return fontFamily;
      }
    } catch (e) {
      // ignore and fallback
    }
    return defaultKekaFontFamily;
  }

  function getCurrentTheme() {
    try {
      return localStorage.getItem("ThemeMode") === "light" ? "light" : "dark";
    } catch (e) {
      return "dark";
    }
  }

  function pad(n) {
    return n.toString().padStart(2, "0");
  }

  function formatTime(hours, minutes, seconds) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  function formatTimeWithAmPm(hours, minutes, seconds) {
    if (is24HourFormatEnabled) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${pad(minutes)}:${pad(seconds)} ${ampm}`;
  }

  function toTimeWithAmPm(dateTime) {
    const timePart = dateTime.split("T")[1];
    if (!timePart) return;
    const [h, m, s] = timePart.split(":").map(Number);

    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;

    return `${hour12}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")} ${period}`;
  }

  function getTotalWorkMinutes() {
    return currentSettings.workHours * 60 + currentSettings.workMinutes;
  }

  /* ========= API Fetch Functions ========= */

  async function fetchAttendanceLogsFromApi(forceRefresh = false) {
    // Prevent concurrent API calls
    if (isFetchingLogs && !forceRefresh) {
      return cachedAttendanceLogs;
    }

    // Check if cache is still valid (unless forcing refresh)
    if (!forceRefresh && cachedAttendanceLogs && lastFetchTime) {
      const cacheAge = Date.now() - lastFetchTime;
      if (cacheAge < 300000) {
        // 5 minutes
        return cachedAttendanceLogs;
      }
    }

    isFetchingLogs = true;

    try {
      const date = new Date().toISOString().split("T")[0];
      const res = await fetch(`/k/attendance/api/mytime/attendance/summary`, {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });
      const response = await res.json();
      const todaysInfo = response.data.find((d) =>
        d.attendanceDate.includes(date)
      );

      cachedAttendanceLogs = todaysInfo?.timeEntries || [];
      checkInTime = todaysInfo?.firstLogOfTheDay || "";
      lastFetchTime = Date.now();

      return cachedAttendanceLogs;
    } catch (e) {
      console.error("❌ Error fetching attendance logs:", e);
      return null;
    } finally {
      isFetchingLogs = false;
    }
  }

  function calculateMetricsFromApiLogs(logs) {
    if (!Array.isArray(logs) || logs.length === 0) {
      return {
        effectiveMs: 0,
        grossMs: 0,
        breakMs: 0,
        expectedCheckout: "Not punched in",
        lastClockIn: null,
        lastClockOut: null,
      };
    }

    const sorted = logs
      .filter((l) => !l.isDeleted)
      .map((l) => ({
        time: new Date(l.timestamp),
        status: l.modifiedPunchStatus ?? l.punchStatus,
      }))
      .filter((l) => l.status === 0 || l.status === 1) // IN / OUT only
      .sort((a, b) => a.time - b.time);

    let effectiveMs = 0;
    let openIn = null;

    let firstPunchTime = null;
    let lastPunchTime = null;
    let lastClockIn = null;
    let lastClockOut = null;

    // Find last clock in and last clock out
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].status === 0 && !lastClockIn) {
        lastClockIn = sorted[i].time;
      }
      if (sorted[i].status === 1 && !lastClockOut) {
        lastClockOut = sorted[i].time;
      }
      if (lastClockIn && lastClockOut) break;
    }

    for (const log of sorted) {
      if (!firstPunchTime) firstPunchTime = log.time;
      lastPunchTime = log.time;

      if (log.status === 0) {
        // IN → open only if not already open
        if (!openIn) {
          openIn = log.time;
        }
      } else if (log.status === 1 && openIn) {
        // OUT → close only if IN exists
        effectiveMs += log.time - openIn;
        openIn = null;
      }
    }

    const now = new Date();

    // Add running session
    if (openIn) {
      effectiveMs += now - openIn;
    }

    const grossMs = firstPunchTime
      ? (openIn ? now : lastPunchTime) - firstPunchTime
      : 0;

    const breakMs = Math.max(0, grossMs - effectiveMs);

    const isPunchedIn = openIn !== null;

    // NEW: Expected checkout based on First Check-in + Target Hours + Total Break Time
    let expectedCheckout = "Not punched in";

    if (firstPunchTime) {
      const totalWorkMs = getTotalWorkMinutes() * 60000;
      
      // Calculate: First Check-in + Target Hours + Break Time
      const expectedCheckoutTime = new Date(firstPunchTime.getTime() + totalWorkMs + breakMs);
      
      const remainingMs = Math.max(0, totalWorkMs - effectiveMs);
      
      if (remainingMs > 0) {
        // Still working towards target
        expectedCheckout = formatTimeWithAmPm(
          expectedCheckoutTime.getHours(),
          expectedCheckoutTime.getMinutes(),
          expectedCheckoutTime.getSeconds()
        );
      } else {
        // Target completed
        expectedCheckout = "Completed";
      }
    }

    return {
      effectiveMs,
      grossMs,
      breakMs,
      expectedCheckout,
      lastClockIn,
      lastClockOut,
    };
  }

  /* ========= Display PunchIn/Out Status Functions ========= */
  async function fetchClockInStatus() {
    try {
      const res = await fetch("/k/default/api/me/clockInDetailsForToday", {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      const response = await res.json();
      return response.data.clockInStatus === 0;
    } catch (e) {
      console.error("❌ Error fetching clock-in status:", e);
      return false;
    }
  }

  function injectPunchBadgeStyles() {
    if (document.getElementById("punch-badge-style")) return;

    const style = document.createElement("style");
    style.id = "punch-badge-style";
    style.textContent = `
      .keka-punch-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #22c55e;
        border: 2px solid #fff;
        z-index: 5;
      }

      .keka-punch-badge.out {
        background: #ef4444;
      }
    `;
    document.head.appendChild(style);
  }

  function updateProfilePunchBadge(isPunchedIn) {
    injectPunchBadgeStyles();

    // Profile image container (this is stable in Keka)
    const img = document.querySelector(
      "employee-profile-picture img.profile-picture"
    );

    if (!img) return;

    const container = img.parentElement;
    if (!container) return;

    // Ensure relative positioning
    if (getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }

    let badge = container.querySelector(".keka-punch-badge");

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "keka-punch-badge";
      badge.title = "Attendance status";
      container.appendChild(badge);
    }

    // Toggle state
    if (isPunchedIn) {
      badge.classList.remove("out");
      badge.title = "Punched In";
    } else {
      badge.classList.add("out");
      badge.title = "Punched Out";
    }
  }

  /* ========= Navbar Chip Display Functions ========= */
  function createNavbarChip() {
    if (navbarChipElement) return navbarChipElement;

    const theme = getCurrentTheme();
    const colors = themeColors[theme];
    const fontFamily = getKekaFontFamily();

    navbarChipElement = document.createElement("div");
    navbarChipElement.id = "keka-time-chip";

    navbarChipElement.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;

      background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.28),
        rgba(255, 255, 255, 0.12)
      );

      backdrop-filter: blur(14px) saturate(180%);
      -webkit-backdrop-filter: blur(14px) saturate(180%);

      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 999px;

      box-shadow:
        0 6px 16px rgba(0, 0, 0, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);

      font-family: ${fontFamily};
      font-size: 12px;
      font-weight: 500;
      color: ${colors.chipText};

      margin: 8px 12px;
      white-space: nowrap;

      transition: box-shadow 0.3s ease, transform 0.2s ease;
    `;

    navbarChipElement.innerHTML = `
      <div style="display:flex;align-items:center;gap:4px;">
        <span style="font-size:10px;line-height:1;">⏰</span>
        <span style="font-size:12px;opacity:0.85;">First In:</span>
        <span id="chip-checkin" style="font-weight:600;">--:--:--</span>
      </div>

      <div class="chip-divider"></div>

      <div style="display:flex;align-items:center;gap:4px;">
        <span style="font-size:10px;line-height:1;">🟢</span>
        <span style="font-size:12px;opacity:0.85;">Last In:</span>
        <span id="chip-last-in" style="font-weight:600;">--:--:--</span>
      </div>

      <div class="chip-divider"></div>

      <div style="display:flex;align-items:center;gap:4px;">
        <span style="font-size:10px;line-height:1;">🔴</span>
        <span style="font-size:12px;opacity:0.85;">Last Out:</span>
        <span id="chip-last-out" style="font-weight:600;">--:--:--</span>
      </div>

      <div class="chip-divider"></div>

      <div style="display:flex;align-items:center;gap:4px;">
        <span style="font-size:10px;line-height:1;">⏱️</span>
        <span style="font-size:12px;opacity:0.85;">Eff:</span>
        <span id="chip-effective" style="font-weight:600;">--:--:--</span>
      </div>

      <div class="chip-divider"></div>

      <div style="display:flex;align-items:center;gap:4px;">
        <span style="font-size:10px;line-height:1;">📊</span>
        <span style="font-size:12px;opacity:0.85;">Gross:</span>
        <span id="chip-gross" style="font-weight:600;">--:--:--</span>
      </div>

      <div class="chip-divider"></div>

      <div style="display:flex;align-items:center;gap:4px;">
        <span style="font-size:10px;line-height:1;">☕</span>
        <span style="font-size:12px;opacity:0.85;">Break:</span>
        <span id="chip-break" style="font-weight:600;">--</span>
      </div>

      <div class="chip-divider"></div>

      <div style="display:flex;align-items:center;gap:4px;">
        <span style="font-size:10px;line-height:1;">🚪</span>
        <span style="font-size:12px;opacity:0.85;">Expected Out:</span>
        <span id="chip-checkout" style="font-weight:600;max-width:80px;overflow:hidden;text-overflow:ellipsis;">--:--:--</span>
      </div>

      <div class="chip-divider"></div>

      <!-- Refresh Button -->
      <div id="chip-refresh" title="Sync Logs" style="
        display:flex;
        align-items:center;
        justify-content:center;
        width:18px;
        height:18px;
        border-radius:50%;
        cursor:pointer;
        font-size:14px;

        background: rgba(255,255,255,0.18);
        border: 1px solid rgba(255,255,255,0.25);

        transition: background 0.2s ease, transform 0.15s ease;
      ">
        🔄
      </div>
    `;

    /* Divider styling */
    navbarChipElement.querySelectorAll(".chip-divider").forEach((divider) => {
      divider.style.cssText = `
        width:1px;
        height:14px;
        background: linear-gradient(
          180deg,
          rgba(255,255,255,0.5),
          rgba(255,255,255,0.15)
        );
        opacity:0.6;
      `;
    });

    /* Hover lift */
    navbarChipElement.addEventListener("mouseenter", () => {
      navbarChipElement.style.boxShadow = `
        0 10px 24px rgba(0, 0, 0, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.4)
      `;
      navbarChipElement.style.transform = "translateY(-1px)";
    });

    navbarChipElement.addEventListener("mouseleave", () => {
      navbarChipElement.style.boxShadow = `
        0 6px 16px rgba(0, 0, 0, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.3)
      `;
      navbarChipElement.style.transform = "translateY(0)";
    });

    /* Refresh button hover */
    const refreshBtn = navbarChipElement.querySelector("#chip-refresh");

    refreshBtn.addEventListener("mouseenter", () => {
      refreshBtn.style.background = "rgba(255,255,255,0.28)";
      refreshBtn.style.transform = "scale(1.15)";
    });

    refreshBtn.addEventListener("mouseleave", () => {
      refreshBtn.style.background = "rgba(255,255,255,0.18)";
      refreshBtn.style.transform = "scale(1)";
    });

    /* Refresh click logic */
    refreshBtn.addEventListener("click", async (e) => {
      e.stopPropagation();

      // Disable button during refresh
      refreshBtn.style.pointerEvents = "none";
      refreshBtn.style.opacity = "0.5";

      // Spin animation
      refreshBtn.style.transition = "transform 0.5s ease";
      refreshBtn.style.transform = "rotate(360deg) scale(0.9)";

      // Clear cache and force refresh
      cachedAttendanceLogs = null;
      lastFetchTime = null;

      await updateAllDisplays(true);

      // Reset button
      setTimeout(() => {
        refreshBtn.style.transform = "rotate(0deg) scale(1)";
        refreshBtn.style.pointerEvents = "auto";
        refreshBtn.style.opacity = "1";
        refreshBtn.style.transition =
          "background 0.2s ease, transform 0.15s ease";
      }, 500);
    });

    return navbarChipElement;
  }

  function insertNavbarChip() {
    // Target the specific div with class "d-flex align-items-center" that contains the time chip location
    const parent = document.querySelector("nav.navbar div");

    const chipElement = createNavbarChip();
    parent?.insertBefore(chipElement, parent.children[1]);
    applyThemeToNavbarChip();

    if (!parent) {
      setTimeout(insertNavbarChip, 1000);
      return;
    }
  }

  function updateNavbarChip(metrics) {
    if (!navbarChipElement) {
      insertNavbarChip();
      return;
    }

    const checkinSpan = navbarChipElement.querySelector("#chip-checkin");
    const lastInSpan = navbarChipElement.querySelector("#chip-last-in");
    const lastOutSpan = navbarChipElement.querySelector("#chip-last-out");
    const effectiveSpan = navbarChipElement.querySelector("#chip-effective");
    const grossSpan = navbarChipElement.querySelector("#chip-gross");
    const breakSpan = navbarChipElement.querySelector("#chip-break");
    const checkoutSpan = navbarChipElement.querySelector("#chip-checkout");

    if (!effectiveSpan || !grossSpan || !breakSpan || !checkoutSpan) return;

    // Format first check-in time
    const formattedCheckinTime = toTimeWithAmPm(checkInTime) || "--:--:--";
    checkinSpan.textContent = formattedCheckinTime;

    // Format last clock in time
    const formattedLastIn = metrics.lastClockIn 
      ? formatTimeWithAmPm(
          metrics.lastClockIn.getHours(),
          metrics.lastClockIn.getMinutes(),
          metrics.lastClockIn.getSeconds()
        )
      : "--:--:--";
    lastInSpan.textContent = formattedLastIn;

    // Format last clock out time
    const formattedLastOut = metrics.lastClockOut
      ? formatTimeWithAmPm(
          metrics.lastClockOut.getHours(),
          metrics.lastClockOut.getMinutes(),
          metrics.lastClockOut.getSeconds()
        )
      : "--:--:--";
    lastOutSpan.textContent = formattedLastOut;

    // Format effective time
    const effHms = msToHms(metrics.effectiveMs);
    effectiveSpan.textContent = formatTime(effHms.h, effHms.m, effHms.s);

    // Format gross time
    const grossHms = msToHms(metrics.grossMs);
    grossSpan.textContent = formatTime(grossHms.h, grossHms.m, grossHms.s);

    // Format break time in minutes
    const breakMinutes = Math.floor(metrics.breakMs / 60000);
    breakSpan.textContent = `${breakMinutes} min`;

    // Format expected checkout
    checkoutSpan.textContent = metrics.expectedCheckout || "N/A";

    // Update tooltip with all details
    const tooltipText = `
      First Check-in: ${formattedCheckinTime}
      Last Clock In: ${formattedLastIn}
      Last Clock Out: ${formattedLastOut}
      Effective: ${formatTime(effHms.h, effHms.m, effHms.s)}
      Gross: ${formatTime(grossHms.h, grossHms.m, grossHms.s)}
      Break: ${breakMinutes} min
      Expected Checkout: ${metrics.expectedCheckout || "N/A"}
      Status: ${metrics.isPunchedIn ? "Punched In" : "Punched Out"}
    `.trim();

    navbarChipElement.title = tooltipText;

    // Visual indicator if work is completed
    const totalWorkMs = getTotalWorkMinutes() * 60000;
    if (metrics.effectiveMs >= totalWorkMs) {
      checkoutSpan.style.color = "#4ade80"; // Green color for completed
      checkoutSpan.style.fontWeight = "600";
    } else {
      checkoutSpan.style.color = "inherit";
      checkoutSpan.style.fontWeight = "500";
    }
  }

  function applyThemeToNavbarChip() {
    if (!navbarChipElement) return;

    const theme = getCurrentTheme();
    const colors = themeColors[theme];
    const fontFamily = getKekaFontFamily();

    navbarChipElement.style.color = colors.chipText;
    navbarChipElement.style.fontFamily = fontFamily;
  }

  /* ========= Main Update Logic ========= */

  async function updateAllDisplays(forceRefresh = false) {
    // Show loading state only if we need to fetch
    const needsFetch =
      forceRefresh ||
      !cachedAttendanceLogs ||
      !lastFetchTime ||
      Date.now() - lastFetchTime > 300000;

    if (needsFetch && navbarChipElement) {
      const checkinSpan = navbarChipElement.querySelector("#chip-checkin");
      const lastInSpan = navbarChipElement.querySelector("#chip-last-in");
      const lastOutSpan = navbarChipElement.querySelector("#chip-last-out");
      const effectiveSpan = navbarChipElement.querySelector("#chip-effective");
      const grossSpan = navbarChipElement.querySelector("#chip-gross");
      const breakSpan = navbarChipElement.querySelector("#chip-break");
      const checkoutSpan = navbarChipElement.querySelector("#chip-checkout");

      if (checkinSpan) checkinSpan.textContent = "⏳";
      if (lastInSpan) lastInSpan.textContent = "⏳";
      if (lastOutSpan) lastOutSpan.textContent = "⏳";
      if (effectiveSpan) effectiveSpan.textContent = "⏳";
      if (grossSpan) grossSpan.textContent = "⏳";
      if (breakSpan) breakSpan.textContent = "⏳";
      if (checkoutSpan) checkoutSpan.textContent = "⏳";
    }

    // Fetch logs (this handles caching internally now)
    try {
      await fetchAttendanceLogsFromApi(forceRefresh);
    } catch (error) {
      console.error("❌ Failed to fetch attendance logs:", error);

      // Show error state
      if (navbarChipElement) {
        const checkinSpan = navbarChipElement.querySelector("#chip-checkin");
        const lastInSpan = navbarChipElement.querySelector("#chip-last-in");
        const lastOutSpan = navbarChipElement.querySelector("#chip-last-out");
        const effectiveSpan = navbarChipElement.querySelector("#chip-effective");
        const grossSpan = navbarChipElement.querySelector("#chip-gross");
        const breakSpan = navbarChipElement.querySelector("#chip-break");
        const checkoutSpan = navbarChipElement.querySelector("#chip-checkout");

        if (checkinSpan) checkinSpan.textContent = "⚠️";
        if (lastInSpan) lastInSpan.textContent = "⚠️";
        if (lastOutSpan) lastOutSpan.textContent = "⚠️";
        if (effectiveSpan) effectiveSpan.textContent = "⚠️";
        if (grossSpan) grossSpan.textContent = "⚠️";
        if (breakSpan) breakSpan.textContent = "⚠️";
        if (checkoutSpan) checkoutSpan.textContent = "⚠️";

        navbarChipElement.title =
          "Failed to fetch attendance logs. Click refresh to retry.";
      }
      return;
    }

    if (!cachedAttendanceLogs) {
      return;
    }

    // Calculate metrics from cached data
    const metrics = calculateMetricsFromApiLogs(cachedAttendanceLogs);

    const isPunchedIn = await fetchClockInStatus();

    // Update navbar chip
    updateNavbarChip({ ...metrics, isPunchedIn });
    updateProfilePunchBadge(isPunchedIn);

    // Check for notification
    const totalWorkMs = getTotalWorkMinutes() * 60000;
    if (metrics.effectiveMs >= totalWorkMs && isPunchedIn) {
      maybeNotifyIfDone("00:00:00", 100);
    }
  }

  /* ========= Core calculation helpers ========= */

  function msToHms(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return { h, m, s };
  }

  /* ========= Notification helper ========= */

  function requestNotificationPermissionIfNeeded() {
    if (typeof Notification === "undefined") return Promise.resolve(false);
    if (Notification.permission === "granted") return Promise.resolve(true);
    if (Notification.permission === "denied") return Promise.resolve(false);
    return Notification.requestPermission().then((p) => p === "granted");
  }

  function maybeNotifyIfDone(remainingTimeStr, completionPercentage) {
    const done =
      remainingTimeStr === "00:00:00" ||
      (typeof completionPercentage === "number" && completionPercentage >= 100);
    if (!done || hasNotified) return;

    requestNotificationPermissionIfNeeded().then((granted) => {
      if (!granted) return;
      try {
        new Notification("Keka Notification", {
          body: "Work hours completed... Time to leave 🏃‍♂️🚴‍♀️",
        });
        hasNotified = true;
      } catch (e) {
        // ignore failures silently
      }
    });
  }

  /* ========= Theme & Format Listeners ========= */

  function setupThemeChangeListener() {
    const themeObserver = new MutationObserver(() => {
      applyThemeToNavbarChip();
    });

    const themeSwitch = document.getElementById("themeSwitch");
    if (themeSwitch) {
      themeSwitch.addEventListener("change", () => {
        setTimeout(() => {
          applyThemeToNavbarChip();
        }, 100);
      });
    }

    window.addEventListener("storage", (e) => {
      if (e.key === "ThemeMode") {
        applyThemeToNavbarChip();
      }
    });

    const themeContainer = document.querySelector(".toggle-theme-container");
    if (themeContainer) {
      themeObserver.observe(themeContainer, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  function setupFormatToggleObserver() {
    const observer = new MutationObserver(() => {
      check24HourFormatToggle();
      updateAllDisplays();
    });

    function setupObserverAttempt() {
      const toggle = document.querySelector(
        '#isFeatureEnabled[name="isFeatureEnabled"]'
      );
      if (toggle) {
        observer.observe(toggle, {
          attributes: true,
          attributeFilter: ["checked"],
        });
        if (toggle.parentElement) {
          observer.observe(toggle.parentElement, {
            childList: true,
            subtree: true,
          });
        }
      }
    }

    setupObserverAttempt();
    const interval = setInterval(() => {
      const toggle = document.querySelector(
        '#isFeatureEnabled[name="isFeatureEnabled"]'
      );
      if (toggle) {
        setupObserverAttempt();
        clearInterval(interval);
      }
    }, 2000);
  }

  function check24HourFormatToggle() {
    try {
      const toggle = document.querySelector(
        '#isFeatureEnabled[name="isFeatureEnabled"]'
      );
      if (toggle) {
        is24HourFormatEnabled = toggle.checked;
        return toggle.checked;
      }
    } catch (e) {}
    return false;
  }

  /* ========= Utilities ========= */

  function ensureTimerIsRunning() {
    if (!updateTimer) {
      updateTimer = setInterval(() => {
        // Only update displays, don't fetch API
        if (cachedAttendanceLogs) {
          const metrics = calculateMetricsFromApiLogs(cachedAttendanceLogs);
          updateNavbarChip(metrics);

          // Check for notification
          const totalWorkMs = getTotalWorkMinutes() * 60000;
          if (metrics.effectiveMs >= totalWorkMs) {
            maybeNotifyIfDone("00:00:00", 100);
          }
        }
      }, 1000);
    }
  }

  /* ========= Storage & Settings ========= */

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(defaultSettings, function (settings) {
        currentSettings = settings;
        resolve({ settings, usingCustomSettings: settings.useCustomSettings });
      });
    });
  }

  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace !== "sync") return;
    Object.keys(changes).forEach(
      (k) => (currentSettings[k] = changes[k].newValue)
    );

    // Just update displays with existing cached data
    if (cachedAttendanceLogs) {
      const metrics = calculateMetricsFromApiLogs(cachedAttendanceLogs);
      updateNavbarChip(metrics);
    }
  });

  /* ========= URL Monitor & Initialization ========= */

  function setUpUrlChangeMonitor() {
    if (window.urlChangeMonitorActive) {
      return;
    }

    window.urlChangeMonitorActive = true;
    let lastUrl = location.href;

    if (!window.urlObserver) {
      window.urlObserver = new MutationObserver(() => {
        if (lastUrl !== location.href) {
          lastUrl = location.href;

          setTimeout(() => {
            if (!isInitialized) {
              initializeExtension();
            } else {
              ensureTimerIsRunning();
              insertNavbarChip();
              // Use cached data, don't refetch
              if (cachedAttendanceLogs) {
                const metrics = calculateMetricsFromApiLogs(cachedAttendanceLogs);
                updateNavbarChip(metrics);
              }
            }
          }, 1000);
        }
      });
      window.urlObserver.observe(document, { subtree: true, childList: true });
    }
  }

  function initializeExtension() {
    // Use both flags to prevent re-initialization
    if (isInitialized || window.extensionInitialized) {
      return;
    }

    isInitialized = true;
    window.extensionInitialized = true;

    console.log('[Keka Tracker] Initializing API-based extension...');

    loadSettings().then(() => {
      setupThemeChangeListener();
      check24HourFormatToggle();
      setupFormatToggleObserver();
      insertNavbarChip();

      setUpUrlChangeMonitor();
      ensureTimerIsRunning();
      setInterval(check24HourFormatToggle, 5000);
      
      // Initial fetch
      updateAllDisplays(true);
    });
  }

  /* ========= Event Listeners ========= */

  document.addEventListener("DOMContentLoaded", () => {
    initializeExtension();
  });

  window.addEventListener("load", () => {
    initializeExtension();
  });

  // Initialize immediately if DOM is already loaded
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(() => {
      initializeExtension();
    }, 100);
  }

  /* ========= Chrome Message Handlers ========= */

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (!isInitialized) {
      initializeExtension();
    }

    ensureTimerIsRunning();

    if (request.action === "autoFetchData") {
      updateAllDisplays(true).then(() => {
        sendResponse({ success: true, dataRefreshed: true });
      });
      return true;
    } else if (request.action === "ensureTimerRunning") {
      ensureTimerIsRunning();
      if (cachedAttendanceLogs) {
        const metrics = calculateMetricsFromApiLogs(cachedAttendanceLogs);
        updateNavbarChip(metrics);
      }
      sendResponse({ success: true });
      return true;
    } else if (request.action === "settingsUpdated") {
      if (request.settings) {
        currentSettings = { ...currentSettings, ...request.settings };
        // Recalculate with existing cache
        if (cachedAttendanceLogs) {
          const metrics = calculateMetricsFromApiLogs(cachedAttendanceLogs);
          updateNavbarChip(metrics);
        }
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "No settings provided" });
      }
      return true;
    }
  });

})();
