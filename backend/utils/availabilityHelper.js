const Table = require('../models/Table');
const Booking = require('../models/Booking');

/**
 * Checks if two time intervals overlap.
 * Strictly checks: startA < endB && endA > startB
 */
function hasTimeConflict(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

/**
 * Checks if a requested date and time slot covers the current moment.
 */
function isCurrentTimeSlot(bookingDate, startTime, endTime) {
  const now = new Date();
  
  // Format local date YYYY-MM-DD
  const offset = now.getTimezoneOffset();
  const localNow = new Date(now.getTime() - (offset * 60 * 1000));
  const todayStr = localNow.toISOString().split('T')[0];
  
  if (bookingDate !== todayStr) {
    return false;
  }
  
  // Format local time HH:MM
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;
  
  return currentTimeStr >= startTime && currentTimeStr < endTime;
}

/**
 * Retrieves all tables that are available (not conflicting with other bookings and capacity fit)
 * for a specific date and time slot.
 *
 * @param {string} bookingDate YYYY-MM-DD
 * @param {string} startTime HH:MM
 * @param {string} endTime HH:MM
 * @param {number} partySize Number of guests
 * @returns {Promise<Array>} Available Table documents
 */
async function getAvailableTables(bookingDate, startTime, endTime, partySize) {
  // 1. Fetch all tables
  const allTables = await Table.find().sort({ number: 1 });

  // 2. Fetch active bookings for this date
  const bookingsOnDate = await Booking.find({
    bookingDate,
    status: { $in: ['Confirmed', 'Checked In', 'Seated'] }
  });

  // 3. Find which tables have time conflicts
  const conflictedTableIds = new Set();
  for (const booking of bookingsOnDate) {
    if (booking.tableId && hasTimeConflict(booking.startTime, booking.endTime, startTime, endTime)) {
      conflictedTableIds.add(booking.tableId.toString());
    }
  }

  // 4. Check if the slot is "now" and check physical occupancy
  const checkPhysicalOccupancy = isCurrentTimeSlot(bookingDate, startTime, endTime);

  // 5. Filter tables
  const availableTables = allTables.filter(table => {
    // Capacity check
    if (partySize && table.capacity < partySize) {
      return false;
    }
    
    // Reservation conflict check
    if (conflictedTableIds.has(table._id.toString())) {
      return false;
    }

    // Physical occupancy check (only if reserving right now)
    if (checkPhysicalOccupancy && table.isOccupied) {
      return false;
    }

    return true;
  });

  return availableTables;
}

module.exports = {
  hasTimeConflict,
  isCurrentTimeSlot,
  getAvailableTables
};
