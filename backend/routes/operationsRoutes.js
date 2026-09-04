const express = require('express');
const router = express.Router();
const Table = require('../models/Table');
const Booking = require('../models/Booking');
const Waitlist = require('../models/Waitlist');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { isCurrentTimeSlot } = require('../utils/availabilityHelper');

/**
 * Helper to get current local date (YYYY-MM-DD) and time (HH:MM)
 */
function getCurrentLocalDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localNow = new Date(now.getTime() - (offset * 60 * 1000));
  const todayStr = localNow.toISOString().split('T')[0];

  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  return { now, todayStr, currentTimeStr };
}

/**
 * Helper to calculate minutes difference between two HH:MM time strings on the same day
 */
function getMinutesBetween(startTimeStr, endTimeStr) {
  const [sH, sM] = startTimeStr.split(':').map(Number);
  const [eH, eM] = endTimeStr.split(':').map(Number);
  return (eH * 60 + eM) - (sH * 60 + sM);
}

/**
 * Helper to check No Show eligibility based on grace period
 */
function checkNoShowEligibility(booking, todayStr, now) {
  if (!['Confirmed', 'Checked In'].includes(booking.status)) return false;
  const graceMinutes = parseInt(process.env.NO_SHOW_GRACE_MINUTES || '15', 10);
  
  if (booking.bookingDate < todayStr) return true;
  if (booking.bookingDate > todayStr) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [sH, sM] = booking.startTime.split(':').map(Number);
  const startMinutes = sH * 60 + sM;
  return currentMinutes >= (startMinutes + graceMinutes);
}

// @route   GET /api/operations/summary
// @desc    Get real-time operational metrics, tables, seated guests, upcoming reservations, waitlist, and alerts (MANAGER only)
router.get('/summary', requireAuth, requireRole('MANAGER'), async (req, res) => {
  try {
    const { now, todayStr, currentTimeStr } = getCurrentLocalDateTime();
    const longDiningThreshold = parseInt(process.env.LONG_DINING_THRESHOLD_MINUTES || '90', 10);

    // 1. Fetch tables, bookings, waitlist concurrently
    const [tables, allBookings, waitlistEntries] = await Promise.all([
      Table.find().sort({ number: 1 }),
      Booking.find({
        status: { $in: ['Confirmed', 'Checked In', 'Seated', 'Completed'] }
      }).populate('tableId').sort({ bookingDate: 1, startTime: 1 }),
      Waitlist.find().sort({ joinedAt: 1 })
    ]);

    // 2. Classify Tables & Calculate derived operational statuses
    const occupiedTablesList = [];
    const reservedTablesList = [];
    const availableTablesList = [];

    // Group active bookings by table ID for today and future dates
    const tableTodayBookingsMap = new Map();
    for (const b of allBookings) {
      if (b.tableId && (b.bookingDate >= todayStr || b.status === 'Seated') && b.status !== 'Cancelled' && b.status !== 'No Show' && b.status !== 'Completed') {
        const tId = b.tableId._id ? b.tableId._id.toString() : b.tableId.toString();
        if (!tableTodayBookingsMap.has(tId)) {
          tableTodayBookingsMap.set(tId, []);
        }
        tableTodayBookingsMap.get(tId).push(b);
      }
    }

    const detailedTables = tables.map(table => {
      const tId = table._id.toString();
      const todayTableBookings = tableTodayBookingsMap.get(tId) || [];

      // Find currently active booking for this table right now
      const currentActiveBooking = todayTableBookings.find(b => 
        b.status === 'Seated' || 
        b.status === 'Checked In' ||
        (b.status === 'Confirmed' && b.bookingDate === todayStr && isCurrentTimeSlot(b.bookingDate, b.startTime, b.endTime))
      );

      // Find future upcoming confirmed or checked-in booking today or future dates
      const upcomingTodayBooking = todayTableBookings.find(b => 
        (b.status === 'Confirmed' || b.status === 'Checked In') && 
        (!currentActiveBooking || b._id.toString() !== currentActiveBooking._id.toString()) &&
        (b.bookingDate > todayStr || (b.bookingDate === todayStr && b.startTime > currentTimeStr))
      );

      const isPhysicallyOccupied = Boolean(table.isOccupied || (currentActiveBooking && currentActiveBooking.status === 'Seated'));
      let operationalStatus = 'AVAILABLE';
      let currentGuest = null;
      let nextReservation = null;

      if (isPhysicallyOccupied) {
        operationalStatus = 'OCCUPIED';
        if (currentActiveBooking) {
          const seatedTime = currentActiveBooking.seatedAt || currentActiveBooking.checkedInAt || currentActiveBooking.bookingTime || currentActiveBooking.createdAt;
          const duration = seatedTime ? Math.max(0, Math.round((now.getTime() - new Date(seatedTime).getTime()) / 60000)) : 0;
          currentGuest = {
            bookingId: currentActiveBooking._id,
            customerName: currentActiveBooking.customerName,
            partySize: currentActiveBooking.partySize,
            contact: currentActiveBooking.contact,
            startTime: currentActiveBooking.startTime,
            endTime: currentActiveBooking.endTime,
            bookingDate: currentActiveBooking.bookingDate,
            seatedAt: seatedTime,
            durationMinutes: duration,
            status: currentActiveBooking.status
          };
        }
      } else if (upcomingTodayBooking) {
        operationalStatus = 'RESERVED';
      }

      if (upcomingTodayBooking) {
        const minsUntil = getMinutesBetween(currentTimeStr, upcomingTodayBooking.startTime);
        nextReservation = {
          bookingId: upcomingTodayBooking._id,
          customerName: upcomingTodayBooking.customerName,
          partySize: upcomingTodayBooking.partySize,
          contact: upcomingTodayBooking.contact,
          startTime: upcomingTodayBooking.startTime,
          endTime: upcomingTodayBooking.endTime,
          startsInMinutes: minsUntil,
          status: upcomingTodayBooking.status
        };
      }

      const tableObj = {
        _id: table._id,
        number: table.number,
        capacity: table.capacity,
        location: table.location,
        isOccupied: isPhysicallyOccupied,
        rating: table.rating,
        operationalStatus,
        currentGuest,
        nextReservation
      };

      if (operationalStatus === 'OCCUPIED') {
        occupiedTablesList.push(tableObj);
      } else if (operationalStatus === 'RESERVED') {
        reservedTablesList.push(tableObj);
      } else {
        availableTablesList.push(tableObj);
      }

      return tableObj;
    });

    // 3. Extract Currently Seated Guests
    const currentSeated = [];
    for (const b of allBookings) {
      if (b.status === 'Seated' || (b.status === 'Confirmed' && b.tableId?.isOccupied && b.bookingDate === todayStr && isCurrentTimeSlot(b.bookingDate, b.startTime, b.endTime))) {
        const seatedTime = b.seatedAt || b.bookingTime || b.createdAt;
        const duration = seatedTime ? Math.max(0, Math.round((now.getTime() - new Date(seatedTime).getTime()) / 60000)) : 0;
        currentSeated.push({
          _id: b._id,
          customerName: b.customerName,
          partySize: b.partySize,
          contact: b.contact,
          table: b.tableId ? {
            _id: b.tableId._id,
            number: b.tableId.number,
            capacity: b.tableId.capacity,
            location: b.tableId.location
          } : null,
          bookingDate: b.bookingDate,
          startTime: b.startTime,
          endTime: b.endTime,
          seatedAt: seatedTime,
          durationMinutes: duration,
          status: b.status,
          isLongDining: duration >= longDiningThreshold
        });
      }
    }

    // 4. Extract Upcoming Reservations (chronologically sorted)
    const upcomingReservations = allBookings
      .filter(b => {
        if (b.status !== 'Confirmed' && b.status !== 'Checked In') return false;
        if (b.bookingDate > todayStr) return true;
        if (b.bookingDate === todayStr) {
          // If today, include all upcoming or eligible for no show
          return true;
        }
        return false;
      })
      .sort((a, b) => {
        if (a.bookingDate !== b.bookingDate) {
          return a.bookingDate.localeCompare(b.bookingDate);
        }
        return a.startTime.localeCompare(b.startTime);
      })
      .map(b => {
        const eligibleNoShow = checkNoShowEligibility(b, todayStr, now);
        return {
          _id: b._id,
          customerName: b.customerName,
          partySize: b.partySize,
          contact: b.contact,
          table: b.tableId ? {
            _id: b.tableId._id,
            number: b.tableId.number,
            capacity: b.tableId.capacity,
            location: b.tableId.location
          } : null,
          bookingDate: b.bookingDate,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          checkedInAt: b.checkedInAt,
          isEligibleForNoShow: eligibleNoShow
        };
      });

    // 5. Extract Waitlist with waiting duration & suggestions
    const waitlistWithDetails = waitlistEntries.map((w, index) => {
      const waitingDuration = Math.max(0, Math.round((now.getTime() - new Date(w.joinedAt).getTime()) / 60000));
      
      // Find a currently available table that fits party size
      const suggested = availableTablesList.find(t => t.capacity >= w.partySize);

      return {
        _id: w._id,
        position: index + 1,
        customerName: w.customerName,
        partySize: w.partySize,
        contact: w.contact,
        bookingDate: w.bookingDate,
        startTime: w.startTime,
        endTime: w.endTime,
        joinedAt: w.joinedAt,
        waitingDurationMinutes: waitingDuration,
        suggestedTable: suggested ? {
          _id: suggested._id,
          number: suggested.number,
          capacity: suggested.capacity,
          location: suggested.location
        } : null
      };
    });

    // 6. Table Turnover & Average Dining Duration
    let totalCompletedDuration = 0;
    let completedCount = 0;

    for (const b of allBookings) {
      if (b.status === 'Completed') {
        const start = b.seatedAt || b.bookingTime || b.createdAt;
        const end = b.completedAt || b.updatedAt;
        if (start && end) {
          const duration = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
          if (duration > 0 && duration < 300) { // realistic filter
            totalCompletedDuration += duration;
            completedCount++;
          }
        }
      }
    }

    const averageDiningDurationMinutes = completedCount > 0 
      ? Math.round(totalCompletedDuration / completedCount) 
      : null;

    // 7. Operational Alerts derived strictly from actual state
    const alerts = [];

    // Alert: Tables with upcoming reservations in under 30 minutes
    detailedTables.forEach(t => {
      if (t.nextReservation && t.nextReservation.startsInMinutes >= 0 && t.nextReservation.startsInMinutes <= 30) {
        alerts.push({
          type: 'UPCOMING',
          severity: 'info',
          message: `Table ${t.number} has a reservation for ${t.nextReservation.customerName} (Party of ${t.nextReservation.partySize}) in ${t.nextReservation.startsInMinutes} min at ${t.nextReservation.startTime}.`
        });
      }
    });

    // Alert: Tables currently OCCUPIED with upcoming reservation turnover warning
    detailedTables.forEach(t => {
      if (t.operationalStatus === 'OCCUPIED' && t.nextReservation && t.nextReservation.startsInMinutes >= 0 && t.nextReservation.startsInMinutes <= 45) {
        alerts.push({
          type: 'TURNOVER_WARNING',
          severity: 'warning',
          message: `Turnover Warning: Table ${t.number} is currently OCCUPIED (${t.currentGuest?.customerName || 'Guest'}) and has a next reservation at ${t.nextReservation.startTime} (${t.nextReservation.startsInMinutes} min remaining).`
        });
      }
    });

    // Alert: Long Dining session alert (> longDiningThreshold min)
    currentSeated.forEach(s => {
      if (s.durationMinutes >= longDiningThreshold) {
        alerts.push({
          type: 'LONG_DINING',
          severity: 'warning',
          message: `Long Dining Alert: Table ${s.table?.number || 'Unknown'} (${s.customerName}) has been occupied for ${s.durationMinutes} minutes.`
        });
      }
    });

    // Alert: No-Show Eligible reservations
    upcomingReservations.forEach(r => {
      if (r.isEligibleForNoShow) {
        alerts.push({
          type: 'NO_SHOW_ELIGIBLE',
          severity: 'warning',
          message: `Reservation for ${r.customerName} (${r.table ? 'Table ' + r.table.number : 'Unassigned'}, ${r.startTime}) is eligible for no-show handling.`
        });
      }
    });

    // Alert: Waitlist backlog
    if (waitlistEntries.length > 0) {
      alerts.push({
        type: 'WAITLIST',
        severity: 'info',
        message: `${waitlistEntries.length} guest${waitlistEntries.length > 1 ? 's are' : ' is'} currently waiting on the waitlist.`
      });
    }

    // Alert: Seating suggestions for waiting guests
    waitlistWithDetails.forEach(w => {
      if (w.suggestedTable) {
        alerts.push({
          type: 'SEATING',
          severity: 'success',
          message: `Table ${w.suggestedTable.number} is available for waitlisted guest ${w.customerName} (Party of ${w.partySize}).`
        });
      }
    });

    res.json({
      success: true,
      tables: {
        total: tables.length,
        available: availableTablesList.length,
        occupied: occupiedTablesList.length,
        reserved: reservedTablesList.length,
        list: detailedTables
      },
      waitlist: {
        total: waitlistEntries.length,
        entries: waitlistWithDetails
      },
      currentSeated,
      upcomingReservations,
      turnover: {
        averageDiningDurationMinutes,
        completedCount
      },
      alerts,
      lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
