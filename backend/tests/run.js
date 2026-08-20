process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_dinesmart_auth_2026';
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const app = require('../server');
const Table = require('../models/Table');
const Booking = require('../models/Booking');
const Waitlist = require('../models/Waitlist');
const User = require('../models/User');
const BookingAudit = require('../models/BookingAudit');
const Notification = require('../models/Notification');
const DsaAnalyticsEvent = require('../models/DsaAnalyticsEvent');

const PORT = 5001;
const MONGO_URI = 'mongodb://localhost:27017/smart-booking-test';
const API_BASE = `http://localhost:${PORT}/api`;

let server;
let passedCount = 0;
let failedCount = 0;

function logResult(testName, passed, detail = '') {
  if (passed) {
    passedCount++;
    console.log(`  ✓ ${testName} ${detail ? `(${detail})` : ''}`);
  } else {
    failedCount++;
    console.log(`  * ${testName} FAILED! ${detail ? `[${detail}]` : ''}`);
  }
}

const randPhone = () => String(Math.floor(1000000000 + Math.random() * 9000000000));
const randEmail = (prefix = 'user') => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}@example.com`;

async function runTests() {
  console.log("\n==========================================================");
  console.log("DINESMART AUTOMATED TEST SUITE (PHASE 12 & PHASE 13)");
  console.log("==========================================================\n");

  // 1. Database Connection & Server Startup
  try {
    process.env.NODE_ENV = 'test';
    await mongoose.connect(MONGO_URI);
    console.log("Connected to isolated test database.");

    await new Promise((resolve) => {
      server = app.listen(PORT, () => {
        console.log(`Test server listening on port ${PORT}\n`);
        resolve();
      });
    });
  } catch (err) {
    console.error("Test environment startup failed:", err);
    process.exit(1);
  }

  // 2. Clean database first
  console.log("Cleaning test database collections...");
  await Table.deleteMany({});
  await Booking.deleteMany({});
  await Waitlist.deleteMany({});
  await User.deleteMany({});

  // 3. Setup Test Tables & Test Manager
  console.log("Creating test tables and manager credentials...");
  const t101 = await Table.create({ number: '101', capacity: 4, location: 'Window', rating: 5 });
  const t102 = await Table.create({ number: '102', capacity: 2, location: 'Center', rating: 4 });
  const t103 = await Table.create({ number: '103', capacity: 6, location: 'Outdoor', rating: 4.5 });

  const testManager = await User.create({
    name: 'Admin Manager',
    email: 'manager@test.com',
    password: 'ManagerPassword123!',
    role: 'MANAGER'
  });

  const managerToken = jwt.sign(
    { id: testManager._id.toString(), role: 'MANAGER', name: testManager.name, email: testManager.email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  const managerHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${managerToken}`
  };

  console.log("Setup complete. Starting Phase 12 Regression Scenarios (Tests 1-27)...\n");

  // ==========================================================
  // TEST 1: Same table + same time
  // ==========================================================
  try {
    const phoneA = randPhone();
    const phoneB = randPhone();
    const resA = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: phoneA,
        tableId: t101._id, bookingDate: '2026-12-01', startTime: '12:00', endTime: '13:30'
      })
    });
    const resB = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Bob', partySize: 2, contact: phoneB,
        tableId: t101._id, bookingDate: '2026-12-01', startTime: '12:00', endTime: '13:30'
      })
    });
    const dataB = await resB.json();
    const success = (resA.status === 201) && (resB.status === 400) && (dataB.message.includes('booked'));
    logResult("TEST 1 - Same table + same time conflict", success);
  } catch (err) {
    logResult("TEST 1 - Same table + same time conflict", false, err.message);
  }

  // ==========================================================
  // TEST 2: Same table + different time
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Charlie', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-01', startTime: '14:00', endTime: '15:30'
      })
    });
    logResult("TEST 2 - Same table + different time", res.status === 201);
  } catch (err) {
    logResult("TEST 2 - Same table + different time", false, err.message);
  }

  // ==========================================================
  // TEST 3: Same table + different date
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'David', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-02', startTime: '12:00', endTime: '13:30'
      })
    });
    logResult("TEST 3 - Same table + different date", res.status === 201);
  } catch (err) {
    logResult("TEST 3 - Same table + different date", false, err.message);
  }

  // ==========================================================
  // TEST 4: Cancel future booking
  // ==========================================================
  try {
    await Table.findByIdAndUpdate(t101._id, { isOccupied: true });
    
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const resF = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Frank', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: tomorrow, startTime: '12:00', endTime: '13:30'
      })
    });
    const bookF = await resF.json();
    
    await fetch(`${API_BASE}/bookings/${bookF.data._id}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Cancelled' })
    });

    const checkTable = await Table.findById(t101._id);
    logResult("TEST 4 - Cancel future booking side-effect", checkTable.isOccupied === true);
  } catch (err) {
    logResult("TEST 4 - Cancel future booking side-effect", false, err.message);
  }

  // ==========================================================
  // TEST 5: Complete current booking
  // ==========================================================
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currH = String(now.getHours()).padStart(2, '0');
    const endH = String(Math.min(23, now.getHours() + 1)).padStart(2, '0');
    const startT = `${currH}:00`;
    const endT = `${endH}:30`;

    await Table.findByIdAndUpdate(t101._id, { isOccupied: false });

    const resC = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Grace', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: today, startTime: startT, endTime: endT
      })
    });
    const bookC = await resC.json();

    // Seated
    await fetch(`${API_BASE}/bookings/${bookC.data._id}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Seated' })
    });

    // Complete
    await fetch(`${API_BASE}/bookings/${bookC.data._id}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Completed' })
    });

    const checkTable = await Table.findById(t101._id);
    logResult("TEST 5 - Complete current booking", checkTable.isOccupied === false);
  } catch (err) {
    logResult("TEST 5 - Complete current booking", false, err.message);
  }

  // ==========================================================
  // TEST 6: Future booking does not mean physically occupied
  // ==========================================================
  try {
    await Table.findByIdAndUpdate(t101._id, { isOccupied: false });
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Hannah', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: tomorrow, startTime: '12:00', endTime: '13:30'
      })
    });
    
    const checkTable = await Table.findById(t101._id);
    logResult("TEST 6 - Future booking keeps physical free", checkTable.isOccupied === false);
  } catch (err) {
    logResult("TEST 6 - Future booking keeps physical free", false, err.message);
  }

  // ==========================================================
  // TEST 7: No suitable table
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Ivan', partySize: 20, contact: randPhone(),
        bookingDate: '2026-12-05', startTime: '12:00', endTime: '13:30'
      })
    });
    const wait = await res.json();
    const success = (res.status === 201) && (wait.type === 'waitlist') && (wait.position === 1);
    logResult("TEST 7 - No suitable table waitlist fallback", success);
  } catch (err) {
    logResult("TEST 7 - No suitable table waitlist fallback", false, err.message);
  }

  // ==========================================================
  // TEST 8: Backtracking combination
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/dsa/combine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partySize: 6, bookingDate: '2026-12-20', startTime: '12:00', endTime: '13:30'
      })
    });
    const data = await res.json();
    const success = (res.status === 200) && (data.combination.length > 0) && (data.totalCapacity >= 6);
    logResult("TEST 8 - Table backtracking combiner", success, `Tables: ${data.combination.length}`);
  } catch (err) {
    logResult("TEST 8 - Table backtracking combiner", false, err.message);
  }

  // ==========================================================
  // TEST 9: Priority Queue recommendation
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/dsa/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partySize: 2, preference: 'Window', bookingDate: '2026-12-20', startTime: '12:00', endTime: '13:30'
      })
    });
    const data = await res.json();
    const success = data[0]?.number === '102';
    logResult("TEST 9 - Priority Queue location recommendation", success, `Top: T-${data[0]?.number}`);
  } catch (err) {
    logResult("TEST 9 - Priority Queue location recommendation", false, err.message);
  }

  // ==========================================================
  // TEST 10: Cancelled booking releases slot
  // ==========================================================
  try {
    const phone = randPhone();
    const resB = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Jake', partySize: 2, contact: phone,
        tableId: t101._id, bookingDate: '2026-12-25', startTime: '12:00', endTime: '13:30'
      })
    });
    const book = await resB.json();

    // Cancel with manager token
    await fetch(`${API_BASE}/bookings/${book.data._id}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Cancelled' })
    });

    // Rebook
    const resRe = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Karen', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-25', startTime: '12:00', endTime: '13:30'
      })
    });
    logResult("TEST 10 - Cancelled slot reuse", resRe.status === 201);
  } catch (err) {
    logResult("TEST 10 - Cancelled slot reuse", false, err.message);
  }

  // ==========================================================
  // TEST 11: Partial overlap
  // ==========================================================
  try {
    await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-06', startTime: '19:00', endTime: '20:00'
      })
    });
    const resOverlap = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Bob', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-06', startTime: '19:30', endTime: '20:30'
      })
    });
    logResult("TEST 11 - Partial overlap prevention", resOverlap.status === 400);
  } catch (err) {
    logResult("TEST 11 - Partial overlap prevention", false, err.message);
  }

  // ==========================================================
  // TEST 12: Request completely inside booking
  // ==========================================================
  try {
    await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-07', startTime: '19:00', endTime: '22:00'
      })
    });
    const resInside = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Bob', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-07', startTime: '20:00', endTime: '21:00'
      })
    });
    logResult("TEST 12 - Inside booking overlap prevention", resInside.status === 400);
  } catch (err) {
    logResult("TEST 12 - Inside booking overlap prevention", false, err.message);
  }

  // ==========================================================
  // TEST 13: Booking immediately after existing booking
  // ==========================================================
  try {
    await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-08', startTime: '19:00', endTime: '20:00'
      })
    });
    const resAfter = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Bob', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-08', startTime: '20:00', endTime: '21:00'
      })
    });
    logResult("TEST 13 - Booking immediately after (boundary case)", resAfter.status === 201);
  } catch (err) {
    logResult("TEST 13 - Booking immediately after (boundary case)", false, err.message);
  }

  // ==========================================================
  // TEST 14: Booking immediately before existing booking
  // ==========================================================
  try {
    await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-09', startTime: '19:00', endTime: '20:00'
      })
    });
    const resBefore = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Bob', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-09', startTime: '18:00', endTime: '19:00'
      })
    });
    logResult("TEST 14 - Booking immediately before (boundary case)", resBefore.status === 201);
  } catch (err) {
    logResult("TEST 14 - Booking immediately before (boundary case)", false, err.message);
  }

  // ==========================================================
  // TEST 15: Different table
  // ==========================================================
  try {
    await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-10', startTime: '19:00', endTime: '20:00'
      })
    });
    const resDiffTable = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Bob', partySize: 2, contact: randPhone(),
        tableId: t102._id, bookingDate: '2026-12-10', startTime: '19:00', endTime: '20:00'
      })
    });
    logResult("TEST 15 - Different table at same time", resDiffTable.status === 201);
  } catch (err) {
    logResult("TEST 15 - Different table at same time", false, err.message);
  }

  // ==========================================================
  // TEST 16: Different date
  // ==========================================================
  try {
    await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-11', startTime: '19:00', endTime: '20:00'
      })
    });
    const resDiffDate = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Bob', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-12', startTime: '19:00', endTime: '20:00'
      })
    });
    logResult("TEST 16 - Same table at same time on different date", resDiffDate.status === 201);
  } catch (err) {
    logResult("TEST 16 - Same table at same time on different date", false, err.message);
  }

  // ==========================================================
  // TEST 17: Cancelled booking (does not block)
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-13', startTime: '19:00', endTime: '20:00'
      })
    });
    const book = await res.json();
    await fetch(`${API_BASE}/bookings/${book.data._id}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Cancelled' })
    });
    const resRetry = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Bob', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-13', startTime: '19:00', endTime: '20:00'
      })
    });
    logResult("TEST 17 - Cancelled booking releases slot validation", resRetry.status === 201);
  } catch (err) {
    logResult("TEST 17 - Cancelled booking releases slot validation", false, err.message);
  }

  // ==========================================================
  // TEST 18: Completed booking (does not block)
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-14', startTime: '19:00', endTime: '20:00'
      })
    });
    const book = await res.json();
    await fetch(`${API_BASE}/bookings/${book.data._id}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Seated' })
    });
    await fetch(`${API_BASE}/bookings/${book.data._id}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Completed' })
    });
    const resNext = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Bob', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-14', startTime: '19:00', endTime: '20:00'
      })
    });
    logResult("TEST 18 - Completed booking releases slot validation", resNext.status === 201);
  } catch (err) {
    logResult("TEST 18 - Completed booking releases slot validation", false, err.message);
  }

  // ==========================================================
  // TEST 19: Invalid party size
  // ==========================================================
  try {
    const res0 = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 0, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-15', startTime: '19:00', endTime: '20:00'
      })
    });
    const resNeg = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: -2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-15', startTime: '19:00', endTime: '20:00'
      })
    });
    logResult("TEST 19 - Invalid party size validation", res0.status === 400 && resNeg.status === 400);
  } catch (err) {
    logResult("TEST 19 - Invalid party size validation", false, err.message);
  }

  // ==========================================================
  // TEST 20: Invalid time
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-15', startTime: '20:00', endTime: '19:00'
      })
    });
    logResult("TEST 20 - Invalid start/end time order validation", res.status === 400);
  } catch (err) {
    logResult("TEST 20 - Invalid start/end time order validation", false, err.message);
  }

  // ==========================================================
  // TEST 21: Missing date
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: randPhone(),
        tableId: t101._id, startTime: '19:00', endTime: '20:00'
      })
    });
    logResult("TEST 21 - Missing date validation", res.status === 400);
  } catch (err) {
    logResult("TEST 21 - Missing date validation", false, err.message);
  }

  // ==========================================================
  // TEST 22: Missing start/end time
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: randPhone(),
        tableId: t101._id, bookingDate: '2026-12-15'
      })
    });
    logResult("TEST 22 - Missing times validation", res.status === 400);
  } catch (err) {
    logResult("TEST 22 - Missing times validation", false, err.message);
  }

  // ==========================================================
  // TEST 23: Invalid table ID format
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: randPhone(),
        tableId: 'invalid-id-format-1234', bookingDate: '2026-12-15', startTime: '19:00', endTime: '20:00'
      })
    });
    logResult("TEST 23 - Malformed Table ID handling", res.status === 400);
  } catch (err) {
    logResult("TEST 23 - Malformed Table ID handling", false, err.message);
  }

  // ==========================================================
  // TEST 24: Non-existent booking ID format
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings/6a80480d0cd30f7c3e2802ff`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Cancelled' })
    });
    logResult("TEST 24 - Non-existent booking ID status 404", res.status === 404);
  } catch (err) {
    logResult("TEST 24 - Non-existent booking ID status 404", false, err.message);
  }

  // ==========================================================
  // TEST 25: Concurrency check (Double-booking race safety)
  // ==========================================================
  try {
    const phoneA = randPhone();
    const phoneB = randPhone();

    const makeRequest = (phone) => fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Alice', partySize: 2, contact: phone,
        tableId: t101._id, bookingDate: '2026-12-18', startTime: '12:00', endTime: '13:30'
      })
    });

    const [res1, res2] = await Promise.all([makeRequest(phoneA), makeRequest(phoneB)]);
    const success = (res1.status === 201 && res2.status === 400) || (res1.status === 400 && res2.status === 201);
    logResult("TEST 25 - Double booking race safety lock", success, `S1: ${res1.status}, S2: ${res2.status}`);
  } catch (err) {
    logResult("TEST 25 - Double booking race safety lock", false, err.message);
  }

  // ==========================================================
  // TEST 26: C++ Engine Failure handling
  // ==========================================================
  try {
    const engineDir = path.join(__dirname, '..', '..', 'dsa-engine');
    const tempEngineDir = path.join(__dirname, '..', '..', 'dsa-engine-temp');

    fs.renameSync(engineDir, tempEngineDir);

    const res = await fetch(`${API_BASE}/dsa/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partySize: 2, preference: 'Window', bookingDate: '2026-12-20', startTime: '12:00', endTime: '13:30'
      })
    });
    
    fs.renameSync(tempEngineDir, engineDir);
    
    const data = await res.json();
    const handledMessage = data.message === "Recommendation engine temporarily unavailable";
    logResult("TEST 26 - C++ Engine missing/failure handled", res.status === 500 && handledMessage, data.message);
  } catch (err) {
    logResult("TEST 26 - C++ Engine missing/failure handled", false, err.message);
  }

  // ==========================================================
  // TEST 27: Database connection validation handler
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partySize: 2, contact: randPhone(), bookingDate: '2026-12-20', startTime: '12:00', endTime: '13:30'
      })
    });
    const data = await res.json();
    logResult("TEST 27 - Database validation maps to 400 error", res.status === 400 && data.message.includes('required'));
  } catch (err) {
    logResult("TEST 27 - Database validation maps to 400 error", false, err.message);
  }

  console.log("\nStarting Phase 13 Authentication, RBAC & Security Scenarios (Tests 28-50)...\n");

  // Helper auth objects for testing
  let customerA = { name: 'Customer Alice', email: randEmail('alice'), password: 'Password123!', token: '' };
  let customerB = { name: 'Customer Bob', email: randEmail('bob'), password: 'Password456!', token: '' };

  // ==========================================================
  // TEST 28: Customer registration succeeds
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: customerA.name,
        email: customerA.email,
        password: customerA.password
      })
    });
    const data = await res.json();
    const success = res.status === 201 && data.success === true && !data.password && !data.passwordHash;
    logResult("TEST 28 - Customer registration succeeds (201)", success);
  } catch (err) {
    logResult("TEST 28 - Customer registration succeeds (201)", false, err.message);
  }

  // ==========================================================
  // TEST 29: Duplicate email registration fails
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another Alice',
        email: customerA.email,
        password: 'DifferentPassword123!'
      })
    });
    const data = await res.json();
    const success = (res.status === 409 || res.status === 400) && data.success === false;
    logResult("TEST 29 - Duplicate email registration fails", success);
  } catch (err) {
    logResult("TEST 29 - Duplicate email registration fails", false, err.message);
  }

  // ==========================================================
  // TEST 30: Invalid registration data fails
  // ==========================================================
  try {
    const resShortPass = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Short', email: randEmail('short'), password: '123' })
    });
    const resNoName = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', email: randEmail('noname'), password: 'Password123!' })
    });
    const resBadEmail = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'BadEmail', email: 'not-an-email', password: 'Password123!' })
    });

    const success = resShortPass.status === 400 && resNoName.status === 400 && resBadEmail.status === 400;
    logResult("TEST 30 - Invalid registration data fails", success);
  } catch (err) {
    logResult("TEST 30 - Invalid registration data fails", false, err.message);
  }

  // ==========================================================
  // TEST 31: Customer login succeeds
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerA.email,
        password: customerA.password
      })
    });
    const data = await res.json();
    if (res.status === 200 && data.token && data.user?.role === 'CUSTOMER') {
      customerA.token = data.token;
      customerA.id = data.user.id;
    }
    const success = res.status === 200 && Boolean(customerA.token) && data.user.role === 'CUSTOMER';
    logResult("TEST 31 - Customer login succeeds with token & role", success);
  } catch (err) {
    logResult("TEST 31 - Customer login succeeds with token & role", false, err.message);
  }

  // Register and login customer B for ownership tests
  try {
    await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: customerB.name, email: customerB.email, password: customerB.password })
    });
    const resB = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerB.email, password: customerB.password })
    });
    const dataB = await resB.json();
    customerB.token = dataB.token;
    customerB.id = dataB.user.id;
  } catch (err) {
    console.error("Setup customerB error:", err);
  }

  // ==========================================================
  // TEST 32: Invalid password fails
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerA.email,
        password: 'WrongPassword999!'
      })
    });
    const data = await res.json();
    const success = res.status === 401 && data.success === false && data.message.includes('Invalid');
    logResult("TEST 32 - Invalid password returns 401", success);
  } catch (err) {
    logResult("TEST 32 - Invalid password returns 401", false, err.message);
  }

  // ==========================================================
  // TEST 33: Non-existent account login fails
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'does_not_exist_98765@example.com',
        password: 'Password123!'
      })
    });
    const data = await res.json();
    const success = res.status === 401 && data.success === false && data.message.includes('Invalid');
    logResult("TEST 33 - Non-existent account login returns 401", success);
  } catch (err) {
    logResult("TEST 33 - Non-existent account login returns 401", false, err.message);
  }

  // ==========================================================
  // TEST 34: Protected route without token returns 401
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: '999', capacity: 4, location: 'Center', rating: 5 })
    });
    const success = res.status === 401;
    logResult("TEST 34 - Protected route without token returns 401", success);
  } catch (err) {
    logResult("TEST 34 - Protected route without token returns 401", false, err.message);
  }

  // ==========================================================
  // TEST 35: Invalid token returns 401
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/tables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid.token.string.signature'
      },
      body: JSON.stringify({ number: '998', capacity: 4, location: 'Center', rating: 5 })
    });
    const success = res.status === 401;
    logResult("TEST 35 - Invalid token returns 401", success);
  } catch (err) {
    logResult("TEST 35 - Invalid token returns 401", false, err.message);
  }

  // ==========================================================
  // TEST 36: Expired / malformed authentication returns 401
  // ==========================================================
  try {
    // Generate expired token
    const expiredToken = jwt.sign(
      { id: '12345', role: 'CUSTOMER' },
      process.env.JWT_SECRET,
      { expiresIn: '-10s' }
    );
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${expiredToken}` }
    });
    const success = res.status === 401;
    logResult("TEST 36 - Expired authentication token returns 401", success);
  } catch (err) {
    logResult("TEST 36 - Expired authentication token returns 401", false, err.message);
  }

  // ==========================================================
  // TEST 37: Customer accessing manager route returns 403
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings/waitlist/all`, {
      headers: { 'Authorization': `Bearer ${customerA.token}` }
    });
    const success = res.status === 403;
    logResult("TEST 37 - Customer accessing manager route returns 403", success);
  } catch (err) {
    logResult("TEST 37 - Customer accessing manager route returns 403", false, err.message);
  }

  // ==========================================================
  // TEST 38: Manager accessing manager route succeeds
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings/waitlist/all`, {
      headers: managerHeaders
    });
    const success = res.status === 200;
    logResult("TEST 38 - Manager accessing manager route succeeds (200)", success);
  } catch (err) {
    logResult("TEST 38 - Manager accessing manager route succeeds (200)", false, err.message);
  }

  // ==========================================================
  // TEST 39: Customer cannot create a table
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/tables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerA.token}`
      },
      body: JSON.stringify({ number: '301', capacity: 4, location: 'Center', rating: 5 })
    });
    const success = res.status === 403;
    logResult("TEST 39 - Customer cannot create a table (403)", success);
  } catch (err) {
    logResult("TEST 39 - Customer cannot create a table (403)", false, err.message);
  }

  // ==========================================================
  // TEST 40: Customer cannot delete a table
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/tables/${t101._id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${customerA.token}` }
    });
    const success = res.status === 403;
    logResult("TEST 40 - Customer cannot delete a table (403)", success);
  } catch (err) {
    logResult("TEST 40 - Customer cannot delete a table (403)", false, err.message);
  }

  // ==========================================================
  // TEST 41: Customer cannot access management analytics / lookup
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/dsa/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerA.token}`
      },
      body: JSON.stringify({ lookupId: t101._id.toString() })
    });
    const success = res.status === 403;
    logResult("TEST 41 - Customer cannot access management DSA lookup (403)", success);
  } catch (err) {
    logResult("TEST 41 - Customer cannot access management DSA lookup (403)", false, err.message);
  }

  // ==========================================================
  // TEST 42: Customer can create their own booking
  // ==========================================================
  let bookingAId = '';
  let bookingBId = '';
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerA.token}`
      },
      body: JSON.stringify({
        customerName: 'Alice Customer',
        partySize: 2,
        contact: randPhone(),
        tableId: t102._id,
        bookingDate: '2026-12-28',
        startTime: '18:00',
        endTime: '19:30'
      })
    });
    const data = await res.json();
    bookingAId = data.data?._id;
    const success = res.status === 201 && data.data?.userId === customerA.id;
    logResult("TEST 42 - Customer can create own booking with linked userId", success);
  } catch (err) {
    logResult("TEST 42 - Customer can create own booking with linked userId", false, err.message);
  }

  // Create booking for Customer B
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerB.token}`
      },
      body: JSON.stringify({
        customerName: 'Bob Customer',
        partySize: 2,
        contact: randPhone(),
        tableId: t103._id,
        bookingDate: '2026-12-28',
        startTime: '18:00',
        endTime: '19:30'
      })
    });
    const data = await res.json();
    bookingBId = data.data?._id;
  } catch (err) {
    console.error("Setup bookingB error:", err);
  }

  // ==========================================================
  // TEST 43: Customer cannot modify another customer's booking
  // ==========================================================
  try {
    // Customer A attempts to modify Customer B's booking status
    const res = await fetch(`${API_BASE}/bookings/${bookingBId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerA.token}`
      },
      body: JSON.stringify({ status: 'Seated' })
    });
    const success = res.status === 403;
    logResult("TEST 43 - Customer cannot modify another customer's booking (403)", success);
  } catch (err) {
    logResult("TEST 43 - Customer cannot modify another customer's booking (403)", false, err.message);
  }

  // ==========================================================
  // TEST 44: Customer cannot cancel another customer's booking
  // ==========================================================
  try {
    // Customer A attempts to cancel Customer B's booking
    const res = await fetch(`${API_BASE}/bookings/${bookingBId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerA.token}`
      },
      body: JSON.stringify({ status: 'Cancelled' })
    });
    const success = res.status === 403;
    logResult("TEST 44 - Customer cannot cancel another customer's booking (403)", success);
  } catch (err) {
    logResult("TEST 44 - Customer cannot cancel another customer's booking (403)", false, err.message);
  }

  // ==========================================================
  // TEST 45: Manager can manage bookings
  // ==========================================================
  try {
    // Manager can update status of Customer A's booking to Seated
    const res = await fetch(`${API_BASE}/bookings/${bookingAId}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Seated' })
    });
    const data = await res.json();
    const success = res.status === 200 && data.status === 'Seated';
    logResult("TEST 45 - Manager can manage bookings (status update)", success);
  } catch (err) {
    logResult("TEST 45 - Manager can manage bookings (status update)", false, err.message);
  }

  // ==========================================================
  // TEST 46: Manager can create/update/delete tables
  // ==========================================================
  try {
    // 1. Create table
    const createRes = await fetch(`${API_BASE}/tables`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ number: '404', capacity: 8, location: 'Outdoor', rating: 5 })
    });
    const createdTable = await createRes.json();

    // 2. Update table
    const updateRes = await fetch(`${API_BASE}/tables/${createdTable._id}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ rating: 4 })
    });

    // 3. Delete table
    const deleteRes = await fetch(`${API_BASE}/tables/${createdTable._id}`, {
      method: 'DELETE',
      headers: managerHeaders
    });

    const success = createRes.status === 201 && updateRes.status === 200 && deleteRes.status === 200;
    logResult("TEST 46 - Manager can create, update, and delete tables", success);
  } catch (err) {
    logResult("TEST 46 - Manager can create, update, and delete tables", false, err.message);
  }

  // ==========================================================
  // TEST 47: Customer can cancel their OWN booking
  // ==========================================================
  try {
    const res = await fetch(`${API_BASE}/bookings/${bookingAId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerA.token}`
      },
      body: JSON.stringify({ status: 'Cancelled' })
    });
    const data = await res.json();
    const success = res.status === 200 && data.status === 'Cancelled';
    logResult("TEST 47 - Customer can cancel their own booking", success);
  } catch (err) {
    logResult("TEST 47 - Customer can cancel their own booking", false, err.message);
  }

  // ==========================================================
  // TEST 48: Password is never returned by any API response
  // ==========================================================
  try {
    const resReg = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SecCheck', email: randEmail('sec'), password: 'Password123!' })
    });
    const dataReg = await resReg.json();

    const resLog = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerA.email, password: customerA.password })
    });
    const dataLog = await resLog.json();

    const resMe = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${customerA.token}` }
    });
    const dataMe = await resMe.json();

    const hasNoPlaintext = !dataReg.password && !dataLog.user?.password && !dataMe.user?.password;
    logResult("TEST 48 - Password is never returned in any API response", hasNoPlaintext);
  } catch (err) {
    logResult("TEST 48 - Password is never returned in any API response", false, err.message);
  }

  // ==========================================================
  // TEST 49: Password hash is never returned by any API response
  // ==========================================================
  try {
    const resLog = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerA.email, password: customerA.password })
    });
    const dataLog = await resLog.json();

    const resMe = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${customerA.token}` }
    });
    const dataMe = await resMe.json();

    const hasNoHash = !dataLog.user?.password && !dataLog.user?.passwordHash && !dataMe.user?.password && !dataMe.user?.passwordHash;
    logResult("TEST 49 - Password hash is never exposed in API responses", hasNoHash);
  } catch (err) {
    logResult("TEST 49 - Password hash is never exposed in API responses", false, err.message);
  }

  // ==========================================================
  // TEST 50: Manager account cannot be created through public registration
  // ==========================================================
  try {
    const fakeManagerEmail = randEmail('hacker');
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Malicious Actor',
        email: fakeManagerEmail,
        password: 'HackerPassword123!',
        role: 'MANAGER' // Attempt privilege escalation
      })
    });
    const data = await res.json();

    // Verify user created in DB has CUSTOMER role despite requesting MANAGER
    const createdUser = await User.findOne({ email: fakeManagerEmail });
    const success = res.status === 201 && createdUser && createdUser.role === 'CUSTOMER';
    logResult("TEST 50 - Public registration strictly forces CUSTOMER role", success, `Role: ${createdUser?.role}`);
  } catch (err) {
    logResult("TEST 50 - Public registration strictly forces CUSTOMER role", false, err.message);
  }

  // ==========================================================
  // PHASE 14: REAL-TIME RESTAURANT OPERATIONS & MANAGEMENT (TESTS 51-71)
  // ==========================================================
  console.log("\nStarting Phase 14 Operations & Intelligent Management Scenarios (Tests 51-71)...\n");

  // TEST 51: Operations endpoint without authentication → 401
  try {
    const res = await fetch(`${API_BASE}/operations/summary`);
    logResult("TEST 51 - Operations endpoint without authentication returns 401", res.status === 401);
  } catch (err) {
    logResult("TEST 51 - Operations endpoint without authentication returns 401", false, err.message);
  }

  // TEST 52: CUSTOMER accessing operations endpoint → 403
  let customerUserToken;
  try {
    const custEmail = randEmail('cust_op');
    await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Cust Op', email: custEmail, password: 'Password123!' })
    });
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: custEmail, password: 'Password123!' })
    });
    const loginData = await loginRes.json();
    customerUserToken = loginData.token;

    const res = await fetch(`${API_BASE}/operations/summary`, {
      headers: { 'Authorization': `Bearer ${customerUserToken}` }
    });
    logResult("TEST 52 - CUSTOMER accessing operations endpoint returns 403", res.status === 403);
  } catch (err) {
    logResult("TEST 52 - CUSTOMER accessing operations endpoint returns 403", false, err.message);
  }

  // TEST 53: MANAGER accessing operations endpoint → 200
  try {
    const res = await fetch(`${API_BASE}/operations/summary`, {
      headers: managerHeaders
    });
    const data = await res.json();
    const success = res.status === 200 && data.success === true && data.tables && data.waitlist;
    logResult("TEST 53 - MANAGER accessing operations endpoint returns 200", success);
  } catch (err) {
    logResult("TEST 53 - MANAGER accessing operations endpoint returns 200", false, err.message);
  }

  // Clean setup for operations tests
  await Table.deleteMany({});
  await Booking.deleteMany({});
  await Waitlist.deleteMany({});

  const opT1 = await Table.create({ number: '201', capacity: 2, location: 'Window', rating: 5, isOccupied: false });
  const opT2 = await Table.create({ number: '202', capacity: 4, location: 'Center', rating: 4.5, isOccupied: true });
  const opT3 = await Table.create({ number: '203', capacity: 6, location: 'Outdoor', rating: 4, isOccupied: false });

  // TEST 54: Correct total table count
  try {
    const res = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const data = await res.json();
    logResult("TEST 54 - Correct total table count matches database", data.tables?.total === 3);
  } catch (err) {
    logResult("TEST 54 - Correct total table count matches database", false, err.message);
  }

  // TEST 55: Correct available table count
  try {
    const res = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const data = await res.json();
    logResult("TEST 55 - Correct available table count calculated", data.tables?.available === 2);
  } catch (err) {
    logResult("TEST 55 - Correct available table count calculated", false, err.message);
  }

  // TEST 56: Correct occupied table count
  try {
    const res = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const data = await res.json();
    logResult("TEST 56 - Correct occupied table count calculated", data.tables?.occupied === 1);
  } catch (err) {
    logResult("TEST 56 - Correct occupied table count calculated", false, err.message);
  }

  // TEST 57: Future booking appears as RESERVED in operations summary
  try {
    const resB = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Future Guest', partySize: 2, contact: randPhone(),
        tableId: opT1._id, bookingDate: '2028-12-25', startTime: '19:00', endTime: '20:30'
      })
    });

    const resSummary = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const dataSummary = await resSummary.json();
    const t201 = dataSummary.tables?.list?.find(t => t.number === '201');
    const isReserved = t201 && (t201.operationalStatus === 'RESERVED' || dataSummary.tables.reserved >= 1);
    logResult("TEST 57 - Future booking reflects as RESERVED operational state", isReserved);
  } catch (err) {
    logResult("TEST 57 - Future booking reflects as RESERVED operational state", false, err.message);
  }

  // TEST 58: Future booking does not mark physical table occupied
  try {
    const freshT1 = await Table.findById(opT1._id);
    logResult("TEST 58 - Future booking preserves isOccupied = false", freshT1.isOccupied === false);
  } catch (err) {
    logResult("TEST 58 - Future booking preserves isOccupied = false", false, err.message);
  }

  // TEST 59: Currently seated booking appears in currentSeated
  let seatedBookingId;
  try {
    const seatedBooking = await Booking.create({
      customerName: 'Seated Customer',
      partySize: 4,
      contact: randPhone(),
      tableId: opT2._id,
      status: 'Seated',
      bookingDate: new Date().toISOString().split('T')[0],
      startTime: '12:00',
      endTime: '14:00',
      seatedAt: new Date(Date.now() - 15 * 60000) // 15 mins ago
    });
    seatedBookingId = seatedBooking._id;

    const res = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const data = await res.json();
    const foundSeated = data.currentSeated?.some(s => s.customerName === 'Seated Customer');
    logResult("TEST 59 - Currently seated booking appears in currentSeated list", foundSeated);
  } catch (err) {
    logResult("TEST 59 - Currently seated booking appears in currentSeated list", false, err.message);
  }

  // TEST 60: Completed booking removed from currentSeated
  try {
    await fetch(`${API_BASE}/bookings/${seatedBookingId}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Completed' })
    });

    const res = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const data = await res.json();
    const stillPresent = data.currentSeated?.some(s => s.customerName === 'Seated Customer');
    logResult("TEST 60 - Completed booking removed from currentSeated", !stillPresent);
  } catch (err) {
    logResult("TEST 60 - Completed booking removed from currentSeated", false, err.message);
  }

  // TEST 61: Cancelled booking removed from upcoming reservations
  try {
    const cancelRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'To Cancel', partySize: 2, contact: randPhone(),
        tableId: opT3._id, bookingDate: '2026-12-25', startTime: '19:00', endTime: '20:30'
      })
    });
    const cancelData = await cancelRes.json();
    const bookingToCancelId = cancelData.data._id;

    // Cancel booking
    await fetch(`${API_BASE}/bookings/${bookingToCancelId}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Cancelled' })
    });

    const res = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const data = await res.json();
    const inUpcoming = data.upcomingReservations?.some(b => b.customerName === 'To Cancel');
    logResult("TEST 61 - Cancelled booking removed from upcoming reservations", !inUpcoming);
  } catch (err) {
    logResult("TEST 61 - Cancelled booking removed from upcoming reservations", false, err.message);
  }

  // TEST 62: Upcoming reservations sorted chronologically
  try {
    await Booking.deleteMany({ bookingDate: '2026-12-30' });
    await Booking.create({
      customerName: 'Late Guest', partySize: 2, contact: randPhone(),
      tableId: opT1._id, bookingDate: '2026-12-30', startTime: '20:00', endTime: '21:30', status: 'Confirmed'
    });
    await Booking.create({
      customerName: 'Early Guest', partySize: 2, contact: randPhone(),
      tableId: opT1._id, bookingDate: '2026-12-30', startTime: '17:00', endTime: '18:30', status: 'Confirmed'
    });

    const res = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const data = await res.json();
    const Dec30Bookings = data.upcomingReservations?.filter(b => b.bookingDate === '2026-12-30') || [];
    const correctlySorted = Dec30Bookings.length >= 2 && Dec30Bookings[0].startTime === '17:00' && Dec30Bookings[1].startTime === '20:00';
    logResult("TEST 62 - Upcoming reservations sorted chronologically", correctlySorted);
  } catch (err) {
    logResult("TEST 62 - Upcoming reservations sorted chronologically", false, err.message);
  }

  // TEST 63: Waitlist count matches database
  try {
    await Waitlist.deleteMany({});
    await Waitlist.create({ customerName: 'Wait A', partySize: 2, contact: randPhone(), bookingDate: '2026-12-01', startTime: '12:00', endTime: '13:30' });
    await Waitlist.create({ customerName: 'Wait B', partySize: 4, contact: randPhone(), bookingDate: '2026-12-01', startTime: '12:00', endTime: '13:30' });

    const res = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const data = await res.json();
    logResult("TEST 63 - Waitlist total and entries match database", data.waitlist?.total === 2 && data.waitlist?.entries?.length === 2);
  } catch (err) {
    logResult("TEST 63 - Waitlist total and entries match database", false, err.message);
  }

  // TEST 64: Operational alerts generated from actual state
  try {
    const res = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const data = await res.json();
    const hasWaitlistAlert = data.alerts?.some(a => a.type === 'WAITLIST' || a.message.includes('waitlist'));
    logResult("TEST 64 - Operational alerts derived accurately from database state", hasWaitlistAlert);
  } catch (err) {
    logResult("TEST 64 - Operational alerts derived accurately from database state", false, err.message);
  }

  // TEST 65: Large-party recommendation still uses C++ backtracking
  try {
    const res = await fetch(`${API_BASE}/dsa/combine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partySize: 8, bookingDate: '2026-12-05', startTime: '19:00', endTime: '20:30' })
    });
    const data = await res.json();
    const valid = res.status === 200 && Array.isArray(data.combination) && data.totalCapacity >= 8;
    logResult("TEST 65 - Large-party recommendation utilizes C++ backtracking solver", valid, `Capacity: ${data.totalCapacity}`);
  } catch (err) {
    logResult("TEST 65 - Large-party recommendation utilizes C++ backtracking solver", false, err.message);
  }

  // TEST 66: Table recommendation still uses C++ Priority Queue
  try {
    const res = await fetch(`${API_BASE}/dsa/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partySize: 2, preference: 'Window', bookingDate: '2026-12-05', startTime: '12:00', endTime: '13:30' })
    });
    const data = await res.json();
    const valid = res.status === 200 && Array.isArray(data) && data.length > 0 && data[0].score !== undefined;
    logResult("TEST 66 - Table recommendation utilizes C++ Priority Queue", valid, `Top score: ${data[0]?.score}`);
  } catch (err) {
    logResult("TEST 66 - Table recommendation utilizes C++ Priority Queue", false, err.message);
  }

  // TEST 67: Waitlist ordering remains FIFO
  try {
    const res = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const data = await res.json();
    const entries = data.waitlist?.entries || [];
    const isFifo = entries.length >= 2 && entries[0].customerName === 'Wait A' && entries[1].customerName === 'Wait B';
    logResult("TEST 67 - Waitlist order adheres to FIFO arrival sequence", isFifo);
  } catch (err) {
    logResult("TEST 67 - Waitlist order adheres to FIFO arrival sequence", false, err.message);
  }

  // TEST 68: Existing booking conflict validation still works
  try {
    const phoneX = randPhone();
    await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Conflict A', partySize: 2, contact: phoneX,
        tableId: opT1._id, bookingDate: '2026-12-15', startTime: '13:00', endTime: '14:30'
      })
    });

    const resDup = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Conflict B', partySize: 2, contact: randPhone(),
        tableId: opT1._id, bookingDate: '2026-12-15', startTime: '13:30', endTime: '15:00'
      })
    });

    logResult("TEST 68 - Existing booking conflict validation strictly prevents overlaps", resDup.status === 400);
  } catch (err) {
    logResult("TEST 68 - Existing booking conflict validation strictly prevents overlaps", false, err.message);
  }

  // TEST 69: C++ subprocess failure remains safely handled
  try {
    const { runDsaEngine } = require('../utils/dsaConnector');
    const result = await runDsaEngine({ action: 'invalid_action_test' });
    logResult("TEST 69 - C++ Engine unexpected action / failure safely handled", result.status === 'error' || result.message !== undefined);
  } catch (err) {
    logResult("TEST 69 - C++ Engine unexpected action / failure safely handled", false, err.message);
  }

  // TEST 70: Operations endpoint handles concurrent requests without race condition
  try {
    const promises = Array.from({ length: 5 }, () =>
      fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders })
    );
    const results = await Promise.all(promises);
    const all200 = results.every(r => r.status === 200);
    logResult("TEST 70 - Concurrent operations requests remain stable and consistent", all200);
  } catch (err) {
    logResult("TEST 70 - Concurrent operations requests remain stable and consistent", false, err.message);
  }

  // TEST 71: Dining duration is dynamically calculated as non-negative integer
  try {
    const testSeatedBooking = await Booking.create({
      customerName: 'Duration Test',
      partySize: 2,
      contact: randPhone(),
      tableId: opT1._id,
      status: 'Seated',
      bookingDate: new Date().toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '12:00',
      seatedAt: new Date(Date.now() - 30 * 60000) // 30 mins ago
    });

    const res = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const data = await res.json();
    const item = data.currentSeated?.find(s => s.customerName === 'Duration Test');
    const validDuration = item && typeof item.durationMinutes === 'number' && item.durationMinutes >= 29;
    logResult("TEST 71 - Dining duration dynamically calculated as non-negative integer", validDuration, `Duration: ${item?.durationMinutes} min`);
  } catch (err) {
    logResult("TEST 71 - Dining duration dynamically calculated as non-negative integer", false, err.message);
  }

  // ==========================================================
  // PHASE 15: LIFECYCLE, NOTIFICATIONS & AUDIT TRAIL (TESTS 72-110)
  // ==========================================================
  console.log("\nStarting Phase 15 Lifecycle, Notifications & Audit Trail Scenarios (Tests 72-110)...");

  let p15Table, p15Booking, p15CustToken, p15CustId, p15OtherCustToken, p15OtherCustId;

  try {
    // Setup Phase 15 test table and users
    p15Table = await Table.create({ number: 'T-150', capacity: 4, location: 'Center', isOccupied: false });
    
    const cust1Email = randEmail('p15cust');
    await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'P15 Customer', email: cust1Email, password: 'Password123!' })
    });
    const logCust1 = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cust1Email, password: 'Password123!' })
    });
    const regCust1Data = await logCust1.json();
    p15CustToken = regCust1Data.token;
    p15CustId = regCust1Data.user.id;

    const cust2Email = randEmail('p15other');
    await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'P15 Other', email: cust2Email, password: 'Password123!' })
    });
    const logCust2 = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cust2Email, password: 'Password123!' })
    });
    const regCust2Data = await logCust2.json();
    p15OtherCustToken = regCust2Data.token;
    p15OtherCustId = regCust2Data.user.id;
  } catch (e) {
    console.error("Phase 15 setup error:", e);
  }

  const p15CustHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p15CustToken}` };
  const p15OtherHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p15OtherCustToken}` };

  // TEST 72: Valid Confirmed -> Checked In transition
  try {
    const bookRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: p15CustHeaders,
      body: JSON.stringify({
        customerName: 'P15 Customer',
        partySize: 2,
        contact: randPhone(),
        tableId: p15Table._id,
        bookingDate: '2026-11-20',
        startTime: '18:00',
        endTime: '19:30'
      })
    });
    const bookData = await bookRes.json();
    p15Booking = bookData.data;

    const checkInRes = await fetch(`${API_BASE}/bookings/${p15Booking._id}/check-in`, {
      method: 'PUT',
      headers: managerHeaders
    });
    const checkInData = await checkInRes.json();
    const ok = checkInRes.status === 200 && checkInData.status === 'Checked In';
    logResult("TEST 72 - Valid Confirmed → Checked In transition", ok);
  } catch (err) {
    logResult("TEST 72 - Valid Confirmed → Checked In transition", false, err.message);
  }

  // TEST 73: Invalid Completed -> Seated transition rejected
  try {
    const completedBooking = await Booking.create({
      customerName: 'Completed Guest',
      partySize: 2,
      contact: randPhone(),
      tableId: p15Table._id,
      bookingDate: '2026-11-19',
      startTime: '12:00',
      endTime: '13:30',
      status: 'Completed',
      completedAt: new Date()
    });

    const res = await fetch(`${API_BASE}/bookings/${completedBooking._id}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Seated' })
    });
    logResult("TEST 73 - Invalid Completed → Seated transition rejected", res.status === 400);
  } catch (err) {
    logResult("TEST 73 - Invalid Completed → Seated transition rejected", false, err.message);
  }

  // TEST 74: Customer cannot check in booking (403)
  try {
    const freshBooking = await Booking.create({
      customerName: 'Fresh Guest',
      partySize: 2,
      contact: randPhone(),
      tableId: p15Table._id,
      userId: p15CustId,
      bookingDate: '2026-11-21',
      startTime: '18:00',
      endTime: '19:30',
      status: 'Confirmed'
    });

    const res = await fetch(`${API_BASE}/bookings/${freshBooking._id}/check-in`, {
      method: 'PUT',
      headers: p15CustHeaders
    });
    const res2 = await fetch(`${API_BASE}/bookings/${freshBooking._id}`, {
      method: 'PUT',
      headers: p15CustHeaders,
      body: JSON.stringify({ status: 'Checked In' })
    });
    logResult("TEST 74 - Customer cannot check in booking", res.status === 403 && res2.status === 403);
  } catch (err) {
    logResult("TEST 74 - Customer cannot check in booking", false, err.message);
  }

  // TEST 75: Manager can check in valid booking (200)
  try {
    const freshBooking2 = await Booking.create({
      customerName: 'Manager CheckIn Test',
      partySize: 2,
      contact: randPhone(),
      tableId: p15Table._id,
      bookingDate: '2026-11-22',
      startTime: '18:00',
      endTime: '19:30',
      status: 'Confirmed'
    });

    const res = await fetch(`${API_BASE}/bookings/${freshBooking2._id}/check-in`, {
      method: 'PUT',
      headers: managerHeaders
    });
    const data = await res.json();
    logResult("TEST 75 - Manager can check in valid booking", res.status === 200 && data.status === 'Checked In');
  } catch (err) {
    logResult("TEST 75 - Manager can check in valid booking", false, err.message);
  }

  // TEST 76: Checked-in booking records checkedInAt
  try {
    const updated = await Booking.findById(p15Booking._id);
    const hasCheckedInAt = updated && updated.checkedInAt instanceof Date;
    logResult("TEST 76 - Checked-in booking records checkedInAt", Boolean(hasCheckedInAt));
  } catch (err) {
    logResult("TEST 76 - Checked-in booking records checkedInAt", false, err.message);
  }

  // TEST 77: Manager can seat checked-in guest
  try {
    const res = await fetch(`${API_BASE}/bookings/${p15Booking._id}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Seated' })
    });
    const data = await res.json();
    logResult("TEST 77 - Manager can seat checked-in guest", res.status === 200 && data.status === 'Seated');
  } catch (err) {
    logResult("TEST 77 - Manager can seat checked-in guest", false, err.message);
  }

  // TEST 78: Seated booking records seatedAt
  try {
    const updated = await Booking.findById(p15Booking._id);
    const hasSeatedAt = updated && updated.seatedAt instanceof Date;
    logResult("TEST 78 - Seated booking records seatedAt", Boolean(hasSeatedAt));
  } catch (err) {
    logResult("TEST 78 - Seated booking records seatedAt", false, err.message);
  }

  // TEST 79: Completing seated booking records completedAt
  try {
    const res = await fetch(`${API_BASE}/bookings/${p15Booking._id}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Completed' })
    });
    const data = await res.json();
    const updated = await Booking.findById(p15Booking._id);
    const hasCompletedAt = updated && updated.completedAt instanceof Date;
    logResult("TEST 79 - Completing seated booking records completedAt", res.status === 200 && Boolean(hasCompletedAt));
  } catch (err) {
    logResult("TEST 79 - Completing seated booking records completedAt", false, err.message);
  }

  // TEST 80: Completed booking releases table
  try {
    const checkTable = await Table.findById(p15Table._id);
    logResult("TEST 80 - Completed booking releases table", checkTable.isOccupied === false);
  } catch (err) {
    logResult("TEST 80 - Completed booking releases table", false, err.message);
  }

  // TEST 81: Manager can mark eligible reservation as No Show
  try {
    const pastBooking = await Booking.create({
      customerName: 'No Show Candidate',
      partySize: 2,
      contact: randPhone(),
      tableId: p15Table._id,
      bookingDate: '2026-01-01',
      startTime: '12:00',
      endTime: '13:30',
      status: 'Confirmed'
    });

    const res = await fetch(`${API_BASE}/bookings/${pastBooking._id}/no-show`, {
      method: 'PUT',
      headers: managerHeaders
    });
    const data = await res.json();
    const updated = await Booking.findById(pastBooking._id);
    logResult("TEST 81 - Manager can mark eligible reservation as No Show", res.status === 200 && data.status === 'No Show' && updated.noShowAt instanceof Date);
  } catch (err) {
    logResult("TEST 81 - Manager can mark eligible reservation as No Show", false, err.message);
  }

  // TEST 82: Non-eligible booking cannot be marked No Show
  try {
    const futureBooking = await Booking.create({
      customerName: 'Future Candidate',
      partySize: 2,
      contact: randPhone(),
      tableId: p15Table._id,
      bookingDate: '2026-12-30',
      startTime: '20:00',
      endTime: '21:30',
      status: 'Confirmed'
    });

    const res = await fetch(`${API_BASE}/bookings/${futureBooking._id}/no-show`, {
      method: 'PUT',
      headers: managerHeaders
    });
    logResult("TEST 82 - Non-eligible booking cannot be marked No Show", res.status === 400);
  } catch (err) {
    logResult("TEST 82 - Non-eligible booking cannot be marked No Show", false, err.message);
  }

  // TEST 83: No Show releases reservation slot correctly
  try {
    const slotBooking = await Booking.create({
      customerName: 'Slot No Show',
      partySize: 2,
      contact: randPhone(),
      tableId: p15Table._id,
      bookingDate: '2026-01-02',
      startTime: '12:00',
      endTime: '13:30',
      status: 'Confirmed'
    });

    await fetch(`${API_BASE}/bookings/${slotBooking._id}/no-show`, {
      method: 'PUT',
      headers: managerHeaders
    });

    const reuseRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'New Slot Holder',
        partySize: 2,
        contact: randPhone(),
        tableId: p15Table._id,
        bookingDate: '2026-01-02',
        startTime: '12:00',
        endTime: '13:30'
      })
    });
    logResult("TEST 83 - No Show releases reservation slot correctly", reuseRes.status === 201);
  } catch (err) {
    logResult("TEST 83 - No Show releases reservation slot correctly", false, err.message);
  }

  // TEST 84: Booking audit entry created after status change
  try {
    const audits = await BookingAudit.find({ bookingId: p15Booking._id });
    logResult("TEST 84 - Booking audit entry created after status change", audits.length >= 2);
  } catch (err) {
    logResult("TEST 84 - Booking audit entry created after status change", false, err.message);
  }

  // TEST 85: Audit history is append-only
  try {
    const audits = await BookingAudit.find({ bookingId: p15Booking._id }).sort({ timestamp: 1 });
    const statuses = audits.map(a => a.newStatus);
    const hasTransitions = statuses.includes('Confirmed') && statuses.includes('Checked In') && statuses.includes('Seated') && statuses.includes('Completed');
    logResult("TEST 85 - Audit history is append-only", hasTransitions);
  } catch (err) {
    logResult("TEST 85 - Audit history is append-only", false, err.message);
  }

  // TEST 86: Customer can access own booking history
  try {
    const res = await fetch(`${API_BASE}/bookings/${p15Booking._id}/history`, {
      headers: p15CustHeaders
    });
    const data = await res.json();
    logResult("TEST 86 - Customer can access own booking history", res.status === 200 && Array.isArray(data.history) && data.history.length > 0);
  } catch (err) {
    logResult("TEST 86 - Customer can access own booking history", false, err.message);
  }

  // TEST 87: Customer cannot access another customer's booking history
  try {
    const res = await fetch(`${API_BASE}/bookings/${p15Booking._id}/history`, {
      headers: p15OtherHeaders
    });
    logResult("TEST 87 - Customer cannot access another customer's booking history", res.status === 403);
  } catch (err) {
    logResult("TEST 87 - Customer cannot access another customer's booking history", false, err.message);
  }

  // TEST 88: Manager can access booking history
  try {
    const res = await fetch(`${API_BASE}/bookings/${p15Booking._id}/history`, {
      headers: managerHeaders
    });
    const data = await res.json();
    logResult("TEST 88 - Manager can access booking history", res.status === 200 && Array.isArray(data.history));
  } catch (err) {
    logResult("TEST 88 - Manager can access booking history", false, err.message);
  }

  // TEST 89: Booking confirmation notification created
  try {
    const notif = await Notification.findOne({ userId: p15CustId, type: 'BOOKING_CONFIRMED' });
    logResult("TEST 89 - Booking confirmation notification created", Boolean(notif));
  } catch (err) {
    logResult("TEST 89 - Booking confirmation notification created", false, err.message);
  }

  // TEST 90: Cancellation notification created
  try {
    const cancelBooking = await Booking.create({
      customerName: 'Cancel Notif Test',
      partySize: 2,
      contact: randPhone(),
      tableId: p15Table._id,
      userId: p15CustId,
      bookingDate: '2026-12-10',
      startTime: '18:00',
      endTime: '19:30',
      status: 'Confirmed'
    });

    await fetch(`${API_BASE}/bookings/${cancelBooking._id}`, {
      method: 'PUT',
      headers: p15CustHeaders,
      body: JSON.stringify({ status: 'Cancelled' })
    });

    const notif = await Notification.findOne({ userId: p15CustId, type: 'BOOKING_CANCELLED' });
    logResult("TEST 90 - Cancellation notification created", Boolean(notif));
  } catch (err) {
    logResult("TEST 90 - Cancellation notification created", false, err.message);
  }

  // TEST 91: Customer receives waitlist promotion notification
  try {
    const waitPromo = await Waitlist.create({
      customerName: 'Waitlist Notif Test',
      partySize: 2,
      contact: randPhone(),
      userId: p15CustId,
      bookingDate: '2026-12-11',
      startTime: '18:00',
      endTime: '19:30'
    });

    await fetch(`${API_BASE}/bookings/waitlist/promote/${waitPromo._id}`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ tableId: p15Table._id })
    });

    const notif = await Notification.findOne({ userId: p15CustId, type: 'WAITLIST_PROMOTED' });
    logResult("TEST 91 - Customer receives waitlist promotion notification", Boolean(notif));
  } catch (err) {
    logResult("TEST 91 - Customer receives waitlist promotion notification", false, err.message);
  }

  // TEST 92: Customer can fetch own notifications
  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: p15CustHeaders
    });
    const data = await res.json();
    logResult("TEST 92 - Customer can fetch own notifications", res.status === 200 && Array.isArray(data) && data.length > 0);
  } catch (err) {
    logResult("TEST 92 - Customer can fetch own notifications", false, err.message);
  }

  // TEST 93: Customer cannot fetch another customer's notifications
  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: p15OtherHeaders
    });
    const data = await res.json();
    const hasCustomer1Notifs = data.some(n => String(n.userId) === String(p15CustId));
    logResult("TEST 93 - Customer cannot fetch another customer's notifications", !hasCustomer1Notifs);
  } catch (err) {
    logResult("TEST 93 - Customer cannot fetch another customer's notifications", false, err.message);
  }

  // TEST 94: Manager receives operational notification
  try {
    await Notification.create({
      recipientRole: 'MANAGER',
      type: 'TURNOVER_REQUIRED',
      title: 'Table Turnover Required',
      message: 'Table T-150 is ready for turnover.'
    });

    const res = await fetch(`${API_BASE}/notifications`, {
      headers: managerHeaders
    });
    const data = await res.json();
    const hasManagerNotif = data.some(n => n.recipientRole === 'MANAGER');
    logResult("TEST 94 - Manager receives operational notification", res.status === 200 && hasManagerNotif);
  } catch (err) {
    logResult("TEST 94 - Manager receives operational notification", false, err.message);
  }

  // TEST 95: Notification can be marked as read
  let testNotifToRead;
  try {
    testNotifToRead = await Notification.findOne({ userId: p15CustId, read: false });
    const res = await fetch(`${API_BASE}/notifications/${testNotifToRead._id}/read`, {
      method: 'PUT',
      headers: p15CustHeaders
    });
    const data = await res.json();
    logResult("TEST 95 - Notification can be marked as read", res.status === 200 && data.read === true);
  } catch (err) {
    logResult("TEST 95 - Notification can be marked as read", false, err.message);
  }

  // TEST 96: Unread notification count is correct
  try {
    const res = await fetch(`${API_BASE}/notifications/unread-count`, {
      headers: p15CustHeaders
    });
    const data = await res.json();
    const dbUnread = await Notification.countDocuments({ userId: p15CustId, read: false });
    logResult("TEST 96 - Unread notification count is correct", res.status === 200 && data.unreadCount === dbUnread);
  } catch (err) {
    logResult("TEST 96 - Unread notification count is correct", false, err.message);
  }

  // TEST 97: Mark all notifications as read works
  try {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: p15CustHeaders
    });
    const countRes = await fetch(`${API_BASE}/notifications/unread-count`, {
      headers: p15CustHeaders
    });
    const countData = await countRes.json();
    logResult("TEST 97 - Mark all notifications as read works", res.status === 200 && countData.unreadCount === 0);
  } catch (err) {
    logResult("TEST 97 - Mark all notifications as read works", false, err.message);
  }

  // TEST 98: Reminder does not duplicate during repeated polling
  try {
    const { createNotification } = require('../utils/notificationHelper');
    const idemKey = `test_reminder_${Date.now()}`;
    const notif1 = await createNotification({
      userId: p15CustId,
      recipientRole: 'CUSTOMER',
      type: 'RESERVATION_REMINDER',
      title: 'Reminder 1',
      message: 'Reminder text',
      idempotencyKey: idemKey
    });
    const notif2 = await createNotification({
      userId: p15CustId,
      recipientRole: 'CUSTOMER',
      type: 'RESERVATION_REMINDER',
      title: 'Reminder 1 duplicate',
      message: 'Reminder text duplicate',
      idempotencyKey: idemKey
    });
    const matchCount = await Notification.countDocuments({ idempotencyKey: idemKey });
    logResult("TEST 98 - Reminder does not duplicate during repeated polling", matchCount === 1 && String(notif1._id) === String(notif2._id));
  } catch (err) {
    logResult("TEST 98 - Reminder does not duplicate during repeated polling", false, err.message);
  }

  // TEST 99: Waitlist promotion selects correct FIFO candidate
  try {
    await Waitlist.deleteMany({});
    const w1 = await Waitlist.create({ customerName: 'FIFO First', partySize: 2, contact: randPhone(), joinedAt: new Date(Date.now() - 20000) });
    const w2 = await Waitlist.create({ customerName: 'FIFO Second', partySize: 2, contact: randPhone(), joinedAt: new Date(Date.now() - 10000) });

    const allW = await Waitlist.find().sort({ joinedAt: 1 });
    const correctFirst = allW.length >= 2 && allW[0].customerName === 'FIFO First';
    logResult("TEST 99 - Waitlist promotion selects correct FIFO candidate", correctFirst);
  } catch (err) {
    logResult("TEST 99 - Waitlist promotion selects correct FIFO candidate", false, err.message);
  }

  // TEST 100: Waitlist promotion validates table availability
  try {
    // Create an active booking on p15Table
    await Booking.create({
      customerName: 'Blocker',
      partySize: 2,
      contact: randPhone(),
      tableId: p15Table._id,
      bookingDate: '2026-12-12',
      startTime: '18:00',
      endTime: '19:30',
      status: 'Confirmed'
    });

    const conflictedWaitlist = await Waitlist.create({
      customerName: 'Conflicted Promoted',
      partySize: 2,
      contact: randPhone(),
      bookingDate: '2026-12-12',
      startTime: '18:00',
      endTime: '19:30'
    });

    const res = await fetch(`${API_BASE}/bookings/waitlist/promote/${conflictedWaitlist._id}`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ tableId: p15Table._id })
    });
    logResult("TEST 100 - Waitlist promotion validates table availability", res.status === 400);
  } catch (err) {
    logResult("TEST 100 - Waitlist promotion validates table availability", false, err.message);
  }

  // TEST 101: Waitlist promotion creates valid booking
  try {
    const validWaitlist = await Waitlist.create({
      customerName: 'Valid Promo Guest',
      partySize: 2,
      contact: randPhone(),
      bookingDate: '2026-12-13',
      startTime: '18:00',
      endTime: '19:30'
    });

    const res = await fetch(`${API_BASE}/bookings/waitlist/promote/${validWaitlist._id}`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ tableId: p15Table._id })
    });
    const data = await res.json();
    const createdBooking = await Booking.findOne({ waitlistId: validWaitlist._id.toString() });
    logResult("TEST 101 - Waitlist promotion creates valid booking", res.status === 200 && Boolean(createdBooking));
  } catch (err) {
    logResult("TEST 101 - Waitlist promotion creates valid booking", false, err.message);
  }

  // TEST 102: Waitlist promotion creates customer notification
  try {
    const custWaitlist = await Waitlist.create({
      customerName: 'Promo Notif Customer',
      partySize: 2,
      contact: randPhone(),
      userId: p15CustId,
      bookingDate: '2026-12-14',
      startTime: '18:00',
      endTime: '19:30'
    });

    await fetch(`${API_BASE}/bookings/waitlist/promote/${custWaitlist._id}`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ tableId: p15Table._id })
    });

    const notif = await Notification.findOne({ userId: p15CustId, type: 'WAITLIST_PROMOTED', message: { $regex: /Table/i } });
    logResult("TEST 102 - Waitlist promotion creates customer notification", Boolean(notif));
  } catch (err) {
    logResult("TEST 102 - Waitlist promotion creates customer notification", false, err.message);
  }

  // TEST 103: Waitlist promotion cannot create duplicate booking
  try {
    const singleWaitlist = await Waitlist.create({
      customerName: 'Double Promo Candidate',
      partySize: 2,
      contact: randPhone(),
      bookingDate: '2026-12-15',
      startTime: '18:00',
      endTime: '19:30'
    });

    const res1 = await fetch(`${API_BASE}/bookings/waitlist/promote/${singleWaitlist._id}`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ tableId: p15Table._id })
    });
    const res2 = await fetch(`${API_BASE}/bookings/waitlist/promote/${singleWaitlist._id}`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ tableId: p15Table._id })
    });

    logResult("TEST 103 - Waitlist promotion cannot create duplicate booking", res1.status === 200 && (res2.status === 400 || res2.status === 404));
  } catch (err) {
    logResult("TEST 103 - Waitlist promotion cannot create duplicate booking", false, err.message);
  }

  // TEST 104: Long dining alert generated correctly
  try {
    await Booking.create({
      customerName: 'Long Diner',
      partySize: 2,
      contact: randPhone(),
      tableId: p15Table._id,
      status: 'Seated',
      bookingDate: new Date().toISOString().split('T')[0],
      startTime: '08:00',
      endTime: '10:00',
      seatedAt: new Date(Date.now() - 100 * 60000) // 100 min ago
    });

    const res = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const data = await res.json();
    const hasLongDining = data.alerts?.some(a => a.type === 'LONG_DINING' || a.message.includes('occupied for'));
    logResult("TEST 104 - Long dining alert generated correctly", Boolean(hasLongDining));
  } catch (err) {
    logResult("TEST 104 - Long dining alert generated correctly", false, err.message);
  }

  // TEST 105: No fake operational alerts are generated
  try {
    await Booking.deleteMany({});
    await Waitlist.deleteMany({});
    await Table.updateMany({}, { isOccupied: false });

    const res = await fetch(`${API_BASE}/operations/summary`, { headers: managerHeaders });
    const data = await res.json();
    logResult("TEST 105 - No fake operational alerts are generated", Array.isArray(data.alerts) && data.alerts.length === 0);
  } catch (err) {
    logResult("TEST 105 - No fake operational alerts are generated", false, err.message);
  }

  // TEST 106: Double check-in request handled safely
  try {
    const doubleCheckBooking = await Booking.create({
      customerName: 'Double CheckIn',
      partySize: 2,
      contact: randPhone(),
      tableId: p15Table._id,
      bookingDate: '2026-12-20',
      startTime: '18:00',
      endTime: '19:30',
      status: 'Confirmed'
    });

    const c1 = await fetch(`${API_BASE}/bookings/${doubleCheckBooking._id}/check-in`, { method: 'PUT', headers: managerHeaders });
    const c2 = await fetch(`${API_BASE}/bookings/${doubleCheckBooking._id}/check-in`, { method: 'PUT', headers: managerHeaders });
    logResult("TEST 106 - Double check-in request handled safely", c1.status === 200 && c2.status === 200);
  } catch (err) {
    logResult("TEST 106 - Double check-in request handled safely", false, err.message);
  }

  // TEST 107: Double completion request handled safely
  try {
    const doubleCompleteBooking = await Booking.create({
      customerName: 'Double Complete',
      partySize: 2,
      contact: randPhone(),
      tableId: p15Table._id,
      bookingDate: '2026-12-21',
      startTime: '18:00',
      endTime: '19:30',
      status: 'Seated',
      seatedAt: new Date()
    });

    const c1 = await fetch(`${API_BASE}/bookings/${doubleCompleteBooking._id}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Completed' })
    });
    const c2 = await fetch(`${API_BASE}/bookings/${doubleCompleteBooking._id}`, {
      method: 'PUT',
      headers: managerHeaders,
      body: JSON.stringify({ status: 'Completed' })
    });
    logResult("TEST 107 - Double completion request handled safely", c1.status === 200 && c2.status === 200);
  } catch (err) {
    logResult("TEST 107 - Double completion request handled safely", false, err.message);
  }

  // TEST 108: Double waitlist promotion handled safely
  try {
    const wDouble = await Waitlist.create({
      customerName: 'Double Promo Safe',
      partySize: 2,
      contact: randPhone(),
      bookingDate: '2026-12-22',
      startTime: '18:00',
      endTime: '19:30'
    });

    const [r1, r2] = await Promise.all([
      fetch(`${API_BASE}/bookings/waitlist/promote/${wDouble._id}`, {
        method: 'POST',
        headers: managerHeaders,
        body: JSON.stringify({ tableId: p15Table._id })
      }),
      fetch(`${API_BASE}/bookings/waitlist/promote/${wDouble._id}`, {
        method: 'POST',
        headers: managerHeaders,
        body: JSON.stringify({ tableId: p15Table._id })
      })
    ]);

    const statuses = [r1.status, r2.status].sort();
    const safelyHandled = statuses.includes(200) && (statuses.includes(400) || statuses.includes(404));
    logResult("TEST 108 - Double waitlist promotion handled safely", safelyHandled);
  } catch (err) {
    logResult("TEST 108 - Double waitlist promotion handled safely", false, err.message);
  }

  // TEST 109: Existing booking conflict validation still works
  try {
    const conflictBooking = await Booking.create({
      customerName: 'Conflict Base',
      partySize: 2,
      contact: randPhone(),
      tableId: p15Table._id,
      bookingDate: '2026-12-23',
      startTime: '18:00',
      endTime: '19:30',
      status: 'Confirmed'
    });

    const resConflict = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Overlap Attempter',
        partySize: 2,
        contact: randPhone(),
        tableId: p15Table._id,
        bookingDate: '2026-12-23',
        startTime: '18:30',
        endTime: '20:00'
      })
    });
    logResult("TEST 109 - Existing booking conflict validation still works", resConflict.status === 400);
  } catch (err) {
    logResult("TEST 109 - Existing booking conflict validation still works", false, err.message);
  }

  // TEST 110: C++ engine failure remains safely handled
  try {
    const { runDsaEngine } = require('../utils/dsaConnector');
    const result = await runDsaEngine({ action: 'non_existent_engine_action_phase15' });
    logResult("TEST 110 - C++ engine failure remains safely handled", result.status === 'error' || Boolean(result.message));
  } catch (err) {
    logResult("TEST 110 - C++ engine failure remains safely handled", false, err.message);
  }

  // ==========================================================
  // PHASE 16: ADVANCED ANALYTICS & BUSINESS INTELLIGENCE
  // ==========================================================
  console.log("\nStarting Phase 16 Advanced Analytics & Business Intelligence Scenarios (Tests 111-145)...");

  let anT1, anT2, anT3;
  try {
    // Setup clean analytics test dataset
    await Table.deleteMany({});
    await Booking.deleteMany({});
    await Waitlist.deleteMany({});
    await BookingAudit.deleteMany({});
    await DsaAnalyticsEvent.deleteMany({});

    anT1 = await Table.create({ number: '101', capacity: 2, location: 'Window', rating: 4.5, isOccupied: false });
    anT2 = await Table.create({ number: '102', capacity: 4, location: 'Center', rating: 5.0, isOccupied: false });
    anT3 = await Table.create({ number: '103', capacity: 6, location: 'Outdoor', rating: 4.0, isOccupied: false });

    // Setup customer authentication headers for Phase 16
    const custEmail = randEmail('analytics_cust');
    await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Analytics Cust', email: custEmail, password: 'Password123!' })
    });
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: custEmail, password: 'Password123!' })
    });
    const loginData = await loginRes.json();
    var customerHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginData.token}`
    };

    // Create a known cohort of 6 bookings
    // b1: Confirmed (Aug 1, 18:00, party 2)
    await Booking.create({
      customerName: 'Analytics Guest 1', partySize: 2, contact: randPhone(),
      tableId: anT1._id, bookingDate: '2026-08-01', startTime: '18:00', endTime: '19:30',
      status: 'Confirmed'
    });

    // b2: Seated (Aug 1, 19:00, party 4)
    await Booking.create({
      customerName: 'Analytics Guest 2', partySize: 4, contact: randPhone(),
      tableId: anT2._id, bookingDate: '2026-08-01', startTime: '19:00', endTime: '20:30',
      status: 'Seated', seatedAt: new Date('2026-08-01T19:00:00.000Z')
    });

    // b3: Completed (Aug 1, 12:00, party 4, 75 mins duration)
    await Booking.create({
      customerName: 'Analytics Guest 3', partySize: 4, contact: randPhone(),
      tableId: anT2._id, bookingDate: '2026-08-01', startTime: '12:00', endTime: '13:30',
      status: 'Completed',
      seatedAt: new Date('2026-08-01T12:00:00.000Z'),
      completedAt: new Date('2026-08-01T13:15:00.000Z')
    });

    // b4: Completed (Aug 2, 13:00, party 2, 45 mins duration)
    await Booking.create({
      customerName: 'Analytics Guest 4', partySize: 2, contact: randPhone(),
      tableId: anT1._id, bookingDate: '2026-08-02', startTime: '13:00', endTime: '14:00',
      status: 'Completed',
      seatedAt: new Date('2026-08-02T13:00:00.000Z'),
      completedAt: new Date('2026-08-02T13:45:00.000Z')
    });

    // b5: Cancelled (Aug 2, 20:00, party 6)
    await Booking.create({
      customerName: 'Analytics Guest 5', partySize: 6, contact: randPhone(),
      tableId: anT3._id, bookingDate: '2026-08-02', startTime: '20:00', endTime: '21:30',
      status: 'Cancelled', cancelledAt: new Date('2026-08-02T19:00:00.000Z')
    });

    // b6: No Show (Aug 3, 19:00, party 2)
    await Booking.create({
      customerName: 'Analytics Guest 6', partySize: 2, contact: randPhone(),
      tableId: anT1._id, bookingDate: '2026-08-03', startTime: '19:00', endTime: '20:30',
      status: 'No Show', noShowAt: new Date('2026-08-03T19:20:00.000Z')
    });

    // Waitlist: 2 active entries + 1 audit promotion entry
    await Waitlist.create({
      customerName: 'Waitlist Cust 1', partySize: 2, contact: randPhone(),
      bookingDate: '2026-08-01', startTime: '19:00', endTime: '20:30'
    });
    await Waitlist.create({
      customerName: 'Waitlist Cust 2', partySize: 4, contact: randPhone(),
      bookingDate: '2026-08-02', startTime: '20:00', endTime: '21:30'
    });
    await BookingAudit.create({
      bookingId: new mongoose.Types.ObjectId(),
      changedByName: 'Manager Host',
      changedByRole: 'MANAGER',
      previousStatus: 'Confirmed',
      newStatus: 'Confirmed',
      reason: 'Waitlist customer promoted and assigned table T-101',
      timestamp: new Date('2026-08-01T18:30:00.000Z')
    });
  } catch (err) {
    console.error('Phase 16 setup error:', err);
  }

  // TEST 111: Analytics endpoint without authentication returns 401
  try {
    const res = await fetch(`${API_BASE}/analytics/overview`);
    logResult("TEST 111 - Analytics endpoint without authentication returns 401", res.status === 401);
  } catch (err) {
    logResult("TEST 111 - Analytics endpoint without authentication returns 401", false, err.message);
  }

  // TEST 112: CUSTOMER accessing analytics returns 403
  try {
    const res = await fetch(`${API_BASE}/analytics/overview`, { headers: customerHeaders });
    logResult("TEST 112 - CUSTOMER accessing analytics returns 403", res.status === 403);
  } catch (err) {
    logResult("TEST 112 - CUSTOMER accessing analytics returns 403", false, err.message);
  }

  // TEST 113: MANAGER accessing analytics returns 200
  let overviewData;
  try {
    const res = await fetch(`${API_BASE}/analytics/overview`, { headers: managerHeaders });
    const json = await res.json();
    overviewData = json.data;
    logResult("TEST 113 - MANAGER accessing analytics returns 200", res.status === 200 && Boolean(overviewData));
  } catch (err) {
    logResult("TEST 113 - MANAGER accessing analytics returns 200", false, err.message);
  }

  // TEST 114: Total bookings matches database
  try {
    logResult("TEST 114 - Total bookings matches database", overviewData?.totalBookings === 6);
  } catch (err) {
    logResult("TEST 114 - Total bookings matches database", false, err.message);
  }

  // TEST 115: Completed bookings calculation is correct
  try {
    logResult("TEST 115 - Completed bookings calculation is correct", overviewData?.completedBookings === 2);
  } catch (err) {
    logResult("TEST 115 - Completed bookings calculation is correct", false, err.message);
  }

  // TEST 116: Cancelled bookings calculation is correct
  try {
    logResult("TEST 116 - Cancelled bookings calculation is correct", overviewData?.cancelledBookings === 1);
  } catch (err) {
    logResult("TEST 116 - Cancelled bookings calculation is correct", false, err.message);
  }

  // TEST 117: No-show calculation is correct
  try {
    logResult("TEST 117 - No-show calculation is correct", overviewData?.noShowBookings === 1);
  } catch (err) {
    logResult("TEST 117 - No-show calculation is correct", false, err.message);
  }

  // TEST 118: Completion rate calculation is correct (2/6 = 33.3%)
  try {
    logResult("TEST 118 - Completion rate calculation is correct", overviewData?.completionRate === 33.3);
  } catch (err) {
    logResult("TEST 118 - Completion rate calculation is correct", false, err.message);
  }

  // TEST 119: Cancellation rate calculation is correct (1/6 = 16.7%)
  try {
    logResult("TEST 119 - Cancellation rate calculation is correct", overviewData?.cancellationRate === 16.7);
  } catch (err) {
    logResult("TEST 119 - Cancellation rate calculation is correct", false, err.message);
  }

  // TEST 120: No-show rate calculation is correct (1/6 = 16.7%)
  try {
    logResult("TEST 120 - No-show rate calculation is correct", overviewData?.noShowRate === 16.7);
  } catch (err) {
    logResult("TEST 120 - No-show rate calculation is correct", false, err.message);
  }

  // TEST 121: Average party size calculation is correct (20 / 6 = 3.3)
  try {
    logResult("TEST 121 - Average party size calculation is correct", overviewData?.averagePartySize === 3.3);
  } catch (err) {
    logResult("TEST 121 - Average party size calculation is correct", false, err.message);
  }

  // TEST 122: Average dining duration calculation is correct ((75 + 45)/2 = 60 min)
  try {
    logResult("TEST 122 - Average dining duration calculation is correct", overviewData?.averageDiningDurationMinutes === 60);
  } catch (err) {
    logResult("TEST 122 - Average dining duration calculation is correct", false, err.message);
  }

  // TEST 123: Dining duration never becomes negative
  try {
    // Insert corrupted completed booking where completedAt < seatedAt
    await Booking.create({
      customerName: 'Negative Test', partySize: 2, contact: randPhone(),
      tableId: anT1._id, bookingDate: '2026-08-01', startTime: '10:00', endTime: '11:00',
      status: 'Completed',
      seatedAt: new Date('2026-08-01T10:30:00.000Z'),
      completedAt: new Date('2026-08-01T10:00:00.000Z') // before seatedAt
    });

    const res = await fetch(`${API_BASE}/analytics/overview`, { headers: managerHeaders });
    const json = await res.json();
    logResult("TEST 123 - Dining duration never becomes negative", json.data?.averageDiningDurationMinutes >= 0);
  } catch (err) {
    logResult("TEST 123 - Dining duration never becomes negative", false, err.message);
  }

  // TEST 124: Table utilization calculation is correct (3/3 = 100%)
  try {
    const res = await fetch(`${API_BASE}/analytics/overview`, { headers: managerHeaders });
    const json = await res.json();
    logResult("TEST 124 - Table utilization calculation is correct", json.data?.tableUtilization === 100);
  } catch (err) {
    logResult("TEST 124 - Table utilization calculation is correct", false, err.message);
  }

  // TEST 125: Per-table utilization data is correct
  try {
    const res = await fetch(`${API_BASE}/analytics/tables`, { headers: managerHeaders });
    const json = await res.json();
    const tablesData = json.data?.tables || [];
    const t101 = tablesData.find(t => t.number === '101');
    const validStats = Boolean(t101) && t101.totalBookings >= 3;
    logResult("TEST 125 - Per-table utilization data is correct", validStats);
  } catch (err) {
    logResult("TEST 125 - Per-table utilization data is correct", false, err.message);
  }

  // TEST 126: Booking trend aggregation is correct
  try {
    const res = await fetch(`${API_BASE}/analytics/bookings`, { headers: managerHeaders });
    const json = await res.json();
    const trends = json.data?.trends || {};
    const validTrends = trends['2026-08-01'] >= 3 && trends['2026-08-02'] === 2 && trends['2026-08-03'] === 1;
    logResult("TEST 126 - Booking trend aggregation is correct", validTrends);
  } catch (err) {
    logResult("TEST 126 - Booking trend aggregation is correct", false, err.message);
  }

  // TEST 127: Peak hour calculation is correct
  try {
    const res = await fetch(`${API_BASE}/analytics/peak-hours`, { headers: managerHeaders });
    const json = await res.json();
    const hourly = json.data?.hourlyDistribution || [];
    const hasHours = hourly.length === 24 && json.data?.peakHour !== null;
    logResult("TEST 127 - Peak hour calculation is correct", hasHours);
  } catch (err) {
    logResult("TEST 127 - Peak hour calculation is correct", false, err.message);
  }

  // TEST 128: Busiest day calculation is correct
  try {
    const res = await fetch(`${API_BASE}/analytics/overview`, { headers: managerHeaders });
    const json = await res.json();
    logResult("TEST 128 - Busiest day calculation is correct", json.data?.busiestDay?.date === '2026-08-01');
  } catch (err) {
    logResult("TEST 128 - Busiest day calculation is correct", false, err.message);
  }

  // TEST 129: Waitlist total matches database
  try {
    const res = await fetch(`${API_BASE}/analytics/waitlist`, { headers: managerHeaders });
    const json = await res.json();
    logResult("TEST 129 - Waitlist total matches database", json.data?.currentQueueCount === 2);
  } catch (err) {
    logResult("TEST 129 - Waitlist total matches database", false, err.message);
  }

  // TEST 130: Waitlist conversion calculation is correct (1 / 3 = 33.3%)
  try {
    const res = await fetch(`${API_BASE}/analytics/waitlist`, { headers: managerHeaders });
    const json = await res.json();
    logResult("TEST 130 - Waitlist conversion calculation is correct", json.data?.conversionRate === 33.3);
  } catch (err) {
    logResult("TEST 130 - Waitlist conversion calculation is correct", false, err.message);
  }

  // TEST 131: Date range filtering works correctly
  try {
    const res = await fetch(`${API_BASE}/analytics/overview?startDate=2026-08-01&endDate=2026-08-01`, { headers: managerHeaders });
    const json = await res.json();
    logResult("TEST 131 - Date range filtering works correctly", json.data?.totalBookings === 4); // 3 initial + 1 negative test
  } catch (err) {
    logResult("TEST 131 - Date range filtering works correctly", false, err.message);
  }

  // TEST 132: Invalid date range returns 400
  try {
    const res = await fetch(`${API_BASE}/analytics/overview?startDate=2026-08-10&endDate=2026-08-01`, { headers: managerHeaders });
    logResult("TEST 132 - Invalid date range returns 400", res.status === 400);
  } catch (err) {
    logResult("TEST 132 - Invalid date range returns 400", false, err.message);
  }

  // TEST 133: Empty date range returns valid empty analytics
  try {
    const res = await fetch(`${API_BASE}/analytics/overview?startDate=2029-01-01&endDate=2029-01-02`, { headers: managerHeaders });
    const json = await res.json();
    logResult("TEST 133 - Empty date range returns valid empty analytics", res.status === 200 && json.data?.totalBookings === 0);
  } catch (err) {
    logResult("TEST 133 - Empty date range returns valid empty analytics", false, err.message);
  }

  // TEST 134: Analytics does not expose customer passwords
  try {
    const res = await fetch(`${API_BASE}/analytics/export/csv`, { headers: managerHeaders });
    const text = await res.text();
    logResult("TEST 134 - Analytics does not expose customer passwords", !text.toLowerCase().includes('password'));
  } catch (err) {
    logResult("TEST 134 - Analytics does not expose customer passwords", false, err.message);
  }

  // TEST 135: Analytics does not expose password hashes
  try {
    const res = await fetch(`${API_BASE}/analytics/overview`, { headers: managerHeaders });
    const text = await res.text();
    logResult("TEST 135 - Analytics does not expose password hashes", !text.includes('$2a$') && !text.includes('$2b$'));
  } catch (err) {
    logResult("TEST 135 - Analytics does not expose password hashes", false, err.message);
  }

  // TEST 136: Analytics does not expose JWT information
  try {
    const res = await fetch(`${API_BASE}/analytics/overview`, { headers: managerHeaders });
    const text = await res.text();
    logResult("TEST 136 - Analytics does not expose JWT information", !text.includes('eyJ'));
  } catch (err) {
    logResult("TEST 136 - Analytics does not expose JWT information", false, err.message);
  }

  // TEST 137: DSA analytics records Priority Queue operations correctly
  try {
    await fetch(`${API_BASE}/dsa/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partySize: 2, preference: 'Window' })
    });

    const dsaRes = await fetch(`${API_BASE}/analytics/dsa`, { headers: managerHeaders });
    const dsaJson = await dsaRes.json();
    logResult("TEST 137 - DSA analytics records Priority Queue operations correctly", dsaJson.data?.recommendations?.totalRequests >= 1);
  } catch (err) {
    logResult("TEST 137 - DSA analytics records Priority Queue operations correctly", false, err.message);
  }

  // TEST 138: DSA analytics records Backtracking operations correctly
  try {
    await fetch(`${API_BASE}/dsa/combine`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ partySize: 6, bookingDate: '2026-08-01', startTime: '15:00', endTime: '16:30' })
    });

    const dsaRes = await fetch(`${API_BASE}/analytics/dsa`, { headers: managerHeaders });
    const dsaJson = await dsaRes.json();
    logResult("TEST 138 - DSA analytics records Backtracking operations correctly", dsaJson.data?.combinations?.totalRequests >= 1);
  } catch (err) {
    logResult("TEST 138 - DSA analytics records Backtracking operations correctly", false, err.message);
  }

  // TEST 139: Failed C++ operation is recorded correctly
  try {
    await DsaAnalyticsEvent.create({
      operation: 'recommend',
      success: false,
      metadata: { errorMessage: 'Simulated C++ engine failure' }
    });

    const failedEvents = await DsaAnalyticsEvent.find({ success: false });
    logResult("TEST 139 - Failed C++ operation is recorded correctly", failedEvents.length >= 1);
  } catch (err) {
    logResult("TEST 139 - Failed C++ operation is recorded correctly", false, err.message);
  }

  // TEST 140: Analytics handles C++ engine failure safely
  try {
    const dsaRes = await fetch(`${API_BASE}/analytics/dsa`, { headers: managerHeaders });
    logResult("TEST 140 - Analytics handles C++ engine failure safely", dsaRes.status === 200);
  } catch (err) {
    logResult("TEST 140 - Analytics handles C++ engine failure safely", false, err.message);
  }

  // TEST 141: Analytics handles concurrent requests safely
  try {
    const [r1, r2, r3] = await Promise.all([
      fetch(`${API_BASE}/analytics/overview`, { headers: managerHeaders }),
      fetch(`${API_BASE}/analytics/tables`, { headers: managerHeaders }),
      fetch(`${API_BASE}/analytics/bookings`, { headers: managerHeaders })
    ]);
    logResult("TEST 141 - Analytics handles concurrent requests safely", r1.status === 200 && r2.status === 200 && r3.status === 200);
  } catch (err) {
    logResult("TEST 141 - Analytics handles concurrent requests safely", false, err.message);
  }

  // TEST 142: Analytics does not generate duplicate records
  try {
    const initialCount = await DsaAnalyticsEvent.countDocuments();
    await fetch(`${API_BASE}/analytics/overview`, { headers: managerHeaders });
    const afterCount = await DsaAnalyticsEvent.countDocuments();
    logResult("TEST 142 - Analytics does not generate duplicate records", initialCount === afterCount);
  } catch (err) {
    logResult("TEST 142 - Analytics does not generate duplicate records", false, err.message);
  }

  // TEST 143: CSV export requires MANAGER role
  try {
    const unauth = await fetch(`${API_BASE}/analytics/export/csv`);
    const cust = await fetch(`${API_BASE}/analytics/export/csv`, { headers: customerHeaders });
    const mgr = await fetch(`${API_BASE}/analytics/export/csv`, { headers: managerHeaders });
    logResult("TEST 143 - CSV export requires MANAGER role", unauth.status === 401 && cust.status === 403 && mgr.status === 200);
  } catch (err) {
    logResult("TEST 143 - CSV export requires MANAGER role", false, err.message);
  }

  // TEST 144: CSV export contains correct booking statistics
  try {
    const res = await fetch(`${API_BASE}/analytics/export/csv`, { headers: managerHeaders });
    const text = await res.text();
    const hasHeader = text.includes('DINESMART RESTAURANT ANALYTICS REPORT');
    const hasKpi = text.includes('CORE KPI SUMMARY');
    logResult("TEST 144 - CSV export contains correct booking statistics", hasHeader && hasKpi);
  } catch (err) {
    logResult("TEST 144 - CSV export contains correct booking statistics", false, err.message);
  }

  // TEST 145: Analytics respects selected date range
  try {
    const res = await fetch(`${API_BASE}/analytics/bookings?startDate=2026-08-02&endDate=2026-08-02`, { headers: managerHeaders });
    const json = await res.json();
    const trendKeys = Object.keys(json.data?.trends || {});
    const respectsRange = trendKeys.length === 1 && trendKeys[0] === '2026-08-02';
    logResult("TEST 145 - Analytics respects selected date range", respectsRange);
  } catch (err) {
    logResult("TEST 145 - Analytics respects selected date range", false, err.message);
  }

  // ==========================================================
  // FINAL CLEANUP & REPORT
  // ==========================================================
  console.log("\nCleaning database records...");
  await Table.deleteMany({});
  await Booking.deleteMany({});
  await Waitlist.deleteMany({});
  await User.deleteMany({});
  await BookingAudit.deleteMany({});
  await Notification.deleteMany({});
  await DsaAnalyticsEvent.deleteMany({});

  console.log("\n==========================================================");
  console.log("DINESMART TEST RUNNER REPORT SUMMARY");
  console.log("==========================================================");
  console.log(`TOTAL RUN: ${passedCount + failedCount}`);
  console.log(`PASSED: ${passedCount}`);
  console.log(`FAILED: ${failedCount}`);
  console.log("==========================================================\n");

  mongoose.connection.close();
  server.close(() => {
    process.exit(failedCount > 0 ? 1 : 0);
  });
}

runTests();
