/**
 * Quick check: simulates what /api/operations/summary returns for upcomingReservations
 */
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-booking');
  require('../models/Table');  // register schema first
  require('../models/Waitlist');
  const Booking = require('../models/Booking');

  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localNow = new Date(now.getTime() - (offset * 60 * 1000));
  const todayStr = localNow.toISOString().split('T')[0];
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  console.log('todayStr:', todayStr);
  console.log('currentTimeStr:', currentTimeStr);

  const allBookings = await Booking.find({
    status: { $in: ['Confirmed', 'Checked In', 'Seated', 'Completed'] }
  }).populate('tableId').sort({ bookingDate: 1, startTime: 1 });

  console.log('\nAll active bookings in DB:');
  allBookings.forEach(b => {
    console.log(`  [${b.status}] ${b.customerName} | ${b.bookingDate} ${b.startTime}-${b.endTime} | Table: ${b.tableId?.number}`);
  });

  const upcomingReservations = allBookings.filter(b => {
    if (b.status !== 'Confirmed' && b.status !== 'Checked In') return false;
    if (b.bookingDate > todayStr) return true;
    if (b.bookingDate === todayStr) return true;
    return false;
  });

  console.log('\nUpcoming reservations (filtered):');
  upcomingReservations.forEach(b => {
    console.log(`  [${b.status}] ${b.customerName} | ${b.bookingDate} ${b.startTime} | Table: ${b.tableId?.number}`);
  });
  console.log('Count:', upcomingReservations.length);

  await mongoose.disconnect();
}

check().catch(console.error);
