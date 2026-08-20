const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth, JWT_SECRET } = require('../middleware/authMiddleware');

// @route   POST /api/auth/register
// @desc    Register a new customer account (Always CUSTOMER role)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate name
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required.'
      });
    }

    // Validate email
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    // Validate password
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Check if email already registered
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    // Strictly enforce CUSTOMER role for public registration
    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: password,
      role: 'CUSTOMER'
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: 'Account created successfully'
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & return JWT token
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });

    const envManagerEmail = (process.env.MANAGER_EMAIL || 'manager@dinesmart.com').toLowerCase();
    const envManagerPass = process.env.MANAGER_PASSWORD || 'Manager123!';

    if (!user) {
      if (normalizedEmail === envManagerEmail && password === envManagerPass) {
        user = new User({
          name: 'Head Manager',
          email: envManagerEmail,
          password: envManagerPass,
          role: 'MANAGER'
        });
        await user.save();
      } else {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }
    } else {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        if (normalizedEmail === envManagerEmail && password === envManagerPass) {
          user.password = envManagerPass;
          user.role = 'MANAGER';
          await user.save();
        } else {
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password.'
          });
        }
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        name: user.name,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get currently authenticated user identity
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
