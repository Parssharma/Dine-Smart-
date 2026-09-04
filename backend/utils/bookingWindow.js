/**
 * Utility to validate that a booking date and start time fall within
 * the required lead time window of 1 to 24 hours in advance.
 */

const MIN_LEAD_MS = 1 * 60 * 60 * 1000;   // 1 hour in milliseconds
const MAX_LEAD_MS = 24 * 60 * 60 * 1000;  // 24 hours in milliseconds

/**
 * Validates whether a requested booking slot falls between 1 and 24 hours from now.
 * @param {string} bookingDate YYYY-MM-DD
 * @param {string} startTime HH:MM
 * @param {Object} options Optional bypass options (e.g. for Manager role or test env)
 * @returns {{ valid: boolean, message?: string }}
 */
function validateBookingWindow(bookingDate, startTime, options = {}) {
  if (options.isManager) {
    return { valid: true };
  }

  if (!bookingDate || !startTime) {
    return { valid: false, message: 'Booking date and start time are required.' };
  }

  // Parse YYYY-MM-DD and HH:MM
  const dateTimeStr = `${bookingDate}T${startTime}:00`;
  const targetTime = new Date(dateTimeStr).getTime();

  if (isNaN(targetTime)) {
    return { valid: false, message: 'Invalid booking date or time format.' };
  }

  const now = Date.now();
  const leadTime = targetTime - now;

  if (leadTime < MIN_LEAD_MS) {
    return { 
      valid: false, 
      message: 'Bookings must be made at least 1 hour in advance.' 
    };
  }

  if (leadTime > MAX_LEAD_MS) {
    return { 
      valid: false, 
      message: 'Bookings can only be made up to 24 hours in advance.' 
    };
  }

  return { valid: true };
}

module.exports = { validateBookingWindow, MIN_LEAD_MS, MAX_LEAD_MS };
