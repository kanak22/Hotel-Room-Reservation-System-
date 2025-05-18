import React, { useState, useEffect } from "react";

const RoomBooking = () => {
  const rows = 10;
  const cols = 10;
  const lastFloorRooms = 7;
  const totalRooms = (rows - 1) * cols + lastFloorRooms;

  const [roomCount, setRoomCount] = useState("");
  const [guestName, setGuestName] = useState("");
  const [bookedRooms, setBookedRooms] = useState([]);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/bookings");
      const data = await response.json();
      const rooms = data.flatMap((booking) => booking.rooms);
      setBookedRooms(rooms);
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
    }
  };

  const handleBook = async () => {
    if (!guestName || !roomCount) {
      alert("Please enter guest name and number of rooms.");
      return;
    }

    const payload = {
      guestName,
      numberOfRooms: Number(roomCount),
    };

    try {
      const response = await fetch("http://localhost:3000/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage =
          responseData?.error || responseData?.message || "Booking failed";
        throw new Error(errorMessage);
      }

      await fetchBookings();
      alert("Room booked successfully!");
      setGuestName("");
      setRoomCount("");
    } catch (err) {
      console.error("Booking failed:", err);
      alert(`Booking failed: ${err.message}`);
    }
  };


  const handleRandom = async () => {
    try {
      await fetch("http://localhost:3000/api/generateRandomOccupancy", {
        method: "POST",
      });
      await fetchBookings();
      alert("Random occupancy generated!");
    } catch (err) {
      console.error("Failed to generate random occupancy:", err);
      alert("Error generating occupancy.");
    }
  };

  const resetForm = async () => {
    try {
      await fetch("http://localhost:3000/api/reset", {
        method: "POST",
      });
      setGuestName("");
      setRoomCount("");
      setBookedRooms([]);
      await fetchBookings(); // Refresh UI with updated data
      alert("Reset successful!");
    } catch (err) {
      console.error("Reset failed:", err);
      alert("Failed to reset bookings.");
    }
  };

  const isRoomBooked = (floor, pos) => {
    return bookedRooms.some(
      (room) => room.floor === floor && room.position_on_floor === pos
    );
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          placeholder="Guest Name"
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
        />
        <input
          placeholder="No of Rooms"
          type="number"
          value={roomCount}
          onChange={(e) => setRoomCount(e.target.value)}
        />
        <button onClick={handleBook}>Book</button>
        <button onClick={resetForm}>Reset</button>
        <button onClick={handleRandom}>Random</button>
      </div>

      <div style={{ display: "flex" }}>
        <div
          style={{
            width: "100px",
            border: "1px solid #555",
            height: `${rows * 40}px`,
            marginRight: "10px",
          }}
        ></div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 40px)`,
            gap: "5px",
          }}
        >
          {Array.from({ length: totalRooms }, (_, index) => {
            const floor = Math.floor(index / cols) + 1;
            const position = index % cols;
            const booked = isRoomBooked(floor, position);

            return (
              <div
                key={index}
                style={{
                  width: "40px",
                  height: "30px",
                  border: "1px solid #555",
                  backgroundColor: booked ? "#f44336" : "#4caf50",
                }}
                title={`Floor ${floor}, Pos ${position} - ${booked ? "Booked" : "Available"}`}
              ></div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: "20px" }}>
        <span
          style={{
            display: "inline-block",
            backgroundColor: "#4caf50",
            padding: "5px 10px",
            marginRight: "10px",
            border: "1px solid #555",
          }}
        >
          Available
        </span>
        <span
          style={{
            display: "inline-block",
            backgroundColor: "#f44336",
            padding: "5px 10px",
            border: "1px solid #555",
          }}
        >
          Booked
        </span>
      </div>
    </div>
  );
};

export default RoomBooking;
