const express = require('express');
const router = express.Router();
const Table = require('../models/Table');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// @route   GET /api/tables
// @desc    Get all tables
router.get('/', async (req, res) => {
  try {
    const tables = await Table.find().sort({ number: 1 });
    res.json(tables);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/tables
// @desc    Create a new table (MANAGER only)
router.post('/', requireAuth, requireRole('MANAGER'), async (req, res) => {
  const { number, capacity, location, rating } = req.body;
  try {
    const newTable = new Table({
      number,
      capacity,
      location,
      rating
    });
    const savedTable = await newTable.save();
    res.status(201).json(savedTable);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// @route   PUT /api/tables/:id
// @desc    Update table details (MANAGER only)
router.put('/:id', requireAuth, requireRole('MANAGER'), async (req, res) => {
  try {
    const updatedTable = await Table.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!updatedTable) {
      return res.status(404).json({ message: 'Table not found' });
    }

    // Complete only the current active booking for this table if freed manually
    if (req.body.isOccupied === false) {
      const Booking = require('../models/Booking');
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const localNow = new Date(now.getTime() - (offset * 60 * 1000));
      const todayStr = localNow.toISOString().split('T')[0];
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      await Booking.updateMany(
        { 
          tableId: req.params.id, 
          status: { $in: ['Confirmed', 'Seated'] },
          bookingDate: todayStr,
          startTime: { $lte: currentTimeStr },
          endTime: { $gt: currentTimeStr }
        },
        { $set: { status: 'Completed', completedAt: new Date() } }
      );
    }

    res.json(updatedTable);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// @route   DELETE /api/tables/:id
// @desc    Delete a table (MANAGER only)
router.delete('/:id', requireAuth, requireRole('MANAGER'), async (req, res) => {
  try {
    const table = await Table.findByIdAndDelete(req.params.id);
    if (!table) {
      return res.status(404).json({ message: 'Table not found' });
    }
    res.json({ message: 'Table deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
