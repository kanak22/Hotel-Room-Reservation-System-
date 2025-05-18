
const db = require('../config/db');

async function findOptimalRooms(numberOfRooms) {
  try {
    const floorQuery = `
      SELECT floor, COUNT(*) as available_rooms
      FROM rooms
      WHERE is_booked = FALSE
      GROUP BY floor
      HAVING COUNT(*) >= $1
      ORDER BY COUNT(*) DESC
    `;
    
    const floorResult = await db.query(floorQuery, [numberOfRooms]);
    
    if (floorResult.rows.length > 0) {
      const floorWithMostRooms = floorResult.rows[0].floor;
      

      const roomsQuery = `
        SELECT *
        FROM rooms
        WHERE floor = $1 AND is_booked = FALSE
        ORDER BY position_on_floor
        LIMIT $2
      `;
      
      const roomsResult = await db.query(roomsQuery, [floorWithMostRooms, numberOfRooms]);
      return roomsResult.rows;
    }
    
    
    const optimalRoomsQuery = `
      WITH ranked_rooms AS (
        SELECT 
          *,
          ROW_NUMBER() OVER (PARTITION BY floor ORDER BY position_on_floor) as position_rank
        FROM rooms
        WHERE is_booked = FALSE
      )
      SELECT *
      FROM ranked_rooms
      WHERE position_rank <= 2  -- Prioritize rooms closest to stairs/lift (positions 0-1)
      ORDER BY floor, position_on_floor
      LIMIT $1
    `;
    
    const optimalResult = await db.query(optimalRoomsQuery, [numberOfRooms]);
    
    if (optimalResult.rows.length < numberOfRooms) {
      const anyRoomsQuery = `
        SELECT *
        FROM rooms
        WHERE is_booked = FALSE
        ORDER BY floor, position_on_floor
        LIMIT $1
      `;
      
      const anyRoomsResult = await db.query(anyRoomsQuery, [numberOfRooms]);
      return anyRoomsResult.rows;
    }
    
    return optimalResult.rows;
  } catch (error) {
    console.error('Error finding optimal rooms:', error);
    throw error;
  }
}

async function calculateTotalTravelTime(rooms) {
  if (!rooms || rooms.length <= 1) return 0;
  
  try {
    const firstRoom = rooms[0];
    const lastRoom = rooms[rooms.length - 1];
    
    const query = `SELECT calculate_travel_time($1, $2) as travel_time`;
    const result = await db.query(query, [firstRoom.id, lastRoom.id]);
    
    return result.rows[0].travel_time;
  } catch (error) {
    console.error('Error calculating travel time:', error);
    throw error;
  }
}

module.exports = {
  findOptimalRooms,
  calculateTotalTravelTime
};