const db = require('../config/db');
require('dotenv').config();

async function seedDatabase() {
  try {
    await db.query('DELETE FROM booking_rooms');
    await db.query('DELETE FROM rooms');
    await db.query('DELETE FROM bookings');

    await db.query('ALTER SEQUENCE rooms_id_seq RESTART WITH 1');
    await db.query('ALTER SEQUENCE bookings_id_seq RESTART WITH 1');
    await db.query('ALTER SEQUENCE booking_rooms_id_seq RESTART WITH 1');
    
    console.log('Cleaned existing data');
    
    await db.query('SELECT initialize_hotel_rooms()');
    
    const { rows } = await db.query('SELECT COUNT(*) FROM rooms');
    console.log(`Seeded database with ${rows[0].count} rooms`);
    
    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    db.pool.end();
  }
}
seedDatabase();