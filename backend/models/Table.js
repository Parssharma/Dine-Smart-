const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
  number: {
    type: String,
    required: true,
    unique: true
  },
  capacity: {
    type: Number,
    required: true
  },
  location: {
    type: String,
    enum: ['Window', 'Center', 'Outdoor'],
    default: 'Center'
  },
  isOccupied: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 5
  }
}, { timestamps: true });

module.exports = mongoose.model('Table', TableSchema);
