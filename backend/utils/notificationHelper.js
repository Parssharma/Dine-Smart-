const Notification = require('../models/Notification');
const BookingAudit = require('../models/BookingAudit');
const Booking = require('../models/Booking');
const User = require('../models/User');

/**
 * Creates an in-app notification safely.
 * If idempotencyKey is provided and an identical notification already exists, skips creation.
 */
async function createNotification({
  userId = null,
  recipientRole = 'CUSTOMER',
  type,
  title,
  message,
  relatedBookingId = null,
  relatedTableId = null,
  idempotencyKey = null
}) {
  try {
    if (idempotencyKey) {
      const existing = await Notification.findOne({ idempotencyKey });
      if (existing) {
        return existing;
      }
    }

    const notification = new Notification({
      userId,
      recipientRole,
      type,
      title,
      message,
      relatedBookingId,
      relatedTableId,
      idempotencyKey,
      read: false,
      createdAt: new Date()
    });

    return await notification.save();
  } catch (err) {
    console.error('Error creating notification:', err.message);
    return null;
  }
}

/**
 * Creates an append-only audit trail record for a booking.
 */
async function recordAuditEntry({
  bookingId,
  changedBy = null,
  changedByRole = 'SYSTEM',
  changedByName = 'System',
  previousStatus = null,
  newStatus,
  reason = ''
}) {
  try {
    const audit = new BookingAudit({
      bookingId,
      changedBy,
      changedByRole,
      changedByName,
      previousStatus,
      newStatus,
      reason,
      timestamp: new Date()
    });

    return await audit.save();
  } catch (err) {
    console.error('Error recording booking audit:', err.message);
    return null;
  }
}

/**
 * Scans upcoming reservations and creates idempotent reminders (e.g. 30 mins before start).
 */
async function checkAndSendReminders() {
  try {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - (offset * 60 * 1000));
    const todayStr = localNow.toISOString().split('T')[0];

    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    // Find all confirmed or checked-in bookings for today
    const upcomingToday = await Booking.find({
      bookingDate: todayStr,
      status: { $in: ['Confirmed', 'Checked In'] }
    }).populate('tableId');

    const createdNotifications = [];

    for (const booking of upcomingToday) {
      const [bH, bM] = booking.startTime.split(':').map(Number);
      const bookingStartTotalMinutes = bH * 60 + bM;
      const minutesUntil = bookingStartTotalMinutes - currentTotalMinutes;

      // Trigger reminder if between 0 and 35 minutes before start
      if (minutesUntil > 0 && minutesUntil <= 35) {
        const idempotencyKey = `reminder_${booking._id}_${todayStr}`;
        const tableName = booking.tableId ? `Table ${booking.tableId.number}` : 'your reserved table';

        if (booking.userId) {
          const notif = await createNotification({
            userId: booking.userId,
            recipientRole: 'CUSTOMER',
            type: 'RESERVATION_REMINDER',
            title: 'Reservation Reminder',
            message: `Your reservation at DineSmart (${tableName}) starts in ~${minutesUntil} minutes at ${booking.startTime}.`,
            relatedBookingId: booking._id,
            relatedTableId: booking.tableId?._id,
            idempotencyKey
          });
          if (notif) createdNotifications.push(notif);
        }

        // Manager alert reminder (idempotent for managers too)
        const managerIdempotencyKey = `mgr_reminder_${booking._id}_${todayStr}`;
        const mgrNotif = await createNotification({
          userId: null,
          recipientRole: 'MANAGER',
          type: 'UPCOMING_RESERVATION',
          title: 'Upcoming Reservation Alert',
          message: `${tableName} has a reservation for ${booking.customerName} (Party of ${booking.partySize}) in ${minutesUntil} minutes.`,
          relatedBookingId: booking._id,
          relatedTableId: booking.tableId?._id,
          idempotencyKey: managerIdempotencyKey
        });
        if (mgrNotif) createdNotifications.push(mgrNotif);
      }
    }

    return createdNotifications;
  } catch (err) {
    console.error('Error generating reminders:', err.message);
    return [];
  }
}

module.exports = {
  createNotification,
  recordAuditEntry,
  checkAndSendReminders
};
