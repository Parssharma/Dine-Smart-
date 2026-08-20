const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  recipientRole: {
    type: String,
    enum: ['CUSTOMER', 'MANAGER'],
    default: 'CUSTOMER',
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'BOOKING_CONFIRMED',
      'BOOKING_CANCELLED',
      'BOOKING_CHECKED_IN',
      'BOOKING_SEATED',
      'BOOKING_COMPLETED',
      'BOOKING_NO_SHOW',
      'WAITLIST_JOINED',
      'WAITLIST_PROMOTED',
      'RESERVATION_REMINDER',
      'UPCOMING_RESERVATION',
      'WAITLIST_AVAILABLE',
      'NO_SHOW_ELIGIBLE',
      'LONG_DINING',
      'TURNOVER_REQUIRED'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  },
  relatedTableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    default: null
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  idempotencyKey: {
    type: String,
    default: null,
    index: true,
    sparse: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ recipientRole: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
