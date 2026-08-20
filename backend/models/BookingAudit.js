const mongoose = require('mongoose');

const BookingAuditSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  changedByRole: {
    type: String,
    enum: ['CUSTOMER', 'MANAGER', 'SYSTEM'],
    default: 'SYSTEM'
  },
  changedByName: {
    type: String,
    default: 'System'
  },
  previousStatus: {
    type: String,
    default: null
  },
  newStatus: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

BookingAuditSchema.index({ bookingId: 1, timestamp: 1 });

module.exports = mongoose.model('BookingAudit', BookingAuditSchema);
