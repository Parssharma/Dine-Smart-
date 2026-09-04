const mongoose = require('mongoose');

const otpRecordSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  otpHash: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  unconsumedSendCount: {
    type: Number,
    default: 0
  },
  cooldownUntil: {
    type: Date,
    default: null
  },
  lastSentAt: {
    type: Date,
    default: null
  },
  verifyAttemptCount: {
    type: Number,
    default: 0
  },
  cleanupAt: {
    type: Date,
    required: true
  },
  verifiedAt: {
    type: Date,
    default: null
  }
});

// TTL index to automatically delete records when cleanupAt is reached
otpRecordSchema.index({ cleanupAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpRecord', otpRecordSchema);
