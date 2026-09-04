/**
 * Full simulation of the /api/operations/summary route
 */
const mongoose = require('mongoose');

// Load models in correct order
const Table = require('../models/Table');
const Booking = require('../models/Booking');
const Waitlist = require('../models/Waitlist');
const { isCurrentTimeSlot } = require('../utils/availabilityHelper');

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

function getMinutesBetween(startTimeStr, endTimeStr) {
  const [sH, sM] = startTimeStr.split(':').map(Number);
  const [eH, eM] = endTimeStr.split(':').map(Number);
  return (eH * 60 + eM) - (sH * 60 + sM);
}

async function simulateOpsRoute() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-booking');
  
  try {
    const { now, todayStr, currentTimeStr } = getCurrentLocalDateTime();
    console.log('todayStr:', todayStr, '| currentTimeStr:', currentTimeStr);

    const [tables, allBookings, waitlistEntries] = await Promise.all([
      Table.find().sort({ number: 1 }),
      Booking.find({
        status: { $in: ['Confirmed', 'Checked In', 'Seated', 'Completed'] }
      }).populate('tableId').sort({ bookingDate: 1, startTime: 1 }),
      Waitlist.find().sort({ joinedAt: 1 })
    ]);

    console.log('\nTables:', tables.length);
    console.log('Bookings (active statuses):', allBookings.length);
    console.log('Waitlist:', waitlistEntries.length);

    // Simulate tableTodayBookingsMap
    const tableTodayBookingsMap = new Map();
    for (const b of allBookings) {
      if (b.tableId && (b.bookingDate >= todayStr) && b.status !== 'Cancelled' && b.status !== 'No Show') {
        const tId = b.tableId._id ? b.tableId._id.toString() : b.tableId.toString();
        if (!tableTodayBookingsMap.has(tId)) tableTodayBookingsMap.set(tId, []);
        tableTodayBookingsMap.get(tId).push(b);
      }
    }

    console.log('\ntableTodayBookingsMap entries:', tableTodayBookingsMap.size);

    // Process each table
    const detailedTables = tables.map(table => {
      const tId = table._id.toString();
      const todayTableBookings = tableTodayBookingsMap.get(tId) || [];
      
      const currentActiveBooking = todayTableBookings.find(b =>
        b.bookingDate === todayStr && (
          b.status === 'Seated' ||
          b.status === 'Checked In' ||
          (b.status === 'Confirmed' && isCurrentTimeSlot(b.bookingDate, b.startTime, b.endTime))
        )
      );

      const upcomingTodayBooking = todayTableBookings.find(b =>
        (b.status === 'Confirmed' || b.status === 'Checked In') &&
        (b.bookingDate > todayStr || (b.bookingDate === todayStr && b.startTime > currentTimeStr))
      );

      let operationalStatus = 'AVAILABLE';
      if (table.isOccupied || (currentActiveBooking && currentActiveBooking.status === 'Seated')) {
        operationalStatus = 'OCCUPIED';
      } else if (upcomingTodayBooking) {
        operationalStatus = 'RESERVED';
      }

      if (upcomingTodayBooking) {
        console.log(`  Table T-${table.number}: RESERVED for ${upcomingTodayBooking.customerName} at ${upcomingTodayBooking.startTime}`);
      }

      return { _id: table._id, number: table.number, operationalStatus };
    });

    // Simulate upcoming reservations
    const upcomingReservations = allBookings
      .filter(b => {
        if (b.status !== 'Confirmed' && b.status !== 'Checked In') return false;
        if (b.bookingDate > todayStr) return true;
        if (b.bookingDate === todayStr) return true;
        return false;
      });

    console.log('\nUpcoming reservations:');
    upcomingReservations.forEach(b => {
      console.log(`  -> ${b.customerName} | ${b.bookingDate} ${b.startTime} | ${b.status} | table: ${b.tableId?.number}`);
    });

    console.log('\nRoute would return upcomingReservations count:', upcomingReservations.length);
    console.log('SUCCESS - route simulation complete');
  } catch (err) {
    console.error('ROUTE ERROR:', err.message);
    console.error(err.stack);
  } finally {
    await mongoose.disconnect();
  }
}

simulateOpsRoute();
