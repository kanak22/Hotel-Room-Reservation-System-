CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  room_number INTEGER NOT NULL UNIQUE,
  floor INTEGER NOT NULL,
  position_on_floor INTEGER NOT NULL, 
  is_booked BOOLEAN DEFAULT FALSE,
  booking_id INTEGER DEFAULT NULL
);

CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  guest_name VARCHAR(255) NOT NULL,
  number_of_rooms INTEGER NOT NULL CHECK (number_of_rooms BETWEEN 1 AND 5),
  total_travel_time INTEGER DEFAULT 0, 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE booking_rooms (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  UNIQUE(booking_id, room_id)
);

CREATE INDEX idx_rooms_floor ON rooms(floor);
CREATE INDEX idx_rooms_is_booked ON rooms(is_booked);
CREATE INDEX idx_booking_rooms_booking_id ON booking_rooms(booking_id);
CREATE INDEX idx_booking_rooms_room_id ON booking_rooms(room_id);
CREATE INDEX idx_rooms_booking_id ON rooms(booking_id);

ALTER TABLE rooms
ADD CONSTRAINT fk_rooms_booking
FOREIGN KEY (booking_id) 
REFERENCES bookings(id)
ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION initialize_hotel_rooms()
RETURNS VOID AS $$
BEGIN

  DELETE FROM rooms;

  ALTER SEQUENCE rooms_id_seq RESTART WITH 1;

  FOR floor_num IN 1..9 LOOP
    FOR room_num IN 0..9 LOOP
      INSERT INTO rooms (room_number, floor, position_on_floor, is_booked)
      VALUES (floor_num * 100 + room_num + 1, floor_num, room_num, FALSE);
    END LOOP;
  END LOOP;
  

  FOR room_num IN 0..6 LOOP
    INSERT INTO rooms (room_number, floor, position_on_floor, is_booked)
    VALUES (1000 + room_num + 1, 10, room_num, FALSE);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_travel_time(room1_id INTEGER, room2_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  r1 rooms%ROWTYPE;
  r2 rooms%ROWTYPE;
  vertical_time INTEGER;
  horizontal_time1 INTEGER;
  horizontal_time2 INTEGER;
BEGIN

  SELECT * INTO r1 FROM rooms WHERE id = room1_id;
  SELECT * INTO r2 FROM rooms WHERE id = room2_id;

  IF r1.floor != r2.floor THEN
  
    vertical_time := ABS(r1.floor - r2.floor) * 2;
    
  
    horizontal_time1 := r1.position_on_floor;
    horizontal_time2 := r2.position_on_floor;
    
    RETURN vertical_time + horizontal_time1 + horizontal_time2;
  ELSE
  
  
    RETURN ABS(r1.position_on_floor - r2.position_on_floor);
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_booking_travel_time(booking_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  first_room_id INTEGER;
  last_room_id INTEGER;
BEGIN
  SELECT r.id INTO first_room_id
  FROM rooms r
  JOIN booking_rooms br ON r.id = br.room_id
  WHERE br.booking_id = $1
  ORDER BY r.floor, r.position_on_floor
  LIMIT 1;

  SELECT r.id INTO last_room_id
  FROM rooms r
  JOIN booking_rooms br ON r.id = br.room_id
  WHERE br.booking_id = $1
  ORDER BY r.floor DESC, r.position_on_floor DESC
  LIMIT 1;

  IF first_room_id = last_room_id THEN
    RETURN 0;
  END IF;
  
  RETURN calculate_travel_time(first_room_id, last_room_id);
END;
$$ LANGUAGE plpgsql;