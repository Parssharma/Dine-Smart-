const User = require('../models/User');
const Table = require('../models/Table');

async function seedInitialData() {
  try {
    const managerEmail = process.env.MANAGER_EMAIL || 'manager@dinesmart.com';
    const managerPassword = process.env.MANAGER_PASSWORD || 'Manager123!';

    // 1. Seed Manager Account
    const existingManager = await User.findOne({ email: managerEmail.toLowerCase() });
    if (!existingManager) {
      const managerUser = new User({
        name: 'Head Manager',
        email: managerEmail.toLowerCase(),
        password: managerPassword,
        role: 'MANAGER'
      });
      await managerUser.save();
      console.log(`[Seed] Default manager account created: ${managerEmail}`);
    } else {
      existingManager.password = managerPassword;
      existingManager.role = 'MANAGER';
      await existingManager.save();
      console.log(`[Seed] Manager account updated with current password: ${managerEmail}`);
    }

    // 2. Seed Default Floor Plan Tables if empty
    const tableCount = await Table.countDocuments();
    if (tableCount === 0) {
      const defaultTables = [
        { number: '1', capacity: 2, location: 'Window', rating: 4.8, isOccupied: false },
        { number: '2', capacity: 2, location: 'Window', rating: 4.7, isOccupied: false },
        { number: '3', capacity: 4, location: 'Center', rating: 4.9, isOccupied: false },
        { number: '4', capacity: 4, location: 'Center', rating: 4.5, isOccupied: false },
        { number: '5', capacity: 6, location: 'Outdoor', rating: 5.0, isOccupied: false },
        { number: '6', capacity: 6, location: 'Outdoor', rating: 4.6, isOccupied: false },
        { number: '7', capacity: 8, location: 'Center', rating: 4.9, isOccupied: false },
        { number: '8', capacity: 4, location: 'Window', rating: 4.8, isOccupied: false }
      ];
      await Table.insertMany(defaultTables);
      console.log('[Seed] Default restaurant tables seeded.');
    }
  } catch (err) {
    console.error('[Seed] Warning during initial seed:', err.message);
  }
}

module.exports = { seedInitialData };
