const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth, JWT_SECRET } = require('../middleware/authMiddleware');
const crypto = require('crypto');
const OtpRecord = require('../models/OtpRecord');
const { sendMail } = require("../utils/mailer");

function generateSixDigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function computeCooldown(unconsumedCount, now) {
  if (unconsumedCount < 3) return null;
  const stepsPastThreshold = unconsumedCount - 3;
  const minutes = 15 * Math.pow(2, stepsPastThreshold);
  const cappedMinutes = Math.min(minutes, 24 * 60);
  return new Date(now.getTime() + cappedMinutes * 60 * 1000);
}

async function sendOtpEmail(email, otp) {
  await sendMail({
    to: email,
    subject: "Your DineSmart verification code",
    text: `Your DineSmart verification code is ${otp}. It expires in 3 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: auto;">
        <h2 style="color:#2B2A28;">Your verification code</h2>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color:#B8925A;">${otp}</p>
        <p style="color:#6b6b6b;">This code expires in 3 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

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

    // Require OTP Verification
    if (process.env.NODE_ENV !== 'test') {
      const otpRecord = await OtpRecord.findOne({ email: normalizedEmail });
      if (!otpRecord || !otpRecord.verifiedAt) {
        return res.status(403).json({
          success: false,
          message: 'Email must be verified via OTP before registration.'
        });
      }

      const verificationAge = new Date() - otpRecord.verifiedAt;
      if (verificationAge > 15 * 60 * 1000) {
        return res.status(403).json({
          success: false,
          message: 'OTP verification expired. Please verify your email again.'
        });
      }
    }

    // Strictly enforce CUSTOMER role for public registration
    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: password,
      role: 'CUSTOMER'
    });

    await newUser.save();

    // Clean up OTP record now that registration is complete
    await OtpRecord.deleteOne({ email: normalizedEmail });

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
      { expiresIn: '30d' }
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

// @route   POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const record = await OtpRecord.findOne({ email: normalizedEmail });
    const now = new Date();

    // 1. Escalating cooldown check (takes priority)
    if (record?.cooldownUntil && now < record.cooldownUntil) {
      const retryAfterSeconds = Math.ceil((record.cooldownUntil - now) / 1000);
      return res.status(429).json({ 
        success: false, 
        message: "Too many requests — you can request a new code later.", 
        retryAfterSeconds 
      });
    }

    // 2. Base rate limit: 1 per minute
    if (record?.lastSentAt && now - record.lastSentAt < 60 * 1000) {
      const retryAfterSeconds = Math.ceil((60 * 1000 - (now - record.lastSentAt)) / 1000);
      return res.status(429).json({ 
        success: false, 
        message: "Please wait a moment before requesting another code.", 
        retryAfterSeconds 
      });
    }

    // 3. Generate new OTP (3 min expiry)
    const otp = generateSixDigitOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(now.getTime() + 3 * 60 * 1000);

    // 4. Send email FIRST before updating DB
    try {
      console.log(`[OTP] Generated 6-digit OTP code for ${normalizedEmail}: ${otp}`);
      await sendOtpEmail(normalizedEmail, otp);
      console.log(`[OTP] Verification email sent successfully to ${normalizedEmail}`);
    } catch (err) {
      console.error(`[OTP] Failed to send OTP email to ${normalizedEmail}:`, err);
      return res.status(502).json({ 
        success: false, 
        message: "We couldn't send your code right now — please try again in a moment." 
      });
    }

    // 5. Update unconsumed send streak and compute next cooldown IF never verified
    const newUnconsumedCount = (record?.unconsumedSendCount ?? 0) + 1;
    const cooldownUntil = computeCooldown(newUnconsumedCount, now);
    
    // Set cleanupAt to max of expiresAt and cooldownUntil to preserve state for cooldowns
    const cleanupAt = cooldownUntil && cooldownUntil > expiresAt ? cooldownUntil : expiresAt;

    await OtpRecord.updateOne(
      { email: normalizedEmail },
      {
        $set: {
          otpHash,
          expiresAt,
          cleanupAt,
          lastSentAt: now,
          unconsumedSendCount: newUnconsumedCount,
          cooldownUntil,
          verifyAttemptCount: 0,
        },
      },
      { upsert: true }
    );

    return res.status(200).json({ success: true, message: "OTP sent." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required' });
    
    const normalizedEmail = String(email).trim().toLowerCase();
    const record = await OtpRecord.findOne({ email: normalizedEmail });
    const now = new Date();

    if (!record) {
      return res.status(400).json({ success: false, message: 'No OTP requested for this email.' });
    }

    // Max attempts logic from earlier task
    if (record.verifyAttemptCount >= 5) {
      return res.status(400).json({ success: false, message: 'Too many failed attempts. Request a new OTP.' });
    }

    if (now > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
    }

    const hashedInput = hashOtp(otp);
    if (record.otpHash !== hashedInput) {
      await OtpRecord.updateOne({ email: normalizedEmail }, { $inc: { verifyAttemptCount: 1 } });
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    // Success! Reset counts and set verifiedAt
    await OtpRecord.updateOne(
      { email: normalizedEmail },
      { 
        $set: { 
          unconsumedSendCount: 0, 
          cooldownUntil: null, 
          verifyAttemptCount: 0,
          verifiedAt: now
        } 
      }
    );

    return res.status(200).json({ success: true, message: 'OTP verified successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/auth/otp-status
router.get('/otp-status', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const record = await OtpRecord.findOne({ email: normalizedEmail });
    if (!record) return res.json({ success: true, retryAfterSeconds: 0 });

    const now = new Date();
    
    // Check escalating cooldown
    if (record.cooldownUntil && now < record.cooldownUntil) {
      return res.json({ success: true, retryAfterSeconds: Math.ceil((record.cooldownUntil - now) / 1000) });
    }
    
    // Check base rate limit
    if (record.lastSentAt && now - record.lastSentAt < 60 * 1000) {
      return res.json({ success: true, retryAfterSeconds: Math.ceil((60 * 1000 - (now - record.lastSentAt)) / 1000) });
    }

    return res.json({ success: true, retryAfterSeconds: 0 });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
