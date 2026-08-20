const mongoose = require('mongoose');

const dsaAnalyticsEventSchema = new mongoose.Schema({
  operation: {
    type: String,
    enum: ['recommend', 'combine', 'lookup'],
    required: true,
    index: true
  },
  success: {
    type: Boolean,
    required: true,
    index: true
  },
  metadata: {
    partySize: { type: Number },
    tableCount: { type: Number },
    resultCount: { type: Number },
    preference: { type: String },
    errorMessage: { type: String }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index for time-range analytics aggregation
dsaAnalyticsEventSchema.index({ operation: 1, createdAt: -1 });

module.exports = mongoose.model('DsaAnalyticsEvent', dsaAnalyticsEventSchema);
