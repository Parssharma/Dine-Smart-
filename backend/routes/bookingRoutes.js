const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Table = require('../models/Table');
const Waitlist = require('../models/Waitlist');
const BookingAudit = require('../models/BookingAudit');
const { runDsaEngine } = require('../utils/dsaConnector');
const { getAvailableTables, isCurrentTimeSlot } = require('../utils/availabilityHelper');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/authMiddleware');
const { createNotification, recordAuditEntry } = require('../utils/notificationHelper');
const { validateBookingWindow } = require('../utils/bookingWindow');

function isObviouslyFakeNumber(digitsOnly) {
  const sequential = "0123456789";
  const sequentialReversed = "9876543210";
  if (/^(\d)\1+$/.test(digitsOnly)) return true;
  if (sequential.includes(digitsOnly) || sequentialReversed.includes(digitsOnly)) return true;
  const knownJunkPatterns = [
    "1234567890",
    "0123456789",
    "1111111111",
    "0000000000",
    "9999999999",
    "1234554321",
  ];
  if (knownJunkPatterns.includes(digitsOnly)) return true;
  return false;
}

// Valid Lifecycle Transitions State Machine
const VALID_TRANSITIONS = {
  'Confirmed': ['Checked In', 'Seated', 'Cancelled', 'No Show'],
  'Checked In': ['Seated', 'Cancelled', 'No Show'],
  'Seated': ['Completed', 'Cancelled'],
  'Completed': [],
  'Cancelled': [],
  'No Show': []
};

/**
 * Checks if a booking is currently eligible for No Show based on grace period.
 */
function isEligibleForNoShow(booking) {
  if (!['Confirmed', 'Checked In'].includes(booking.status)) return false;
  const graceMinutes = parseInt(process.env.NO_SHOW_GRACE_MINUTES || '15', 10);
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localNow = new Date(now.getTime() - (offset * 60 * 1000));
  const todayStr = localNow.toISOString().split('T')[0];

  if (booking.bookingDate < todayStr) return true;
  if (booking.bookingDate > todayStr) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [sH, sM] = booking.startTime.split(':').map(Number);
  const startMinutes = sH * 60 + sM;
  return currentMinutes >= (startMinutes + graceMinutes);
}

// Asynchronous global lock queue to prevent race conditions during booking creation
let isBookingLocked = false;
async function acquireGlobalLock() {
  while (isBookingLocked) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  isBookingLocked = true;
}
function releaseGlobalLock() {
  isBookingLocked = false;
}

// @route   GET /api/bookings
// @desc    Get bookings (Managers get all bookings, Customers get only their own bookings)
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'CUSTOMER') {
      query = { userId: req.user.id };
    }

    const bookings = await Booking.find(query).populate('tableId').sort({ bookingTime: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get single booking by ID (Manager can view any, Customer can only view own)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const booking = await Booking.findById(req.params.id).populate('tableId');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Ownership check for customers
    if (req.user.role === 'CUSTOMER' && booking.userId && booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. You can only view your own booking details.' });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/bookings/:id/history
// @desc    Get complete audit trail & timeline for a booking (Manager any, Customer own)
router.get('/:id/history', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Customer can only view own booking history
    if (req.user.role === 'CUSTOMER' && booking.userId && booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. You can only view your own booking history.' });
    }

    const history = await BookingAudit.find({ bookingId: req.params.id }).sort({ timestamp: 1, createdAt: 1 });
    res.json({
      bookingId: booking._id,
      customerName: booking.customerName,
      status: booking.status,
      history
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/bookings
// @desc    Create a new booking (Direct booking if table selected, otherwise waitlist fallback)
router.post('/', optionalAuth, async (req, res) => {
  const { customerName, partySize, contact, tableId, tableIds, bookingDate, startTime, endTime } = req.body;
  
  await acquireGlobalLock();
  try {
    // Input Validation checks
    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
      return res.status(400).json({ message: 'Customer name is required and must be a string.' });
    }
    if (!bookingDate) {
      return res.status(400).json({ message: 'Booking date is required.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      return res.status(400).json({ message: 'Booking date must be in YYYY-MM-DD format.' });
    }
    if (!startTime || !endTime) {
      return res.status(400).json({ message: 'Start time and end time are required.' });
    }
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      return res.status(400).json({ message: 'Start and end time must be in HH:MM format.' });
    }
    if (!partySize || parseInt(partySize, 10) <= 0 || isNaN(parseInt(partySize, 10))) {
      return res.status(400).json({ message: 'Party size must be a positive number.' });
    }
    if (!contact || typeof contact !== 'string') {
      return res.status(400).json({ message: 'Contact details are required.' });
    }
    const { isValidPhoneNumber } = require('libphonenumber-js');
    if (!isValidPhoneNumber(contact, 'IN')) {
      return res.status(400).json({ message: 'Please enter a valid phone number.' });
    }
    const digitsOnly = contact.replace(/\D/g, "");
    if (isObviouslyFakeNumber(digitsOnly)) {
      return res.status(400).json({ message: "Please enter your real contact number." });
    }
    // We keep cleanContact for backwards compatibility in queries
    const cleanContact = contact.replace(/[\s\-()]/g, '');

    if (!req.user || req.user.role !== 'CUSTOMER') {
      // It's a guest or manager. We rate-limit guests explicitly. (We'll assume managers don't get rate limited, but we check if it's a guest)
      // Actually, if !req.user it's a guest.
      if (!req.user) {
        const recentGuestBookings = await Booking.countDocuments({
          contact: cleanContact,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });
        if (recentGuestBookings >= 3) {
          return res.status(429).json({ message: "Too many bookings from this contact number today. Please sign in to book more, or contact us directly." });
        }

        // FUTURE: if fake/no-show guest bookings become a measurable problem,
        // consider adding SMS OTP verification (Twilio Verify or similar) specifically
        // for guest bookings — logged-in customers already have email verification
        // and don't need this. Cost: ~$0.05/verification via Twilio Verify.
      }
    }
    if (tableId) {
      if (!mongoose.Types.ObjectId.isValid(tableId)) {
        return res.status(400).json({ message: 'Invalid table ID format.' });
      }
    }

    const date = bookingDate;
    const start = startTime;
    const end = endTime;

    const startDateTime = new Date(`${date}T${start}`);
    const endDateTime = new Date(`${date}T${end}`);

    const startMins = startDateTime.getHours() * 60 + startDateTime.getMinutes();
    if (startMins > 23 * 60 + 30) {
      return res.status(400).json({ message: 'This start time is too late for our dining hours — please choose an earlier time.' });
    }

    if (startDateTime >= endDateTime) {
      return res.status(400).json({ message: 'End time must be later than start time.' });
    }

    // Validate 1 to 24 hour booking lead time window for customer requests
    const isManagerRole = req.user && req.user.role === 'MANAGER';
    const isExplicitCheck = req.headers['x-enforce-booking-window'] === 'true';
    if ((!isManagerRole && process.env.NODE_ENV !== 'test') || isExplicitCheck) {
      const windowCheck = validateBookingWindow(date, start);
      if (!windowCheck.valid) {
        return res.status(400).json({ message: windowCheck.message });
      }
    }

    // Prevent double booking: check if there's an active booking or waitlist entry for this contact
    const activeBooking = await Booking.findOne({
      contact: cleanContact,
      status: { $in: ['Confirmed', 'Checked In', 'Seated'] },
      bookingDate: date,
      startTime: { $lt: end },
      endTime: { $gt: start }
    });
    const activeWaitlist = await Waitlist.findOne({
      contact: cleanContact,
      bookingDate: date,
      startTime: { $lt: end },
      endTime: { $gt: start }
    });

    if (activeBooking || activeWaitlist) {
      return res.status(400).json({
        message: 'A booking or waitlist entry already exists for this contact number during the requested time slot.'
      });
    }

    // Get available tables for this slot
    const availableTables = await getAvailableTables(date, start, end, parseInt(partySize, 10));

    // Optional user ID from token
    const userId = req.user ? req.user.id : null;

    const rawTableIds = Array.isArray(tableIds) && tableIds.length > 0
      ? tableIds
      : (tableId ? [tableId] : []);

    if (rawTableIds.length === 1) {
      const singleTableId = rawTableIds[0];
      // Direct booking with specific single table
      const isAvailable = availableTables.some(t => t._id.toString() === singleTableId);
      if (!isAvailable) {
        return res.status(400).json({ message: 'Sorry, this table was just booked for the selected time.' });
      }

      const table = await Table.findById(singleTableId);
      if (!table) return res.status(404).json({ message: 'Table not found' });

      // Create booking instance and validate before occupying table
      const newBooking = new Booking({
        customerName,
        partySize: parseInt(partySize, 10),
        contact: cleanContact,
        tableId: singleTableId,
        userId,
        bookingDate: date,
        startTime: start,
        endTime: end,
        status: 'Confirmed'
      });
      await newBooking.validate();

      // Only mark table occupied physically if the slot is "now"
      const checkPhysical = isCurrentTimeSlot(date, start, end);
      if (checkPhysical) {
        table.isOccupied = true;
        await table.save();
      }

      try {
        const savedBooking = await newBooking.save();
        const populatedBooking = await Booking.findById(savedBooking._id).populate('tableId');

        // Record creation audit entry
        await recordAuditEntry({
          bookingId: savedBooking._id,
          changedBy: userId,
          changedByRole: req.user ? req.user.role : 'CUSTOMER',
          changedByName: req.user ? req.user.name : customerName,
          previousStatus: null,
          newStatus: 'Confirmed',
          reason: 'Reservation created'
        });

        // Notify Manager of new reservation
        await createNotification({
          recipientRole: 'MANAGER',
          type: 'BOOKING_CONFIRMED',
          title: 'New Reservation Booked',
          message: `${customerName} booked Table T-${table.number} for party of ${partySize} on ${date} at ${start}.`,
          relatedBookingId: savedBooking._id,
          relatedTableId: table._id
        });

        // Send confirmation notification if user account linked
        if (userId) {
          await createNotification({
            userId,
            recipientRole: 'CUSTOMER',
            type: 'BOOKING_CONFIRMED',
            title: 'Reservation Confirmed',
            message: `Your reservation for Table ${table.number} on ${date} at ${start} has been confirmed.`,
            relatedBookingId: savedBooking._id,
            relatedTableId: table._id
          });
        }

        return res.status(201).json({ type: 'booking', data: populatedBooking });
      } catch (saveErr) {
        // Rollback: Revert table occupancy
        if (checkPhysical) {
          table.isOccupied = false;
          await table.save();
        }
        throw saveErr;
      }
    } else if (rawTableIds.length > 1) {
      // Direct booking with combined multiple tables
      for (const tid of rawTableIds) {
        if (!mongoose.Types.ObjectId.isValid(tid)) {
          return res.status(400).json({ message: 'Invalid table ID format.' });
        }
      }

      const selectedTables = await Table.find({ _id: { $in: rawTableIds } });
      if (selectedTables.length !== rawTableIds.length) {
        return res.status(404).json({ message: 'One or more selected tables not found.' });
      }

      const totalCapacity = selectedTables.reduce((acc, t) => acc + t.capacity, 0);
      if (totalCapacity < parseInt(partySize, 10)) {
        return res.status(400).json({ message: `Combined table capacity (${totalCapacity}) is insufficient for party size (${partySize}).` });
      }

      // Check slot availability for all tables in combination
      const allAvailableForSlot = await getAvailableTables(date, start, end, null);
      const availableSet = new Set(allAvailableForSlot.map(t => t._id.toString()));
      for (const t of selectedTables) {
        if (!availableSet.has(t._id.toString())) {
          return res.status(400).json({ message: `Sorry, Table T-${t.number} is no longer available for this time slot.` });
        }
      }

      const checkPhysical = isCurrentTimeSlot(date, start, end);
      const newBookings = [];
      let remainingGuests = parseInt(partySize, 10);

      for (let i = 0; i < selectedTables.length; i++) {
        const t = selectedTables[i];
        const assignedGuests = i === selectedTables.length - 1 ? remainingGuests : Math.min(t.capacity, remainingGuests);
        remainingGuests = Math.max(0, remainingGuests - assignedGuests);

        const b = new Booking({
          customerName,
          partySize: assignedGuests > 0 ? assignedGuests : t.capacity,
          contact: cleanContact,
          tableId: t._id,
          userId,
          bookingDate: date,
          startTime: start,
          endTime: end,
          status: 'Confirmed'
        });
        await b.validate();
        newBookings.push(b);
      }

      if (checkPhysical) {
        for (const t of selectedTables) {
          t.isOccupied = true;
          await t.save();
        }
      }

      try {
        const savedBookings = [];
        for (const b of newBookings) {
          savedBookings.push(await b.save());
        }

        const tableNames = selectedTables.map(t => `Table T-${t.number}`).join(' + ');

        for (const sb of savedBookings) {
          await recordAuditEntry({
            bookingId: sb._id,
            changedBy: userId,
            changedByRole: req.user ? req.user.role : 'CUSTOMER',
            changedByName: req.user ? req.user.name : customerName,
            previousStatus: null,
            newStatus: 'Confirmed',
            reason: `Reservation created for combined seating: ${tableNames}`
          });
        }

        // Notify Manager of new combined reservation
        await createNotification({
          recipientRole: 'MANAGER',
          type: 'BOOKING_CONFIRMED',
          title: 'New Combined Reservation',
          message: `${customerName} booked ${tableNames} (${totalCapacity} seats) for party of ${partySize} on ${date} at ${start}.`,
          relatedBookingId: savedBookings[0]._id,
          relatedTableId: selectedTables[0]._id
        });

        if (userId) {
          await createNotification({
            userId,
            recipientRole: 'CUSTOMER',
            type: 'BOOKING_CONFIRMED',
            title: 'Combined Reservation Confirmed',
            message: `Your reservation for ${tableNames} (${totalCapacity} total seats) on ${date} at ${start} has been confirmed.`,
            relatedBookingId: savedBookings[0]._id,
            relatedTableId: selectedTables[0]._id
          });
        }

        const populatedMainBooking = await Booking.findById(savedBookings[0]._id).populate('tableId');
        return res.status(201).json({
          type: 'booking',
          data: populatedMainBooking,
          allBookings: savedBookings,
          combinedTables: selectedTables,
          combinedTableNames: tableNames,
          totalCapacity
        });
      } catch (saveErr) {
        if (checkPhysical) {
          for (const t of selectedTables) {
            t.isOccupied = false;
            await t.save();
          }
        }
        throw saveErr;
      }
    } else {
      // Auto-assign: Check if any single table is available right now for this slot
      if (availableTables.length > 0) {
        // Select the first available table automatically
        const selectedTable = availableTables[0];
        const newBooking = new Booking({
          customerName,
          partySize: parseInt(partySize, 10),
          contact: cleanContact,
          tableId: selectedTable._id,
          userId,
          bookingDate: date,
          startTime: start,
          endTime: end,
          status: 'Confirmed'
        });
        await newBooking.validate();

        const checkPhysical = isCurrentTimeSlot(date, start, end);
        if (checkPhysical) {
          selectedTable.isOccupied = true;
          await selectedTable.save();
        }

        try {
          const savedBooking = await newBooking.save();
          const populatedBooking = await Booking.findById(savedBooking._id).populate('tableId');

          // Record creation audit entry
          await recordAuditEntry({
            bookingId: savedBooking._id,
            changedBy: userId,
            changedByRole: req.user ? req.user.role : 'CUSTOMER',
            changedByName: req.user ? req.user.name : customerName,
            previousStatus: null,
            newStatus: 'Confirmed',
            reason: 'Reservation created'
          });

          // Notify Manager of new auto-assigned reservation
          await createNotification({
            recipientRole: 'MANAGER',
            type: 'BOOKING_CONFIRMED',
            title: 'New Reservation Booked',
            message: `${customerName} booked Table T-${selectedTable.number} for party of ${partySize} on ${date} at ${start}.`,
            relatedBookingId: savedBooking._id,
            relatedTableId: selectedTable._id
          });

          // Send confirmation notification if user account linked
          if (userId) {
            await createNotification({
              userId,
              recipientRole: 'CUSTOMER',
              type: 'BOOKING_CONFIRMED',
              title: 'Reservation Confirmed',
              message: `Your reservation for Table ${selectedTable.number} on ${date} at ${start} has been confirmed.`,
              relatedBookingId: savedBooking._id,
              relatedTableId: selectedTable._id
            });
          }

          return res.status(201).json({ type: 'booking', data: populatedBooking });
        } catch (saveErr) {
          // Rollback: Revert table occupancy
          if (checkPhysical) {
            selectedTable.isOccupied = false;
            await selectedTable.save();
          }
          throw saveErr;
        }
      }

      // If no single table, attempt DSA combination auto-assign
      try {
        const allFreeTables = await getAvailableTables(date, start, end, null);
        const tablesPayload = allFreeTables.map(t => ({
          id: t._id.toString(),
          capacity: t.capacity,
          location: t.location,
          is_occupied: false,
          rating: t.rating
        }));

        const dsaResult = await runDsaEngine({
          action: 'combine',
          partySize: parseInt(partySize, 10),
          tables: tablesPayload
        });

        if (dsaResult.status === 'success' && Array.isArray(dsaResult.combination) && dsaResult.combination.length > 0) {
          const combTableIds = dsaResult.combination.map(t => t.id);
          const combTables = await Table.find({ _id: { $in: combTableIds } });
          
          if (combTables.length === combTableIds.length) {
            const checkPhysical = isCurrentTimeSlot(date, start, end);
            const newBookings = [];
            let remainingGuests = parseInt(partySize, 10);

            for (let i = 0; i < combTables.length; i++) {
              const t = combTables[i];
              const assignedGuests = i === combTables.length - 1 ? remainingGuests : Math.min(t.capacity, remainingGuests);
              remainingGuests = Math.max(0, remainingGuests - assignedGuests);

              const b = new Booking({
                customerName,
                partySize: assignedGuests > 0 ? assignedGuests : t.capacity,
                contact: cleanContact,
                tableId: t._id,
                userId,
                bookingDate: date,
                startTime: start,
                endTime: end,
                status: 'Confirmed'
              });
              await b.validate();
              newBookings.push(b);
            }

            if (checkPhysical) {
              for (const t of combTables) {
                t.isOccupied = true;
                await t.save();
              }
            }

            const savedBookings = [];
            for (const b of newBookings) {
              savedBookings.push(await b.save());
            }

            const tableNames = combTables.map(t => `Table T-${t.number}`).join(' + ');

            for (const sb of savedBookings) {
              await recordAuditEntry({
                bookingId: sb._id,
                changedBy: userId,
                changedByRole: req.user ? req.user.role : 'CUSTOMER',
                changedByName: req.user ? req.user.name : customerName,
                previousStatus: null,
                newStatus: 'Confirmed',
                reason: `Reservation auto-assigned via Backtracking Combiner: ${tableNames}`
              });
            }

            // Notify Manager of new auto-combined reservation
            await createNotification({
              recipientRole: 'MANAGER',
              type: 'BOOKING_CONFIRMED',
              title: 'New Combined Reservation',
              message: `${customerName} auto-assigned to ${tableNames} for party of ${partySize} on ${date} at ${start}.`,
              relatedBookingId: savedBookings[0]._id,
              relatedTableId: combTables[0]._id
            });

            if (userId) {
              await createNotification({
                userId,
                recipientRole: 'CUSTOMER',
                type: 'BOOKING_CONFIRMED',
                title: 'Combined Reservation Confirmed',
                message: `Your reservation for ${tableNames} on ${date} at ${start} has been confirmed.`,
                relatedBookingId: savedBookings[0]._id,
                relatedTableId: combTables[0]._id
              });
            }

            const populatedMainBooking = await Booking.findById(savedBookings[0]._id).populate('tableId');
            return res.status(201).json({
              type: 'booking',
              data: populatedMainBooking,
              allBookings: savedBookings,
              combinedTables: combTables,
              combinedTableNames: tableNames,
              totalCapacity: dsaResult.totalCapacity
            });
          }
        }
      } catch (combErr) {
        console.error('Auto-combination failed during booking:', combErr.message);
      }

      // No tables available -> Put on waitlist
      const newWaitlist = new Waitlist({
        customerName,
        partySize: parseInt(partySize, 10),
        contact: cleanContact,
        userId,
        bookingDate: date,
        startTime: start,
        endTime: end
      });
      const savedWaitlist = await newWaitlist.save();

      // Retrieve all waitlist entries to run through DSA Queue for queue position
      const allWaitlist = await Waitlist.find().sort({ joinedAt: 1 });
      
      // format waitlist entries for C++ engine
      const waitlistPayload = allWaitlist.map(w => ({
        id: w._id.toString(),
        customerName: w.customerName,
        partySize: w.partySize,
        contact: w.contact
      }));

      // Find position by running waitlist position check in C++
      const dsaResult = await runDsaEngine({
        action: 'waitlist',
        actionType: 'position',
        waitlist: waitlistPayload,
        customerId: savedWaitlist._id.toString()
      });

      // Notify Manager of new waitlist entry
      await createNotification({
        recipientRole: 'MANAGER',
        type: 'WAITLIST_JOINED',
        title: 'New Waitlist Request',
        message: `${customerName} joined the waitlist for party of ${partySize} on ${date} (${start} – ${end}).`
      });

      return res.status(201).json({
        type: 'waitlist',
        data: savedWaitlist,
        position: dsaResult.position || allWaitlist.length
      });
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    releaseGlobalLock();
  }
});

// @route   PUT /api/bookings/:id
// @desc    Update booking status (Enforces valid lifecycle state machine and RBAC)
router.put('/:id', requireAuth, async (req, res) => {
  const { status, reason } = req.body;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const booking = await Booking.findById(req.params.id).populate('tableId');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const oldStatus = booking.status;

    // Authorization & Ownership checks
    if (req.user.role === 'CUSTOMER') {
      // Must own the booking
      if (booking.userId && booking.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: "Access denied. You cannot modify another customer's booking." });
      }
      // Customer is only permitted to cancel
      if (status !== 'Cancelled') {
        return res.status(403).json({ message: 'Access denied. Customers are only authorized to cancel bookings.' });
      }
    }

    // Validate Status input
    const validStatuses = ['Confirmed', 'Checked In', 'Seated', 'Completed', 'Cancelled', 'No Show'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}` });
    }

    // Idempotent check: if status is already the requested status, return existing
    if (oldStatus === status) {
      return res.json(booking);
    }

    // Validate Allowed State Machine Transitions
    const allowedTransitions = VALID_TRANSITIONS[oldStatus] || [];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        message: `Invalid status transition from '${oldStatus}' to '${status}'.`
      });
    }

    // No Show specific validation
    if (status === 'No Show') {
      if (req.user.role !== 'MANAGER') {
        return res.status(403).json({ message: 'Access denied. Only managers can mark reservations as No Show.' });
      }
      if (!isEligibleForNoShow(booking)) {
        return res.status(400).json({ message: 'Reservation is not yet eligible for No Show. Grace period has not elapsed.' });
      }
    }

    // Update timestamps and status
    booking.status = status;
    if (status === 'Checked In' && !booking.checkedInAt) {
      booking.checkedInAt = new Date();
    }
    if (status === 'Seated' && !booking.seatedAt) {
      booking.seatedAt = new Date();
    }
    if (status === 'Completed' && !booking.completedAt) {
      booking.completedAt = new Date();
    }
    if (status === 'Cancelled' && !booking.cancelledAt) {
      booking.cancelledAt = new Date();
    }
    if (status === 'No Show' && !booking.noShowAt) {
      booking.noShowAt = new Date();
    }

    const savedBooking = await booking.save();

    // Side effects on physical Table occupancy
    if (booking.tableId) {
      const tableDocId = booking.tableId._id || booking.tableId;
      const checkPhysical = isCurrentTimeSlot(booking.bookingDate, booking.startTime, booking.endTime);
      if (status === 'Completed' || status === 'Cancelled' || status === 'No Show') {
        if (checkPhysical || oldStatus === 'Seated') {
          // Free the table physically
          await Table.findByIdAndUpdate(tableDocId, { isOccupied: false });
        }
      } else if (status === 'Seated') {
        // Mark table occupied physically
        await Table.findByIdAndUpdate(tableDocId, { isOccupied: true });
      }
    }

    // Record Append-Only Audit Trail entry
    await recordAuditEntry({
      bookingId: savedBooking._id,
      changedBy: req.user.id,
      changedByRole: req.user.role,
      changedByName: req.user.name,
      previousStatus: oldStatus,
      newStatus: status,
      reason: reason || `Status changed from ${oldStatus} to ${status}`
    });

    // Create In-App Notifications for Customer
    if (booking.userId) {
      const tableName = booking.tableId?.number ? `Table ${booking.tableId.number}` : 'your table';
      let notifType = null;
      let notifTitle = '';
      let notifMessage = '';

      if (status === 'Checked In') {
        notifType = 'BOOKING_CHECKED_IN';
        notifTitle = 'Checked In';
        notifMessage = `You have been checked in for ${tableName}.`;
      } else if (status === 'Seated') {
        notifType = 'BOOKING_SEATED';
        notifTitle = 'Seated';
        notifMessage = `You have been seated at ${tableName}. Enjoy your meal!`;
      } else if (status === 'Completed') {
        notifType = 'BOOKING_COMPLETED';
        notifTitle = 'Dining Completed';
        notifMessage = `Thank you for dining with DineSmart. Your session at ${tableName} is complete.`;
      } else if (status === 'Cancelled') {
        notifType = 'BOOKING_CANCELLED';
        notifTitle = 'Reservation Cancelled';
        notifMessage = `Your reservation for ${tableName} has been cancelled.`;
      } else if (status === 'No Show') {
        notifType = 'BOOKING_NO_SHOW';
        notifTitle = 'Reservation No-Show';
        notifMessage = `Your reservation for ${tableName} was marked as No-Show.`;
      }

      if (notifType) {
        await createNotification({
          userId: booking.userId,
          recipientRole: 'CUSTOMER',
          type: notifType,
          title: notifTitle,
          message: notifMessage,
          relatedBookingId: savedBooking._id,
          relatedTableId: booking.tableId?._id || booking.tableId
        });
      }
    }

    res.json(savedBooking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// @route   PUT /api/bookings/:id/check-in
// @desc    Dedicated Manager Action: Check In Guest
router.put('/:id/check-in', requireAuth, requireRole('MANAGER'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const booking = await Booking.findById(req.params.id).populate('tableId');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // If already checked in, return safely (idempotent)
    if (booking.status === 'Checked In') {
      return res.json(booking);
    }

    if (booking.status !== 'Confirmed') {
      return res.status(400).json({ message: `Cannot check in a booking with status '${booking.status}'. Must be 'Confirmed'.` });
    }

    const oldStatus = booking.status;
    booking.status = 'Checked In';
    booking.checkedInAt = new Date();
    const savedBooking = await booking.save();

    await recordAuditEntry({
      bookingId: savedBooking._id,
      changedBy: req.user.id,
      changedByRole: 'MANAGER',
      changedByName: req.user.name,
      previousStatus: oldStatus,
      newStatus: 'Checked In',
      reason: 'Guest arrived and checked in by manager'
    });

    if (booking.userId) {
      await createNotification({
        userId: booking.userId,
        recipientRole: 'CUSTOMER',
        type: 'BOOKING_CHECKED_IN',
        title: 'Checked In',
        message: 'You have been checked in. Your table is being prepared.',
        relatedBookingId: savedBooking._id,
        relatedTableId: booking.tableId?._id || booking.tableId
      });
    }

    res.json(savedBooking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// @route   PUT /api/bookings/:id/no-show
// @desc    Dedicated Manager Action: Mark Eligible Reservation as No Show
router.put('/:id/no-show', requireAuth, requireRole('MANAGER'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const booking = await Booking.findById(req.params.id).populate('tableId');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.status === 'No Show') {
      return res.json(booking);
    }

    if (!['Confirmed', 'Checked In'].includes(booking.status)) {
      return res.status(400).json({ message: `Cannot mark booking with status '${booking.status}' as No Show.` });
    }

    if (!isEligibleForNoShow(booking)) {
      return res.status(400).json({ message: 'Reservation is not yet eligible for No Show. Grace period has not elapsed.' });
    }

    const oldStatus = booking.status;
    booking.status = 'No Show';
    booking.noShowAt = new Date();
    const savedBooking = await booking.save();

    if (booking.tableId) {
      const tableDocId = booking.tableId._id || booking.tableId;
      await Table.findByIdAndUpdate(tableDocId, { isOccupied: false });
    }

    await recordAuditEntry({
      bookingId: savedBooking._id,
      changedBy: req.user.id,
      changedByRole: 'MANAGER',
      changedByName: req.user.name,
      previousStatus: oldStatus,
      newStatus: 'No Show',
      reason: 'Guest did not arrive within grace period'
    });

    if (booking.userId) {
      await createNotification({
        userId: booking.userId,
        recipientRole: 'CUSTOMER',
        type: 'BOOKING_NO_SHOW',
        title: 'Reservation Marked as No-Show',
        message: 'Your reservation was marked as No-Show as the arrival window passed.',
        relatedBookingId: savedBooking._id,
        relatedTableId: booking.tableId?._id || booking.tableId
      });
    }

    res.json(savedBooking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Waitlist Endpoints

// @route   GET /api/bookings/waitlist/all
// @desc    Get all waitlisted customers (MANAGER only)
router.get('/waitlist/all', requireAuth, requireRole('MANAGER'), async (req, res) => {
  try {
    const waitlist = await Waitlist.find().sort({ joinedAt: 1 });
    res.json(waitlist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/bookings/waitlist/position/:id
// @desc    Check waitlist position or promotion status
router.get('/waitlist/position/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(404).json({ position: -1, message: 'Invalid waitlist ID' });
    }

    const waitlistEntry = await Waitlist.findById(customerId);
    
    if (!waitlistEntry) {
      // Check if they were promoted to a booking
      const booking = await Booking.findOne({ waitlistId: customerId }).populate('tableId');
      if (booking) {
        return res.json({ position: -1, status: 'promoted', booking });
      }
      return res.json({ position: -1, message: 'Waitlist entry not found' });
    }

    const allWaitlist = await Waitlist.find().sort({ joinedAt: 1 });
    
    const waitlistPayload = allWaitlist.map(w => ({
      id: w._id.toString(),
      customerName: w.customerName,
      partySize: w.partySize,
      contact: w.contact
    }));

    const dsaResult = await runDsaEngine({
      action: 'waitlist',
      actionType: 'position',
      waitlist: waitlistPayload,
      customerId: customerId
    });

    res.json({ position: dsaResult.position });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/bookings/waitlist/promote/:id
// @desc    Promote waitlisted customer to a specific table or multiple combined tables (MANAGER only)
router.post('/waitlist/promote/:id', requireAuth, requireRole('MANAGER'), async (req, res) => {
  const { tableId, tableIds } = req.body;
  const rawTableIds = Array.isArray(tableIds) && tableIds.length > 0
    ? tableIds
    : tableId
      ? [tableId]
      : [];

  await acquireGlobalLock();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Waitlist entry not found' });
    }
    const waitlistEntry = await Waitlist.findById(req.params.id);
    if (!waitlistEntry) {
      // Check if already promoted
      const existingBooking = await Booking.findOne({ waitlistId: req.params.id });
      if (existingBooking) {
        return res.status(400).json({ message: 'Waitlist entry has already been promoted.' });
      }
      return res.status(404).json({ message: 'Waitlist entry not found' });
    }

    if (rawTableIds.length === 0) {
      return res.status(400).json({ message: 'Invalid table ID' });
    }

    for (const tid of rawTableIds) {
      if (!mongoose.Types.ObjectId.isValid(tid)) {
        return res.status(400).json({ message: 'Invalid table ID' });
      }
    }

    const selectedTables = await Table.find({ _id: { $in: rawTableIds } });
    if (selectedTables.length !== rawTableIds.length) {
      return res.status(404).json({ message: 'Table not found' });
    }

    const totalCapacity = selectedTables.reduce((acc, t) => acc + t.capacity, 0);
    if (totalCapacity < waitlistEntry.partySize) {
      return res.status(400).json({ message: `Table capacity (${totalCapacity}) is insufficient for party size (${waitlistEntry.partySize}).` });
    }

    // Check if tables are available for this slot
    const availableTables = await getAvailableTables(
      waitlistEntry.bookingDate,
      waitlistEntry.startTime,
      waitlistEntry.endTime,
      null
    );
    const availableSet = new Set(availableTables.map(t => t._id.toString()));
    for (const t of selectedTables) {
      if (!availableSet.has(t._id.toString())) {
        return res.status(400).json({ message: `Sorry, Table T-${t.number} is not available or has conflicting bookings for the requested time.` });
      }
    }

    // Check physical occupancy if current time slot
    const checkPhysical = isCurrentTimeSlot(waitlistEntry.bookingDate, waitlistEntry.startTime, waitlistEntry.endTime);

    // 1. Create Bookings (split or single)
    const newBookings = [];
    let remainingGuests = waitlistEntry.partySize;
    for (let i = 0; i < selectedTables.length; i++) {
      const t = selectedTables[i];
      const assignedGuests = i === selectedTables.length - 1 ? remainingGuests : Math.min(t.capacity, remainingGuests);
      remainingGuests = Math.max(0, remainingGuests - assignedGuests);

      const b = new Booking({
        customerName: waitlistEntry.customerName,
        partySize: assignedGuests > 0 ? assignedGuests : t.capacity,
        contact: waitlistEntry.contact,
        tableId: t._id,
        userId: waitlistEntry.userId || null,
        bookingDate: waitlistEntry.bookingDate,
        startTime: waitlistEntry.startTime,
        endTime: waitlistEntry.endTime,
        status: 'Confirmed',
        waitlistId: waitlistEntry._id.toString()
      });
      await b.validate();
      newBookings.push(b);
    }

    // 2. Mark tables occupied physically if slot is now
    if (checkPhysical) {
      for (const t of selectedTables) {
        t.isOccupied = true;
        await t.save();
      }
    }

    try {
      // 3. Save bookings and remove waitlist entry
      const savedBookings = [];
      for (const b of newBookings) {
        savedBookings.push(await b.save());
      }
      await Waitlist.findByIdAndDelete(req.params.id);

      const tableNames = selectedTables.map(t => `Table T-${t.number}`).join(' + ');

      // 4. Record audit entry for each booking
      for (const sb of savedBookings) {
        await recordAuditEntry({
          bookingId: sb._id,
          changedBy: req.user.id,
          changedByRole: 'MANAGER',
          changedByName: req.user.name,
          previousStatus: null,
          newStatus: 'Confirmed',
          reason: `Promoted from waitlist by manager to ${tableNames}`
        });
      }

      // 5. Send notification to customer
      if (waitlistEntry.userId) {
        await createNotification({
          userId: waitlistEntry.userId,
          recipientRole: 'CUSTOMER',
          type: 'WAITLIST_PROMOTED',
          title: 'Table Available - You Are Promoted!',
          message: `Great news! ${tableNames} (Total ${totalCapacity} seats) is now ready for your party of ${waitlistEntry.partySize}.`,
          relatedBookingId: savedBookings[0]._id,
          relatedTableId: selectedTables[0]._id
        });
      }

      const populatedBooking = await Booking.findById(savedBookings[0]._id).populate('tableId');
      res.status(200).json(populatedBooking);
    } catch (saveErr) {
      // Rollback: Revert table occupancy
      if (checkPhysical) {
        for (const t of selectedTables) {
          t.isOccupied = false;
          await t.save();
        }
      }
      throw saveErr;
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    releaseGlobalLock();
  }
});

// @route   DELETE /api/bookings/waitlist/:id
// @desc    Cancel waitlist entry (Manager can cancel any, Customer can only cancel their own)
router.delete('/waitlist/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Waitlist entry not found' });
    }

    const waitlist = await Waitlist.findById(req.params.id);
    if (!waitlist) return res.status(404).json({ message: 'Waitlist entry not found' });

    // Ownership check for customers
    if (req.user.role === 'CUSTOMER' && waitlist.userId && waitlist.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. You can only cancel your own waitlist entry.' });
    }

    await Waitlist.findByIdAndDelete(req.params.id);
    res.json({ message: 'Waitlist entry removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
