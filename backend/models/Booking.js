const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true
  },
  partySize: {
    type: Number,
    required: true
  },
  contact: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        const clean = v.replace(/[\s\-()]/g, '');
        return /^\d{10}$/.test(clean);
      },
      message: props => `${props.value} is not a valid 10-digit phone number!`
    }
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['Confirmed', 'Checked In', 'Seated', 'Completed', 'Cancelled', 'No Show'],
    default: 'Confirmed'
  },
  waitlistId: {
    type: String,
    default: null
  },
  bookingDate: {
    type: String,
    default: () => new Date().toISOString().split('T')[0]
  },
  startTime: {
    type: String,
    default: "12:00"
  },
  endTime: {
    type: String,
    default: "13:30"
  },
  checkedInAt: {
    type: Date,
    default: null
  },
  seatedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  noShowAt: {
    type: Date,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  bookingTime: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

BookingSchema.index({ userId: 1, bookingDate: -1 });
BookingSchema.index({ tableId: 1, bookingDate: 1, status: 1 });
BookingSchema.index({ status: 1, bookingDate: 1 });

module.exports = mongoose.model('Booking', BookingSchema);
