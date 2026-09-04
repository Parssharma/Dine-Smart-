/**
 * Test the full /api/operations/summary endpoint logic
 * to see exactly what it returns for upcomingReservations
 */
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-booking');
  
  // Load all models like server does
  const Table = require('../models/Table');
  const Booking = require('../models/Booking');
  const Waitlist = require('../models/Waitlist');
  
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localNow = new Date(now.getTime() - (offset * 60 * 1000));
  const todayStr = localNow.toISOString().split('T')[0];
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;
  
  console.log('todayStr:', todayStr, '| currentTimeStr:', currentTimeStr);
  
  const [tables, allBookings, waitlistEntries] = await Promise.all([
    Table.find().sort({ number: 1 }),
    Booking.find({
      status: { $in: ['Confirmed', 'Checked In', 'Seated', 'Completed'] }
    }).populate('tableId').sort({ bookingDate: 1, startTime: 1 }),
    Waitlist.find().sort({ joinedAt: 1 })
  ]);
  
  console.log('\nTotal bookings fetched:', allBookings.length);
  
  const upcomingReservations = allBookings
    .filter(b => {
      if (b.status !== 'Confirmed' && b.status !== 'Checked In') return false;
      if (b.bookingDate > todayStr) return true;
      if (b.bookingDate === todayStr) return true;
      return false;
    });
  
  console.log('\nUpcoming reservations count:', upcomingReservations.length);
  upcomingReservations.forEach(b => {
    console.log(`  -> ${b.customerName} | ${b.bookingDate} ${b.startTime} | ${b.status}`);
  });
  
  console.log('\nTable count:', tables.length);
  console.log('Waitlist count:', waitlistEntries.length);
  
  await mongoose.disconnect();
}

test().catch(console.error);
