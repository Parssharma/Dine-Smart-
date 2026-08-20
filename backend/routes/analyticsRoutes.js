const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Table = require('../models/Table');
const Waitlist = require('../models/Waitlist');
const BookingAudit = require('../models/BookingAudit');
const DsaAnalyticsEvent = require('../models/DsaAnalyticsEvent');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Middleware to validate date range query params
function validateDateRange(req, res, next) {
  const { startDate, endDate } = req.query;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (startDate) {
    if (!dateRegex.test(startDate) || isNaN(Date.parse(startDate))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid startDate format. Expected YYYY-MM-DD.'
      });
    }
  }

  if (endDate) {
    if (!dateRegex.test(endDate) || isNaN(Date.parse(endDate))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid endDate format. Expected YYYY-MM-DD.'
      });
    }
  }

  if (startDate && endDate) {
    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date range: startDate must be before or equal to endDate.'
      });
    }
  }

  next();
}

// Build MongoDB match filter for date range
function buildDateQuery(startDate, endDate) {
  const query = {};
  if (startDate && endDate) {
    query.bookingDate = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    query.bookingDate = { $gte: startDate };
  } else if (endDate) {
    query.bookingDate = { $lte: endDate };
  }
  return query;
}

// All analytics endpoints require MANAGER role
router.use(requireAuth, requireRole('MANAGER'), validateDateRange);

// @route   GET /api/analytics/overview
// @desc    Get high-level KPI overview & summary metrics
router.get('/overview', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = buildDateQuery(startDate, endDate);

    // Fetch all bookings matching range
    const bookings = await Booking.find(matchQuery).lean();
    const tables = await Table.find().lean();
    const totalTables = tables.length;

    const totalBookings = bookings.length;
    let confirmedCount = 0;
    let checkedInCount = 0;
    let seatedCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let noShowCount = 0;
    let partySizeSum = 0;

    let diningDurations = [];
    const dateCounts = {};
    const bookedTableIds = new Set();

    bookings.forEach(b => {
      partySizeSum += (b.partySize || 0);

      if (b.status === 'Confirmed') confirmedCount++;
      else if (b.status === 'Checked In') checkedInCount++;
      else if (b.status === 'Seated') seatedCount++;
      else if (b.status === 'Completed') completedCount++;
      else if (b.status === 'Cancelled') cancelledCount++;
      else if (b.status === 'No Show') noShowCount++;

      // Track active table usage
      if (b.tableId) {
        bookedTableIds.add(b.tableId.toString());
      }

      // Track date frequency for busiest day
      if (b.bookingDate) {
        dateCounts[b.bookingDate] = (dateCounts[b.bookingDate] || 0) + 1;
      }

      // Average Dining Duration: Strictly completedAt - seatedAt, non-negative
      if (b.status === 'Completed' && b.seatedAt && b.completedAt) {
        const startMs = new Date(b.seatedAt).getTime();
        const endMs = new Date(b.completedAt).getTime();
        const durationMins = Math.max(0, Math.round((endMs - startMs) / 60000));
        diningDurations.push(durationMins);
      }
    });

    // Metric Calculations
    const averagePartySize = totalBookings > 0 
      ? parseFloat((partySizeSum / totalBookings).toFixed(1)) 
      : 0;

    const averageDiningDurationMinutes = diningDurations.length > 0
      ? Math.round(diningDurations.reduce((sum, d) => sum + d, 0) / diningDurations.length)
      : null;

    // Rates Formulas
    const completionRate = totalBookings > 0
      ? parseFloat(((completedCount / totalBookings) * 100).toFixed(1))
      : 0;

    const cancellationRate = totalBookings > 0
      ? parseFloat(((cancelledCount / totalBookings) * 100).toFixed(1))
      : 0;

    const noShowRate = totalBookings > 0
      ? parseFloat(((noShowCount / totalBookings) * 100).toFixed(1))
      : 0;

    // Table Utilization: Distinct tables utilized vs Total tables
    const utilizedTablesCount = bookedTableIds.size;
    const tableUtilization = totalTables > 0
      ? parseFloat(((utilizedTablesCount / totalTables) * 100).toFixed(1))
      : 0;

    // Busiest Day
    let busiestDay = null;
    let maxDayCount = 0;
    Object.entries(dateCounts).forEach(([date, count]) => {
      if (count > maxDayCount) {
        maxDayCount = count;
        busiestDay = { date, count };
      }
    });

    // Waitlist Analytics
    const waitlistMatch = {};
    if (startDate && endDate) {
      waitlistMatch.bookingDate = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      waitlistMatch.bookingDate = { $gte: startDate };
    } else if (endDate) {
      waitlistMatch.bookingDate = { $lte: endDate };
    }
    const currentWaitlist = await Waitlist.find(waitlistMatch).lean();
    const currentWaitlistCount = currentWaitlist.length;

    // Promoted waitlist count from audit entries
    const auditPromoQuery = {
      reason: { $regex: /waitlist/i }
    };
    if (startDate && endDate) {
      const sDate = new Date(`${startDate}T00:00:00.000Z`);
      const eDate = new Date(`${endDate}T23:59:59.999Z`);
      auditPromoQuery.timestamp = { $gte: sDate, $lte: eDate };
    }
    const promotedWaitlistCount = await BookingAudit.countDocuments(auditPromoQuery);
    const totalWaitlistEntries = currentWaitlistCount + promotedWaitlistCount;
    const waitlistConversionRate = totalWaitlistEntries > 0
      ? parseFloat(((promotedWaitlistCount / totalWaitlistEntries) * 100).toFixed(1))
      : 0;

    res.json({
      success: true,
      data: {
        dateRange: { startDate: startDate || null, endDate: endDate || null },
        totalBookings,
        confirmedBookings: confirmedCount,
        checkedInBookings: checkedInCount,
        seatedBookings: seatedCount,
        completedBookings: completedCount,
        cancelledBookings: cancelledCount,
        noShowBookings: noShowCount,
        averagePartySize,
        averageDiningDurationMinutes,
        completionRate,
        cancellationRate,
        noShowRate,
        totalTables,
        utilizedTablesCount,
        tableUtilization,
        busiestDay,
        waitlist: {
          currentQueue: currentWaitlistCount,
          promotedCount: promotedWaitlistCount,
          totalEntries: totalWaitlistEntries,
          conversionRate: waitlistConversionRate
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/analytics/bookings
// @desc    Get booking trends and status distribution breakdown
router.get('/bookings', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = buildDateQuery(startDate, endDate);

    const bookings = await Booking.find(matchQuery).lean();
    const trends = {};
    const statusCounts = {
      'Confirmed': 0,
      'Checked In': 0,
      'Seated': 0,
      'Completed': 0,
      'Cancelled': 0,
      'No Show': 0
    };

    bookings.forEach(b => {
      const dateKey = b.bookingDate || 'Unknown';
      trends[dateKey] = (trends[dateKey] || 0) + 1;

      if (statusCounts[b.status] !== undefined) {
        statusCounts[b.status]++;
      }
    });

    const total = bookings.length;
    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0
    }));

    res.json({
      success: true,
      data: {
        trends,
        statusDistribution,
        totalBookings: total
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/analytics/tables
// @desc    Get per-table performance & utilization analytics
router.get('/tables', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = buildDateQuery(startDate, endDate);

    const [tables, bookings] = await Promise.all([
      Table.find().lean(),
      Booking.find(matchQuery).lean()
    ]);

    const tableStats = {};
    tables.forEach(t => {
      tableStats[t._id.toString()] = {
        tableId: t._id,
        number: t.number,
        capacity: t.capacity,
        location: t.location,
        rating: t.rating,
        totalBookings: 0,
        completedCount: 0,
        cancelledCount: 0,
        noShowCount: 0
      };
    });

    let maxBookings = 0;
    bookings.forEach(b => {
      if (b.tableId && tableStats[b.tableId.toString()]) {
        const entry = tableStats[b.tableId.toString()];
        entry.totalBookings++;
        if (b.status === 'Completed') entry.completedCount++;
        else if (b.status === 'Cancelled') entry.cancelledCount++;
        else if (b.status === 'No Show') entry.noShowCount++;

        if (entry.totalBookings > maxBookings) {
          maxBookings = entry.totalBookings;
        }
      }
    });

    const tablePerformance = Object.values(tableStats).map(t => {
      const utilization = maxBookings > 0 
        ? parseFloat(((t.totalBookings / maxBookings) * 100).toFixed(1)) 
        : 0;
      return {
        ...t,
        utilizationPercentage: utilization
      };
    }).sort((a, b) => b.totalBookings - a.totalBookings);

    const mostUtilizedTable = tablePerformance.length > 0 && tablePerformance[0].totalBookings > 0
      ? tablePerformance[0]
      : null;

    const leastUtilizedTable = tablePerformance.length > 0 && tablePerformance[tablePerformance.length - 1].totalBookings >= 0
      ? tablePerformance[tablePerformance.length - 1]
      : null;

    res.json({
      success: true,
      data: {
        tables: tablePerformance,
        mostUtilizedTable,
        leastUtilizedTable,
        totalTablesCount: tables.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/analytics/peak-hours
// @desc    Get reservation volume grouped by hour of the day
router.get('/peak-hours', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = buildDateQuery(startDate, endDate);

    const bookings = await Booking.find(matchQuery).lean();
    const hourCounts = {};
    for (let h = 0; h < 24; h++) {
      hourCounts[h] = 0;
    }

    bookings.forEach(b => {
      if (b.startTime) {
        const hour = parseInt(b.startTime.split(':')[0], 10);
        if (!isNaN(hour) && hour >= 0 && hour < 24) {
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
      }
    });

    let peakHour = null;
    let maxHourCount = 0;

    const hourlyData = Object.entries(hourCounts).map(([hStr, count]) => {
      const hour = parseInt(hStr, 10);
      const displayHour = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;

      if (count > maxHourCount) {
        maxHourCount = count;
        peakHour = { hour, label: displayHour, count };
      }

      return {
        hour,
        label: displayHour,
        count
      };
    });

    res.json({
      success: true,
      data: {
        peakHour,
        hourlyDistribution: hourlyData
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/analytics/waitlist
// @desc    Get waitlist metrics & conversion rates
router.get('/waitlist', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = buildDateQuery(startDate, endDate);

    const currentWaitlist = await Waitlist.find(matchQuery).lean();
    const currentQueueCount = currentWaitlist.length;

    // Calculate average wait time for active queue entries
    let totalWaitMins = 0;
    const nowMs = Date.now();
    currentWaitlist.forEach(w => {
      const createdAtMs = new Date(w.createdAt).getTime();
      const elapsedMins = Math.max(0, Math.round((nowMs - createdAtMs) / 60000));
      totalWaitMins += elapsedMins;
    });

    const averageWaitDurationMinutes = currentQueueCount > 0
      ? Math.round(totalWaitMins / currentQueueCount)
      : 0;

    const auditPromoQuery = {
      reason: { $regex: /waitlist/i }
    };
    if (startDate && endDate) {
      const sDate = new Date(`${startDate}T00:00:00.000Z`);
      const eDate = new Date(`${endDate}T23:59:59.999Z`);
      auditPromoQuery.timestamp = { $gte: sDate, $lte: eDate };
    }
    const promotedCount = await BookingAudit.countDocuments(auditPromoQuery);
    const totalEntries = currentQueueCount + promotedCount;
    const conversionRate = totalEntries > 0
      ? parseFloat(((promotedCount / totalEntries) * 100).toFixed(1))
      : 0;

    res.json({
      success: true,
      data: {
        currentQueueCount,
        promotedCount,
        totalEntries,
        averageWaitDurationMinutes,
        conversionRate
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/analytics/dsa
// @desc    Get C++ DSA Engine operational statistics & intelligence metrics
router.get('/dsa', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = {};
    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: new Date(`${startDate}T00:00:00.000Z`),
        $lte: new Date(`${endDate}T23:59:59.999Z`)
      };
    } else if (startDate) {
      matchQuery.createdAt = { $gte: new Date(`${startDate}T00:00:00.000Z`) };
    } else if (endDate) {
      matchQuery.createdAt = { $lte: new Date(`${endDate}T23:59:59.999Z`) };
    }

    const events = await DsaAnalyticsEvent.find(matchQuery).lean();

    let recommendTotal = 0;
    let recommendSuccess = 0;
    let combineTotal = 0;
    let combineSuccess = 0;
    let combineTableSum = 0;
    let lookupTotal = 0;
    let lookupSuccess = 0;

    events.forEach(ev => {
      if (ev.operation === 'recommend') {
        recommendTotal++;
        if (ev.success) recommendSuccess++;
      } else if (ev.operation === 'combine') {
        combineTotal++;
        if (ev.success) {
          combineSuccess++;
          if (ev.metadata?.tableCount) {
            combineTableSum += ev.metadata.tableCount;
          }
        }
      } else if (ev.operation === 'lookup') {
        lookupTotal++;
        if (ev.success) lookupSuccess++;
      }
    });

    const recommendSuccessRate = recommendTotal > 0
      ? parseFloat(((recommendSuccess / recommendTotal) * 100).toFixed(1))
      : 100.0;

    const combineSuccessRate = combineTotal > 0
      ? parseFloat(((combineSuccess / combineTotal) * 100).toFixed(1))
      : 100.0;

    const averageCombinationTables = combineSuccess > 0
      ? parseFloat((combineTableSum / combineSuccess).toFixed(1))
      : 0;

    res.json({
      success: true,
      data: {
        totalOperations: events.length,
        recommendations: {
          totalRequests: recommendTotal,
          successfulRequests: recommendSuccess,
          successRate: recommendSuccessRate
        },
        combinations: {
          totalRequests: combineTotal,
          successfulRequests: combineSuccess,
          successRate: combineSuccessRate,
          averageTablesUsed: averageCombinationTables
        },
        lookups: {
          totalRequests: lookupTotal,
          successfulRequests: lookupSuccess
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/analytics/export/csv
// @desc    Generate and download CSV Analytics Report (MANAGER ONLY)
router.get('/export/csv', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = buildDateQuery(startDate, endDate);

    const [bookings, tables] = await Promise.all([
      Booking.find(matchQuery).lean(),
      Table.find().lean()
    ]);

    let completed = 0;
    let cancelled = 0;
    let noShow = 0;
    let confirmed = 0;
    let seated = 0;
    let checkedIn = 0;
    let partySum = 0;

    bookings.forEach(b => {
      partySum += (b.partySize || 0);
      if (b.status === 'Completed') completed++;
      else if (b.status === 'Cancelled') cancelled++;
      else if (b.status === 'No Show') noShow++;
      else if (b.status === 'Confirmed') confirmed++;
      else if (b.status === 'Seated') seated++;
      else if (b.status === 'Checked In') checkedIn++;
    });

    const avgParty = bookings.length > 0 ? (partySum / bookings.length).toFixed(1) : '0.0';
    const compRate = bookings.length > 0 ? ((completed / bookings.length) * 100).toFixed(1) : '0.0';
    const cancRate = bookings.length > 0 ? ((cancelled / bookings.length) * 100).toFixed(1) : '0.0';

    // Build clean CSV content without sensitive customer data
    const rows = [];
    rows.push(['DINESMART RESTAURANT ANALYTICS REPORT']);
    rows.push([`Generated At`, new Date().toISOString()]);
    rows.push([`Date Range`, `${startDate || 'All Time'} to ${endDate || 'Present'}`]);
    rows.push([]);

    rows.push(['--- CORE KPI SUMMARY ---']);
    rows.push(['Metric', 'Value']);
    rows.push(['Total Bookings', bookings.length]);
    rows.push(['Completed Bookings', completed]);
    rows.push(['Confirmed Bookings', confirmed]);
    rows.push(['Checked-In Bookings', checkedIn]);
    rows.push(['Seated Bookings', seated]);
    rows.push(['Cancelled Bookings', cancelled]);
    rows.push(['No-Show Bookings', noShow]);
    rows.push(['Average Party Size', avgParty]);
    rows.push(['Completion Rate (%)', `${compRate}%`]);
    rows.push(['Cancellation Rate (%)', `${cancRate}%`]);
    rows.push([]);

    rows.push(['--- TABLE PERFORMANCE BREAKDOWN ---']);
    rows.push(['Table Number', 'Capacity', 'Location', 'Total Bookings']);
    tables.forEach(t => {
      const tableBookings = bookings.filter(b => b.tableId && b.tableId.toString() === t._id.toString()).length;
      rows.push([`T-${t.number}`, t.capacity, t.location, tableBookings]);
    });
    rows.push([]);

    rows.push(['--- DETAILED BOOKINGS LOG (AGGREGATED) ---']);
    rows.push(['Booking ID', 'Booking Date', 'Time Slot', 'Party Size', 'Status']);
    bookings.forEach(b => {
      rows.push([b._id.toString(), b.bookingDate, `${b.startTime}-${b.endTime}`, b.partySize, b.status]);
    });

    const csvContent = rows.map(r => r.map(cell => `"${cell !== undefined && cell !== null ? String(cell).replace(/"/g, '""') : ''}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="dinesmart-analytics-${startDate || 'all'}-to-${endDate || 'all'}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
