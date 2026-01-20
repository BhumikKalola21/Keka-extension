/**
 * Attendance Calculator
 * Handles all attendance-related calculations
 */

const AttendanceCalculator = {
  // Target work hours in minutes (9 hours)
  TARGET_HOURS: 540,

  /**
   * Calculate attendance summary from clock-in/out records
   * @param {Array} records - Array of {type: 'IN'|'OUT', time: Date}
   * @param {number} targetHours - Target work hours (default from TARGET_HOURS)
   * @returns {Object} - Calculated summary
   */
  calculateSummary(records, targetHours = null) {
    const targetMinutes = targetHours ? targetHours * 60 : this.TARGET_HOURS;
    
    if (!records || records.length === 0) {
      return this.getEmptySummary(targetMinutes);
    }

    // Sort records by time to ensure chronological order
    const sortedRecords = [...records].sort((a, b) => a.time - b.time);

    // Get FIRST check-in of the day (never changes)
    const firstCheckIn = sortedRecords.find(r => r.type === 'IN');
    
    // Get LAST (most recent) check-in
    const lastCheckIn = [...sortedRecords].reverse().find(r => r.type === 'IN');
    
    if (!firstCheckIn) {
      return this.getEmptySummary(targetMinutes);
    }

    const currentTime = TimeUtils.getCurrentTime();

    // Calculate worked time and breaks by pairing IN/OUT records
    let totalWorkedMinutes = 0;
    let totalBreakMinutes = 0;
    let lastProcessedOut = null;
    
    // Process each record in chronological order
    for (let i = 0; i < sortedRecords.length; i++) {
      const record = sortedRecords[i];
      
      if (record.type === 'IN') {
        // If there was a previous OUT, calculate break time
        if (lastProcessedOut) {
          const breakMinutes = TimeUtils.getDifferenceInMinutes(lastProcessedOut, record.time);
          totalBreakMinutes += breakMinutes;
        }
        
        // Find the matching OUT for this IN
        let foundOut = false;
        for (let j = i + 1; j < sortedRecords.length; j++) {
          if (sortedRecords[j].type === 'OUT') {
            // Calculate worked time for this IN-OUT pair
            const workedMinutes = TimeUtils.getDifferenceInMinutes(record.time, sortedRecords[j].time);
            totalWorkedMinutes += workedMinutes;
            lastProcessedOut = sortedRecords[j].time;
            foundOut = true;
            break;
          }
        }
        
        // If no OUT found, user is currently clocked in - calculate ongoing work time
        if (!foundOut) {
          const ongoingMinutes = TimeUtils.getDifferenceInMinutes(record.time, currentTime);
          totalWorkedMinutes += ongoingMinutes;
        }
      }
    }

    // Determine if currently clocked in (last record is IN)
    const lastRecord = sortedRecords[sortedRecords.length - 1];
    const isClockedIn = lastRecord.type === 'IN';

    // Calculate GROSS hours: Time from FIRST check-in to now
    // This includes all breaks and represents total time elapsed
    const grossEndTime = currentTime;
    const grossMinutes = TimeUtils.getDifferenceInMinutes(firstCheckIn.time, grossEndTime);

    // Calculate remaining time needed to complete target
    const remainingMinutes = Math.max(0, targetMinutes - totalWorkedMinutes);

    // Calculate EXPECTED CHECKOUT TIME
    // This is ALWAYS based on first check-in + target hours (e.g., 9 AM + 9h = 6 PM)
    // It represents when you SHOULD finish if you work the target hours
    const expectedCheckout = this.calculateExpectedCheckout(
      firstCheckIn.time,
      targetMinutes,
      remainingMinutes,
      isClockedIn
    );

    return {
      firstCheckIn: firstCheckIn.time,
      lastCheckIn: lastCheckIn ? lastCheckIn.time : firstCheckIn.time,
      effectiveMinutes: totalWorkedMinutes,
      grossMinutes: grossMinutes,
      breakMinutes: totalBreakMinutes,
      remainingMinutes: remainingMinutes,
      expectedCheckout: expectedCheckout,
      isClockedIn: isClockedIn,
      completedTarget: totalWorkedMinutes >= targetMinutes,
      targetMinutes: targetMinutes
    };
  },

  /**
   * Calculate expected checkout time to complete target hours
   * 
   * Two scenarios:
   * 1. If CLOCKED IN: Shows when you'll actually finish (current time + remaining hours)
   *    - Accounts for breaks already taken
   *    - Example: If 3 hours left at 3:30 PM, shows 6:30 PM
   * 
   * 2. If CLOCKED OUT: Shows ideal target time (first check-in + target hours)  
   *    - Example: Started at 9 AM, 9-hour target → shows 6:00 PM
   * 
   * @param {Date} firstCheckInTime - First check-in time of the day
   * @param {number} targetMinutes - Target work minutes for the day
   * @param {number} remainingMinutes - Minutes remaining to target
   * @param {boolean} isClockedIn - Whether currently clocked in
   * @returns {Date|null} - Expected checkout time
   */
  calculateExpectedCheckout(firstCheckInTime, targetMinutes, remainingMinutes, isClockedIn) {
    if (remainingMinutes <= 0) {
      // Target already completed
      return null;
    }

    if (isClockedIn) {
      // When clocked in: Show when you'll actually finish
      // = Current time + remaining work time
      // This accounts for any breaks you've taken
      const currentTime = TimeUtils.getCurrentTime();
      return TimeUtils.addMinutes(currentTime, remainingMinutes);
    } else {
      // When clocked out: Show ideal target completion time
      // = First check-in + target hours (e.g., 9 AM + 9h = 6 PM)
      return TimeUtils.addMinutes(firstCheckInTime, targetMinutes);
    }
  },

  /**
   * Get empty summary object
   * @param {number} targetMinutes - Target minutes (default from TARGET_HOURS)
   * @returns {Object} - Empty summary
   */
  getEmptySummary(targetMinutes = null) {
    const target = targetMinutes || this.TARGET_HOURS;
    return {
      firstCheckIn: null,
      lastCheckIn: null,
      effectiveMinutes: 0,
      grossMinutes: 0,
      breakMinutes: 0,
      remainingMinutes: target,
      expectedCheckout: null,
      isClockedIn: false,
      completedTarget: false,
      targetMinutes: target
    };
  },

  /**
   * Format summary for display
   * @param {Object} summary - Calculated summary
   * @returns {Object} - Formatted strings for UI
   */
  formatSummary(summary) {
    const targetMinutes = summary.targetMinutes || this.TARGET_HOURS;
    return {
      checkIn: summary.firstCheckIn ? TimeUtils.formatTime(summary.firstCheckIn) : '--:--',
      lastCheckIn: summary.lastCheckIn ? TimeUtils.formatTime(summary.lastCheckIn) : '--:--',
      effectiveHours: TimeUtils.formatDuration(summary.effectiveMinutes),
      grossHours: TimeUtils.formatDuration(summary.grossMinutes),
      breakTime: TimeUtils.formatDuration(summary.breakMinutes),
      expectedCheckout: summary.expectedCheckout ? TimeUtils.formatTime(summary.expectedCheckout) : '--:--',
      remaining: TimeUtils.formatDuration(summary.remainingMinutes),
      status: summary.isClockedIn ? 'Clocked In' : 'Clocked Out',
      progressPercent: Math.min(100, (summary.effectiveMinutes / targetMinutes) * 100).toFixed(1),
      targetHours: (targetMinutes / 60).toFixed(1)
    };
  }
};

// Make available globally for other scripts
window.AttendanceCalculator = AttendanceCalculator;

