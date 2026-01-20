/**
 * Time Utility Functions
 * Handles time parsing, formatting, and conversions
 */

const TimeUtils = {
  /**
   * Parse time string in various formats (HH:mm, h:mm AM/PM, etc.)
   * Returns Date object for today with the parsed time
   * @param {string} timeStr - Time string to parse
   * @returns {Date|null} - Date object or null if parsing fails
   */
  parseTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    
    const cleaned = timeStr.trim().toUpperCase();
    
    // Try to match HH:mm format (24-hour)
    const match24 = cleaned.match(/(\d{1,2}):(\d{2})/);
    if (match24) {
      let hours = parseInt(match24[1], 10);
      const minutes = parseInt(match24[2], 10);
      
      // Check for AM/PM
      const isPM = cleaned.includes('PM');
      const isAM = cleaned.includes('AM');
      
      if (isPM && hours !== 12) {
        hours += 12;
      } else if (isAM && hours === 12) {
        hours = 0;
      }
      
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    }
    
    return null;
  },

  /**
   * Format Date object to 12-hour format with AM/PM
   * @param {Date} date - Date object to format
   * @returns {string} - Formatted time string (e.g., "01:13 PM")
   */
  formatTime(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) return '--:--';
    
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  },

  /**
   * Format duration in minutes to HH:mm format
   * @param {number} minutes - Duration in minutes
   * @returns {string} - Formatted duration string
   */
  formatDuration(minutes) {
    if (typeof minutes !== 'number' || isNaN(minutes) || minutes < 0) {
      return '00:00';
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  },

  /**
   * Calculate difference between two Date objects in minutes
   * @param {Date} startDate - Start time
   * @param {Date} endDate - End time
   * @returns {number} - Difference in minutes
   */
  getDifferenceInMinutes(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    const diffMs = endDate - startDate;
    return Math.max(0, diffMs / 1000 / 60);
  },

  /**
   * Add minutes to a Date object
   * @param {Date} date - Base date
   * @param {number} minutes - Minutes to add
   * @returns {Date} - New Date object
   */
  addMinutes(date, minutes) {
    if (!date || !(date instanceof Date)) return null;
    const newDate = new Date(date.getTime());
    newDate.setMinutes(newDate.getMinutes() + minutes);
    return newDate;
  },

  /**
   * Get current time as Date object (for testing purposes)
   * @returns {Date} - Current date/time
   */
  getCurrentTime() {
    return new Date();
  },

  /**
   * Check if a date is today
   * @param {Date} date - Date to check
   * @returns {boolean} - True if date is today
   */
  isToday(date) {
    if (!date || !(date instanceof Date)) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  },

  /**
   * Parse time from DOM element text content
   * Handles various formats that might appear in Keka UI
   * @param {string} text - Text content from DOM
   * @returns {Date|null} - Parsed date or null
   */
  parseFromDOMText(text) {
    if (!text) return null;
    
    // Remove extra whitespace and newlines
    const cleaned = text.replace(/\s+/g, ' ').trim();
    
    // Try to find time pattern with seconds (HH:MM:SS AM/PM) or without (HH:MM AM/PM)
    const timeMatch = cleaned.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/i);
    if (timeMatch) {
      // Remove seconds if present (10:37:26 AM -> 10:37 AM)
      const timeStr = timeMatch[1].replace(/(\d{1,2}:\d{2}):\d{2}/, '$1');
      return this.parseTime(timeStr);
    }
    
    return null;
  }
};

// Make available globally for other scripts
window.TimeUtils = TimeUtils;

