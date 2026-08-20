const mongoose = require('mongoose');

const WaitlistSchema = new mongoose.Schema({
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
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Waitlist', WaitlistSchema);
