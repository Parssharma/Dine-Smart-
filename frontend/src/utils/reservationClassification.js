/**
 * Utility for centralized classification of table reservations and physical occupancy.
 * 
 * Follows DineSmart Reservation Lifecycle:
 * Confirmed -> Checked In -> Seated -> Completed
 * (with Cancelled / No Show terminal states)
 * 
 * Rules:
 * 1. Confirmed + future date/time -> Upcoming Reservations
 * 2. Checked In / Seated + currently active reservation -> Current Seating / Active Reservation
 * 3. Seated booking NEVER appears in Upcoming Reservations.
 * 4. Completed, Cancelled, No-Show -> NEVER appear in Upcoming or Current Seating.
 * 5. Physical table state: If a guest is currently Seated (or table is explicitly occupied),
 *    the table is physically OCCUPIED (never represented as Vacant).
 * 6. No booking can appear in both Current Seating and Upcoming Reservations simultaneously.
 */

export function getCurrentLocalDateTime(referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const offset = now.getTimezoneOffset();
  const localNow = new Date(now.getTime() - (offset * 60 * 1000));
  const todayStr = localNow.toISOString().split('T')[0];

  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  return { now, todayStr, currentTimeStr };
}

export function classifyTableReservations(tableId, bookings = [], tableObj = null, referenceDate = new Date()) {
  const { now, todayStr, currentTimeStr } = getCurrentLocalDateTime(referenceDate);

  const tIdStr = tableId ? (tableId._id ? tableId._id.toString() : tableId.toString()) : null;

  // Filter non-terminal bookings matching this table ID
  const tableBookings = (bookings || []).filter(b => {
    if (!b) return false;
    const bTableId = b.tableId?._id 
      ? b.tableId._id.toString() 
      : (b.tableId ? b.tableId.toString() : (b.table?._id ? b.table._id.toString() : (b.table ? b.table.toString() : null)));
    
    if (bTableId !== tIdStr) return false;
    // Exclude terminal/inactive states
    if (['Completed', 'Cancelled', 'No Show'].includes(b.status)) return false;
    return true;
  });

  // 1. Determine Current Seating / Active Reservation
  // Priority:
  // (a) Any booking with status === 'Seated'
  // (b) Any booking with status === 'Checked In'
  // (c) Any booking with status === 'Confirmed' currently in time window on today's date
  let activeBooking = tableBookings.find(b => b.status === 'Seated');
  if (!activeBooking) {
    activeBooking = tableBookings.find(b => b.status === 'Checked In');
  }
  if (!activeBooking) {
    activeBooking = tableBookings.find(b => 
      b.status === 'Confirmed' && 
      b.bookingDate === todayStr && 
      currentTimeStr >= b.startTime && 
      currentTimeStr < b.endTime
    );
  }

  let currentSeating = null;
  if (activeBooking) {
    const seatedTime = activeBooking.seatedAt || activeBooking.checkedInAt || activeBooking.bookingTime || activeBooking.createdAt;
    const duration = seatedTime ? Math.max(0, Math.round((now.getTime() - new Date(seatedTime).getTime()) / 60000)) : 0;
    currentSeating = {
      _id: activeBooking._id,
      customerName: activeBooking.customerName,
      partySize: activeBooking.partySize,
      contact: activeBooking.contact,
      startTime: activeBooking.startTime,
      endTime: activeBooking.endTime,
      bookingDate: activeBooking.bookingDate,
      seatedAt: activeBooking.seatedAt,
      checkedInAt: activeBooking.checkedInAt,
      durationMinutes: activeBooking.durationMinutes ?? duration,
      status: activeBooking.status
    };
  } else if (tableObj?.currentGuest) {
    currentSeating = {
      _id: tableObj.currentGuest.bookingId || tableObj.currentGuest._id,
      customerName: tableObj.currentGuest.customerName,
      partySize: tableObj.currentGuest.partySize,
      contact: tableObj.currentGuest.contact,
      startTime: tableObj.currentGuest.startTime,
      endTime: tableObj.currentGuest.endTime,
      bookingDate: tableObj.currentGuest.bookingDate || todayStr,
      durationMinutes: tableObj.currentGuest.durationMinutes ?? 0,
      status: tableObj.currentGuest.status || 'Seated'
    };
  }

  // 2. Determine Upcoming Reservations
  // Only future eligible bookings that are NOT the active seated guest
  const upcomingReservations = tableBookings
    .filter(b => {
      // Must not be the active current seating guest
      if (currentSeating && (b._id?.toString() === currentSeating._id?.toString())) {
        return false;
      }
      // Seated is NEVER upcoming
      if (b.status === 'Seated') return false;
      // Must be Confirmed or Checked In
      if (b.status !== 'Confirmed' && b.status !== 'Checked In') return false;

      // Must be in future
      if (b.bookingDate > todayStr) return true;
      if (b.bookingDate === todayStr) {
        return b.startTime >= currentTimeStr || b.status === 'Confirmed' || b.status === 'Checked In';
      }
      return false;
    })
    .sort((a, b) => {
      if (a.bookingDate !== b.bookingDate) {
        return a.bookingDate.localeCompare(b.bookingDate);
      }
      return a.startTime.localeCompare(b.startTime);
    });

  // 3. Derived Physical Table State & Operational Status
  const isPhysicallyOccupied = Boolean(
    tableObj?.isOccupied || 
    (currentSeating && (currentSeating.status === 'Seated' || currentSeating.status === 'Checked In'))
  );

  let operationalStatus = 'AVAILABLE';
  if (isPhysicallyOccupied || (currentSeating && currentSeating.status === 'Seated')) {
    operationalStatus = 'OCCUPIED';
  } else if (upcomingReservations.length > 0 || tableObj?.operationalStatus === 'RESERVED') {
    operationalStatus = 'RESERVED';
  }

  return {
    currentSeating,
    upcomingReservations,
    isPhysicallyOccupied,
    operationalStatus
  };
}
