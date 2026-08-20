const express = require('express');
const router = express.Router();
const Table = require('../models/Table');
const DsaAnalyticsEvent = require('../models/DsaAnalyticsEvent');
const { runDsaEngine } = require('../utils/dsaConnector');
const { getAvailableTables } = require('../utils/availabilityHelper');

const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Helper to record DSA events without failing the request if DB write errors
async function recordDsaEvent(operation, success, metadata = {}) {
  try {
    await DsaAnalyticsEvent.create({
      operation,
      success,
      metadata
    });
  } catch (err) {
    console.error('Error logging DSA event:', err.message);
  }
}

// @route   POST /api/dsa/recommend
// @desc    Get recommended tables for party size & location preference
router.post('/recommend', async (req, res) => {
  const { partySize, preference, bookingDate, startTime, endTime } = req.body;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const date = bookingDate || todayStr;
    const start = startTime || '12:00';
    const end = endTime || '13:30';

    const availableTables = await getAvailableTables(date, start, end, parseInt(partySize, 10));
    
    // Map to engine Table structure (all passed tables are available, so is_occupied: false)
    const tablesPayload = availableTables.map(t => ({
      id: t._id.toString(),
      capacity: t.capacity,
      location: t.location,
      is_occupied: false,
      rating: t.rating
    }));

    const dsaResult = await runDsaEngine({
      action: 'recommend',
      partySize: parseInt(partySize, 10),
      preference: preference || '',
      tables: tablesPayload
    });

    if (dsaResult.status === 'success') {
      const recommendationsWithDetails = dsaResult.recommendations.map(rec => {
        const dbTable = availableTables.find(t => t._id.toString() === rec.id);
        return {
          ...rec,
          number: dbTable ? dbTable.number : 'Unknown'
        };
      });

      await recordDsaEvent('recommend', true, {
        partySize: parseInt(partySize, 10),
        preference: preference || '',
        resultCount: recommendationsWithDetails.length
      });

      res.json(recommendationsWithDetails);
    } else {
      await recordDsaEvent('recommend', false, {
        partySize: parseInt(partySize, 10),
        preference: preference || '',
        errorMessage: dsaResult.message
      });
      res.status(500).json({ message: dsaResult.message || 'DSA recommendation engine failed' });
    }
  } catch (err) {
    await recordDsaEvent('recommend', false, { errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/dsa/combine
// @desc    Get optimal table combinations for a large party size using backtracking
router.post('/combine', async (req, res) => {
  const { partySize, bookingDate, startTime, endTime } = req.body;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const date = bookingDate || todayStr;
    const start = startTime || '12:00';
    const end = endTime || '13:30';

    // Get available tables for this slot without filtering by capacity
    const availableTables = await getAvailableTables(date, start, end, null);

    const tablesPayload = availableTables.map(t => ({
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

    if (dsaResult.status === 'success') {
      // Map C++ table IDs back to full MongoDB Table details
      const tableIds = dsaResult.combination.map(t => t.id);
      const fullTables = await Table.find({ _id: { $in: tableIds } });
      
      await recordDsaEvent('combine', true, {
        partySize: parseInt(partySize, 10),
        tableCount: fullTables.length,
        resultCount: dsaResult.combination.length
      });

      res.json({
        combination: fullTables,
        totalCapacity: dsaResult.totalCapacity
      });
    } else {
      await recordDsaEvent('combine', false, {
        partySize: parseInt(partySize, 10),
        errorMessage: dsaResult.message
      });
      res.status(500).json({ message: dsaResult.message || 'DSA combination engine failed' });
    }
  } catch (err) {
    await recordDsaEvent('combine', false, { errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/dsa/lookup
// @desc    Lookup table by ID using C++ Custom HashMap (MANAGER only)
router.post('/lookup', requireAuth, requireRole('MANAGER'), async (req, res) => {
  const { lookupId } = req.body;
  try {
    const allTables = await Table.find();

    const tablesPayload = allTables.map(t => ({
      id: t._id.toString(),
      capacity: t.capacity,
      location: t.location,
      is_occupied: t.isOccupied,
      rating: t.rating
    }));

    const dsaResult = await runDsaEngine({
      action: 'lookup',
      lookupId: lookupId,
      tables: tablesPayload
    });

    if (dsaResult.status === 'success') {
      await recordDsaEvent('lookup', true, { lookupId });
      res.json(dsaResult.table);
    } else {
      await recordDsaEvent('lookup', false, { lookupId, errorMessage: dsaResult.message });
      res.status(404).json({ message: dsaResult.message || 'Table not found' });
    }
  } catch (err) {
    await recordDsaEvent('lookup', false, { lookupId, errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

