require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smart-booking';
const MANAGER_EMAIL = process.env.MANAGER_EMAIL || 'manager@dinesmart.com';
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD || 'ManagerSecurePass123!';

async function seedManager() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    const normalizedEmail = MANAGER_EMAIL.trim().toLowerCase();
    let manager = await User.findOne({ email: normalizedEmail });

    if (manager) {
      console.log(`Found existing manager account (${normalizedEmail}). Updating credentials...`);
      manager.name = 'DineSmart Manager';
      manager.password = MANAGER_PASSWORD;
      manager.role = 'MANAGER';
      await manager.save();
      console.log(`Manager account successfully updated with role MANAGER.`);
    } else {
      console.log(`Creating new manager account (${normalizedEmail})...`);
      manager = new User({
        name: 'DineSmart Manager',
        email: normalizedEmail,
        password: MANAGER_PASSWORD,
        role: 'MANAGER'
      });
      await manager.save();
      console.log(`Manager account created successfully with role MANAGER.`);
    }

    await mongoose.disconnect();
    console.log('Database disconnected. Manager seed completed.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed manager account:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  seedManager();
}

module.exports = seedManager;
