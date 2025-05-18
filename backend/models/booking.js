const pool = require('../config/db');

async function createBooking(guestName, numberOfRooms) {
  const result = await pool.query(
    `INSERT INTO bookings (guest_name, number_of_rooms) VALUES ($1, $2) RETURNING *`,
    [guestName, numberOfRooms]
  );
  return result.rows[0];
}

async function addRoomsToBooking(bookingId, roomIds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const roomId of roomIds) {
      await client.query(
        `INSERT INTO booking_rooms (booking_id, room_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [bookingId, roomId]
      );
      await client.query(
        `UPDATE rooms SET is_booked = TRUE, booking_id = $1 WHERE id = $2`,
        [bookingId, roomId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getBookingTravelTime(bookingId) {
  const result = await pool.query('SELECT get_booking_travel_time($1) as travel_time', [bookingId]);
  return result.rows[0].travel_time;
}

module.exports = {
  createBooking,
  addRoomsToBooking,
  getBookingTravelTime,
};
