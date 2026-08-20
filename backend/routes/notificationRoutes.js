const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/authMiddleware');
const { checkAndSendReminders } = require('../utils/notificationHelper');

// @route   GET /api/notifications
// @desc    Get user's notifications (Customer: own; Manager: manager alerts + own)
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'CUSTOMER') {
      query = { userId: req.user.id };
    } else if (req.user.role === 'MANAGER') {
      query = {
        $or: [
          { recipientRole: 'MANAGER' },
          { userId: req.user.id }
        ]
      };
    }

    const notifications = await Notification.find(query)
      .populate('relatedBookingId')
      .populate('relatedTableId')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/notifications/unread-count
// @desc    Get count of unread notifications for current user/role
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    let query = { read: false };
    if (req.user.role === 'CUSTOMER') {
      query.userId = req.user.id;
    } else if (req.user.role === 'MANAGER') {
      query.$or = [
        { recipientRole: 'MANAGER' },
        { userId: req.user.id }
      ];
    }

    const count = await Notification.countDocuments(query);
    res.json({ unreadCount: count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark single notification as read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Ownership check for customers
    if (req.user.role === 'CUSTOMER') {
      if (!notification.userId || notification.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Access denied. You cannot modify another user\'s notification.' });
      }
    }

    notification.read = true;
    const saved = await notification.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all user/manager notifications as read
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    let query = { read: false };
    if (req.user.role === 'CUSTOMER') {
      query.userId = req.user.id;
    } else if (req.user.role === 'MANAGER') {
      query.$or = [
        { recipientRole: 'MANAGER' },
        { userId: req.user.id }
      ];
    }

    const result = await Notification.updateMany(query, { $set: { read: true } });
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/notifications/reminders/check
// @desc    Trigger idempotent scan for upcoming reservation reminders
router.post('/reminders/check', async (req, res) => {
  try {
    const created = await checkAndSendReminders();
    res.json({ success: true, count: created.length, reminders: created });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
