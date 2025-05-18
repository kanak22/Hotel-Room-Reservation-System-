const pool = require('../config/db');

async function getAllRooms() {
  const result = await pool.query('SELECT * FROM rooms ORDER BY floor, position_on_floor');
  return result.rows;
}

async function getRoomById(id) {
  const result = await pool.query('SELECT * FROM rooms WHERE id = $1', [id]);
  return result.rows[0];
}

async function bookRoom(roomId, bookingId) {
  await pool.query('UPDATE rooms SET is_booked = TRUE, booking_id = $1 WHERE id = $2', [bookingId, roomId]);
}

async function initializeRooms() {
  await pool.query('SELECT initialize_hotel_rooms()');
}

module.exports = {
  getAllRooms,
  getRoomById,
  bookRoom,
  initializeRooms,
};
