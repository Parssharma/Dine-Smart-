/**
 * Utility to calculate min and max date bounds for date pickers (1 to 24 hours from now)
 */
export function getDateBounds() {
  const now = new Date();
  const minDate = new Date(now.getTime() + 60 * 60 * 1000);       // now + 1h
  const maxDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);  // now + 24h

  const pad = (n) => String(n).padStart(2, "0");
  const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  return { min: toDateInput(minDate), max: toDateInput(maxDate) };
}

/**
 * Validates that a booking date and start time fall strictly within 1 to 24 hours from now.
 * @param {string} bookingDate YYYY-MM-DD
 * @param {string} startTime HH:MM
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateBookingWindowFrontend(bookingDate, startTime) {
  if (!bookingDate || !startTime) {
    return { valid: false, message: 'Booking date and start time are required.' };
  }

  const dateTimeStr = `${bookingDate}T${startTime}:00`;
  const targetTime = new Date(dateTimeStr).getTime();

  if (isNaN(targetTime)) {
    return { valid: false, message: 'Invalid booking date or time format.' };
  }

  const now = Date.now();
  const leadTime = targetTime - now;
  const MIN_LEAD_MS = 1 * 60 * 60 * 1000;
  const MAX_LEAD_MS = 24 * 60 * 60 * 1000;

  if (leadTime < MIN_LEAD_MS || leadTime > MAX_LEAD_MS) {
    return { valid: false, message: 'Bookings must be made between 1 and 24 hours in advance.' };
  }

  return { valid: true };
}
