const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const { findOptimalRooms, calculateTotalTravelTime } = require('./utils/roomUtils');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({
  origin: function (origin, callback) {
    console.log('Request origin:', origin);
    callback(null, true);
  },
  credentials: true
}));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers));
  next();
});

app.get('/api/rooms', async (req, res) => {
  try {
    const query = 'SELECT * FROM rooms ORDER BY room_number ASC';
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).json({ message: 'Error fetching rooms', error: err.message });
  }
});

app.get('/api/rooms/available', async (req, res) => {
  try {
    const query = 'SELECT * FROM rooms WHERE is_booked = FALSE ORDER BY floor ASC, room_number ASC';
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching available rooms:', err);
    res.status(500).json({ message: 'Error fetching available rooms', error: err.message });
  }
});

app.get('/api/rooms/floor/:floorNumber', async (req, res) => {
  try {
    const { floorNumber } = req.params;
    const query = 'SELECT * FROM rooms WHERE floor = $1 ORDER BY room_number ASC';
    const { rows } = await db.query(query, [floorNumber]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching rooms by floor:', err);
    res.status(500).json({ message: 'Error fetching rooms by floor', error: err.message });
  }
});

app.post('/api/bookings', async (req, res) => {

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const { guestName, numberOfRooms } = req.body;

    if (!guestName || !numberOfRooms) {
      return res.status(400).json({ message: 'Guest name and number of rooms are required' });
    }

    if (numberOfRooms < 1 || numberOfRooms > 5) {
      return res.status(400).json({ message: 'Number of rooms must be between 1 and 5' });
    }

    const countQuery = 'SELECT COUNT(*) FROM rooms WHERE is_booked = FALSE';
    const countResult = await client.query(countQuery);

    if (parseInt(countResult.rows[0].count) < numberOfRooms) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Not enough rooms available' });
    }

    const availableRoomsQuery = 'SELECT * FROM rooms WHERE is_booked = FALSE ORDER BY floor, position_on_floor';
    const availableRoomsResult = await client.query(availableRoomsQuery);
    const optimalRooms = await findOptimalRooms(numberOfRooms);
    console.log("optimalRooms:", optimalRooms);

    if (!optimalRooms || optimalRooms.length < numberOfRooms) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Could not find optimal room combination' });
    }

    const totalTravelTime = await calculateTotalTravelTime(optimalRooms);

    const bookingQuery = `
      INSERT INTO bookings (guest_name, number_of_rooms, total_travel_time)
      VALUES ($1, $2, $3)
      RETURNING id, guest_name, number_of_rooms, total_travel_time, created_at
    `;

    const bookingResult = await client.query(bookingQuery, [guestName, numberOfRooms, totalTravelTime]);
    const booking = bookingResult.rows[0];

    for (const room of optimalRooms) {

      const updateRoomQuery = `
        UPDATE rooms 
        SET is_booked = TRUE, booking_id = $1
        WHERE id = $2
      `;
      await client.query(updateRoomQuery, [booking.id, room.id]);

      const bookingRoomQuery = `
        INSERT INTO booking_rooms (booking_id, room_id)
        VALUES ($1, $2)
      `;
      await client.query(bookingRoomQuery, [booking.id, room.id]);
    }

    const completeBookingQuery = `
      SELECT 
        b.id, b.guest_name, b.number_of_rooms, b.total_travel_time, b.created_at,
        json_agg(r.*) as rooms
      FROM bookings b
      JOIN booking_rooms br ON b.id = br.booking_id
      JOIN rooms r ON br.room_id = r.id
      WHERE b.id = $1
      GROUP BY b.id, b.guest_name, b.number_of_rooms, b.total_travel_time, b.created_at
    `;

    const completeBookingResult = await client.query(completeBookingQuery, [booking.id]);

    await client.query('COMMIT');
    res.status(201).json(completeBookingResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating booking:', err);
    res.status(500).json({ message: 'Error creating booking', error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const query = `
      SELECT 
        b.id, b.guest_name, b.number_of_rooms, b.total_travel_time, b.created_at,
        json_agg(r.*) as rooms
      FROM bookings b
      JOIN booking_rooms br ON b.id = br.booking_id
      JOIN rooms r ON br.room_id = r.id
      GROUP BY b.id, b.guest_name, b.number_of_rooms, b.total_travel_time, b.created_at
      ORDER BY b.created_at DESC
    `;

    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ message: 'Error fetching bookings', error: err.message });
  }
});

app.get('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        b.id, b.guest_name, b.number_of_rooms, b.total_travel_time, b.created_at,
        json_agg(r.*) as rooms
      FROM bookings b
      JOIN booking_rooms br ON b.id = br.booking_id
      JOIN rooms r ON br.room_id = r.id
      WHERE b.id = $1
      GROUP BY b.id, b.guest_name, b.number_of_rooms, b.total_travel_time, b.created_at
    `;

    const { rows } = await db.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching booking:', err);
    res.status(500).json({ message: 'Error fetching booking', error: err.message });
  }
});

app.delete('/api/bookings/:id', async (req, res) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;


    const checkQuery = 'SELECT * FROM bookings WHERE id = $1';
    const checkResult = await client.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Booking not found' });
    }

    const updateRoomsQuery = `
      UPDATE rooms
      SET is_booked = FALSE, booking_id = NULL
      WHERE booking_id = $1
    `;
    await client.query(updateRoomsQuery, [id]);

    const deleteBookingRoomsQuery = 'DELETE FROM booking_rooms WHERE booking_id = $1';
    await client.query(deleteBookingRoomsQuery, [id]);

    const deleteBookingQuery = 'DELETE FROM bookings WHERE id = $1';
    await client.query(deleteBookingQuery, [id]);

    await client.query('COMMIT');
    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error cancelling booking:', err);
    res.status(500).json({ message: 'Error cancelling booking', error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/generateRandomOccupancy', async (req, res) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('UPDATE rooms SET is_booked = FALSE, booking_id = NULL');
    await client.query('DELETE FROM booking_rooms');
    await client.query('DELETE FROM bookings');

    const { rows: allRooms } = await client.query('SELECT * FROM rooms');


    const occupancyRate = Math.random() * 0.4 + 0.3;
    const roomsToBook = Math.floor(allRooms.length * occupancyRate);


    const shuffledIndices = Array.from({ length: allRooms.length }, (_, i) => i);
    for (let i = shuffledIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
    }

    const roomsToBeBooked = shuffledIndices.slice(0, roomsToBook).map(i => allRooms[i]);

    const bookings = [];
    let processedRooms = 0;

    while (processedRooms < roomsToBeBooked.length) {

      const roomsPerBooking = Math.min(
        Math.floor(Math.random() * 5) + 1,
        roomsToBeBooked.length - processedRooms
      );

      const bookingRooms = roomsToBeBooked.slice(processedRooms, processedRooms + roomsPerBooking);

      let totalTravelTime = 0;
      if (roomsPerBooking > 1) {
        const travelTimeQuery = 'SELECT calculate_travel_time($1, $2) as travel_time';
        const travelTimeResult = await client.query(travelTimeQuery, [
          bookingRooms[0].id,
          bookingRooms[bookingRooms.length - 1].id
        ]);
        totalTravelTime = travelTimeResult.rows[0].travel_time;
      }

      const bookingQuery = `
        INSERT INTO bookings (guest_name, number_of_rooms, total_travel_time)
        VALUES ($1, $2, $3)
        RETURNING id
      `;

      const bookingResult = await client.query(bookingQuery, [
        `Guest ${Math.floor(Math.random() * 1000)}`,
        roomsPerBooking,
        totalTravelTime
      ]);

      const bookingId = bookingResult.rows[0].id;
      bookings.push(bookingId);


      for (const room of bookingRooms) {
        await client.query(
          'UPDATE rooms SET is_booked = TRUE, booking_id = $1 WHERE id = $2',
          [bookingId, room.id]
        );

        await client.query(
          'INSERT INTO booking_rooms (booking_id, room_id) VALUES ($1, $2)',
          [bookingId, room.id]
        );
      }

      processedRooms += roomsPerBooking;
    }

    await client.query('COMMIT');

    res.json({
      message: 'Random occupancy generated',
      occupancyRate: `${Math.round(occupancyRate * 100)}%`,
      bookingsCreated: bookings.length,
      roomsBooked: roomsToBook
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error generating random occupancy:', err);
    res.status(500).json({ message: 'Error generating random occupancy', error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/reset', async (req, res) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('UPDATE rooms SET is_booked = FALSE, booking_id = NULL');
    await client.query('DELETE FROM booking_rooms');
    await client.query('DELETE FROM bookings');

    await client.query('COMMIT');
    res.json({ message: 'All bookings reset successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error resetting bookings:', err);
    res.status(500).json({ message: 'Error resetting bookings', error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/findOptimalRooms', async (req, res) => {
  try {
    const { numberOfRooms } = req.body;


    if (!numberOfRooms || numberOfRooms < 1 || numberOfRooms > 5) {
      return res.status(400).json({ message: 'Valid number of rooms (1-5) is required' });
    }

    const countQuery = 'SELECT COUNT(*) FROM rooms WHERE is_booked = FALSE';
    const countResult = await db.query(countQuery);

    if (parseInt(countResult.rows[0].count) < numberOfRooms) {
      return res.status(400).json({ message: 'Not enough rooms available' });
    }

    const optimalRooms = await findOptimalRooms(numberOfRooms);

    const totalTravelTime = await calculateTotalTravelTime(optimalRooms);

    res.json({
      optimalRooms,
      totalTravelTime
    });
  } catch (err) {
    console.error('Error finding optimal rooms:', err);
    res.status(500).json({ message: 'Error finding optimal rooms', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
