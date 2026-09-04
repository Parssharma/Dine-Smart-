import { classifyTableReservations } from './reservationClassification.js';

function runClassificationTests() {
  console.log('Starting Reservation State Classification Unit Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(title, condition, detail = '') {
    if (condition) {
      console.log(`  ✓ ${title}`);
      passed++;
    } else {
      console.error(`  ✗ ${title} - FAIL ${detail}`);
      failed++;
    }
  }

  const mockTable = {
    _id: 'tbl_101',
    number: '101',
    capacity: 4,
    location: 'Center',
    rating: 4.8,
    isOccupied: false
  };

  const refDate = new Date('2026-08-27T12:00:00Z');

  // Test 1: Confirmed future booking appears in upcoming reservations
  const futureBooking = {
    _id: 'b_future',
    tableId: { _id: 'tbl_101' },
    customerName: 'Alice Future',
    partySize: 2,
    contact: '555-0101',
    bookingDate: '2026-08-28',
    startTime: '19:00',
    endTime: '20:30',
    status: 'Confirmed'
  };
  const res1 = classifyTableReservations('tbl_101', [futureBooking], mockTable, refDate);
  assert('TEST 1: Confirmed future booking appears in upcoming reservations', 
    res1.upcomingReservations.length === 1 && 
    res1.upcomingReservations[0]._id === 'b_future' && 
    res1.currentSeating === null
  );

  // Test 2: Seated booking appears in CURRENT SEATING
  const seatedBooking = {
    _id: 'b_seated',
    tableId: { _id: 'tbl_101' },
    customerName: 'Varid Sharma',
    partySize: 6,
    contact: '555-0199',
    bookingDate: '2026-08-27',
    startTime: '19:00',
    endTime: '20:30',
    status: 'Seated',
    seatedAt: new Date('2026-08-27T11:45:00Z')
  };
  const res2 = classifyTableReservations('tbl_101', [seatedBooking], mockTable, refDate);
  assert('TEST 2: Seated booking appears in CURRENT SEATING with active details', 
    res2.currentSeating !== null && 
    res2.currentSeating.customerName === 'Varid Sharma' && 
    res2.currentSeating.status === 'Seated' &&
    res2.currentSeating.durationMinutes >= 15
  );

  // Test 3: Seated booking does NOT appear in Upcoming Reservations
  assert('TEST 3: Seated booking does NOT appear in upcoming reservations', 
    res2.upcomingReservations.length === 0
  );

  // Test 4: Physical table state is OCCUPIED when guest is Seated
  assert('TEST 4: Seated booking ensures physical table state is OCCUPIED (not vacant)', 
    res2.isPhysicallyOccupied === true && 
    res2.operationalStatus === 'OCCUPIED'
  );

  // Test 5: Mixed list: Seated guest + Future Confirmed guest
  const res5 = classifyTableReservations('tbl_101', [seatedBooking, futureBooking], mockTable, refDate);
  assert('TEST 5: Clean separation - Seated guest in Current Seating, Future guest in Upcoming', 
    res5.currentSeating?._id === 'b_seated' &&
    res5.upcomingReservations.length === 1 &&
    res5.upcomingReservations[0]._id === 'b_future' &&
    !res5.upcomingReservations.some(b => b._id === 'b_seated')
  );

  // Test 6: Completed booking does NOT appear in Current Seating or Upcoming
  const completedBooking = {
    _id: 'b_completed',
    tableId: { _id: 'tbl_101' },
    customerName: 'Past Guest',
    partySize: 2,
    contact: '555-0102',
    bookingDate: '2026-08-27',
    startTime: '10:00',
    endTime: '11:30',
    status: 'Completed',
    completedAt: new Date('2026-08-27T11:30:00Z')
  };
  const res6 = classifyTableReservations('tbl_101', [completedBooking], mockTable, refDate);
  assert('TEST 6: Completed booking does NOT appear in current seating or upcoming', 
    res6.currentSeating === null && 
    res6.upcomingReservations.length === 0 &&
    res6.isPhysicallyOccupied === false &&
    res6.operationalStatus === 'AVAILABLE'
  );

  // Test 7: Cancelled booking does NOT appear in Current Seating or Upcoming
  const cancelledBooking = {
    _id: 'b_cancelled',
    tableId: { _id: 'tbl_101' },
    customerName: 'Cancelled Guest',
    partySize: 2,
    contact: '555-0103',
    bookingDate: '2026-08-28',
    startTime: '19:00',
    endTime: '20:30',
    status: 'Cancelled'
  };
  const res7 = classifyTableReservations('tbl_101', [cancelledBooking], mockTable, refDate);
  assert('TEST 7: Cancelled booking does NOT appear in current seating or upcoming', 
    res7.currentSeating === null && 
    res7.upcomingReservations.length === 0
  );

  // Test 8: No Show booking does NOT appear in Current Seating or Upcoming
  const noShowBooking = {
    _id: 'b_noshow',
    tableId: { _id: 'tbl_101' },
    customerName: 'NoShow Guest',
    partySize: 2,
    contact: '555-0104',
    bookingDate: '2026-08-27',
    startTime: '10:00',
    endTime: '11:30',
    status: 'No Show'
  };
  const res8 = classifyTableReservations('tbl_101', [noShowBooking], mockTable, refDate);
  assert('TEST 8: No Show booking does NOT appear in current seating or upcoming', 
    res8.currentSeating === null && 
    res8.upcomingReservations.length === 0
  );

  // Test 9: Checked-in active booking appears in active seating
  const checkedInBooking = {
    _id: 'b_checkedin',
    tableId: { _id: 'tbl_101' },
    customerName: 'Arrived Guest',
    partySize: 4,
    contact: '555-0105',
    bookingDate: '2026-08-27',
    startTime: '12:00',
    endTime: '13:30',
    status: 'Checked In',
    checkedInAt: new Date('2026-08-27T11:55:00Z')
  };
  const res9 = classifyTableReservations('tbl_101', [checkedInBooking], mockTable, refDate);
  assert('TEST 9: Checked-in active booking appears in current seating', 
    res9.currentSeating?._id === 'b_checkedin' && 
    res9.currentSeating.status === 'Checked In' &&
    res9.upcomingReservations.length === 0
  );

  // Test 10: Operational Status is RESERVED when only upcoming reservations exist
  const res10 = classifyTableReservations('tbl_101', [futureBooking], mockTable, refDate);
  assert('TEST 10: Operational Status is RESERVED when upcoming reservations exist without active guest', 
    res10.operationalStatus === 'RESERVED' && 
    res10.isPhysicallyOccupied === false
  );

  console.log(`\n==========================================================`);
  console.log(`FRONTEND CLASSIFICATION TESTS: ${passed + failed} TOTAL | ${passed} PASSED | ${failed} FAILED`);
  console.log(`==========================================================\n`);

  if (failed > 0) process.exit(1);
}

runClassificationTests();
