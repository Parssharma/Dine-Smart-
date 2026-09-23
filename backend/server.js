require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const tableRoutes = require('./routes/tableRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const dsaRoutes = require('./routes/dsaRoutes');
const authRoutes = require('./routes/authRoutes');
const operationsRoutes = require('./routes/operationsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smart-booking';

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (
      !process.env.FRONTEND_URL ||
      origin === process.env.FRONTEND_URL ||
      origin.includes('localhost') ||
      origin.endsWith('.vercel.app') ||
      origin.includes('onrender.com')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dsa', dsaRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Smart Booking API is running.' });
});

// Centralized Express Global Error Handler
app.use((err, req, res, next) => {
  console.error('Express Error Handler caught error:', err.message);

  let status = err.status || 500;
  let message = err.message || 'Something went wrong. Please try again.';

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ID format for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate resource conflict error.';
  }

  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production' && status === 500 ? 'Something went wrong. Please try again.' : message
  });
});

const { seedInitialData } = require('./utils/seedData');

const { transporter } = require('./utils/mailer');

// Connect to MongoDB & Start Server
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(MONGO_URI)
    .then(async () => {
      console.log('Successfully connected to MongoDB.');
      await seedInitialData();

      // Verify SMTP transporter
      transporter.verify((err) => {
        if (err) console.error("SMTP transporter verification failed:", err.message);
        else console.log("SMTP transporter ready.");
      });

      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    });
}

module.exports = app;
