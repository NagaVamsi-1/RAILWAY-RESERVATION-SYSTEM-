
import { useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

function getToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function App() {
  const [source, setSource] = useState("Bengaluru");
  const [destination, setDestination] = useState("Chennai");
  const [date, setDate] = useState("2026-11-01");
  const [trains, setTrains] = useState([]);
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [travelClass, setTravelClass] = useState("SL");
  const [availability, setAvailability] = useState(null);
  const [passengers, setPassengers] = useState([
    { name: "", age: "", gender: "Male" },
  ]);
  const [booking, setBooking] = useState(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupBooking, setLookupBooking] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function request(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || data.error || "Request failed.");
    }

    return data;
  }

  async function searchTrains(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBooking(null);
    setSelectedTrain(null);
    setAvailability(null);
    setLookupBooking(null);
    setLoading(true);

    try {
      const params = new URLSearchParams({
        source: source.trim(),
        destination: destination.trim(),
        date,
      });

      const data = await request(
        `${API}/trains/search?${params.toString()}`
      );

      setTrains(data.trains || []);
      if (!data.trains?.length) {
        setMessage("No trains found for this route and date.");
      }
    } catch (err) {
      setTrains([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectTrain(train) {
    setSelectedTrain(train);
    setTravelClass(train.classes?.[0] || "SL");
    setAvailability(null);
    setBooking(null);
    setError("");
    setMessage("");
    setPassengers([{ name: "", age: "", gender: "Male" }]);
  }

  async function checkAvailability(className = travelClass) {
    if (!selectedTrain) return;

    setTravelClass(className);
    setAvailability(null);
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const params = new URLSearchParams({
        trainId: String(selectedTrain.number || selectedTrain.id),
        date,
        travelClass: className,
      });

      const data = await request(
        `${API}/seats/availability?${params.toString()}`
      );

      setAvailability(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updatePassenger(index, field, value) {
    setPassengers((current) =>
      current.map((passenger, i) =>
        i === index ? { ...passenger, [field]: value } : passenger
      )
    );
  }

  function addPassenger() {
    if (passengers.length >= 6) return;

    setPassengers((current) => [
      ...current,
      { name: "", age: "", gender: "Male" },
    ]);
  }

  function removePassenger(index) {
    setPassengers((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  async function bookTickets(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBooking(null);
    setLoading(true);

    try {
      if (!selectedTrain) {
        throw new Error("Select a train first.");
      }

      const cleanedPassengers = passengers.map((passenger) => ({
        name: passenger.name.trim(),
        age: Number(passenger.age),
        gender: passenger.gender,
      }));

      if (
        cleanedPassengers.some(
          (passenger) =>
            !passenger.name ||
            !Number.isInteger(passenger.age) ||
            passenger.age < 1 ||
            passenger.age > 120
        )
      ) {
        throw new Error("Enter a valid name and age for every passenger.");
      }

      const data = await request(`${API}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainId: String(selectedTrain.number || selectedTrain.id),
          journeyDate: date,
          travelClass,
          passengers: cleanedPassengers,
        }),
      });

      setBooking(data.booking);
      setAvailability(null);
      setMessage(data.message || "Booking confirmed successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function findBooking(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLookupBooking(null);
    setLoading(true);

    try {
      const data = await request(
        `${API}/bookings/${encodeURIComponent(lookupId.trim())}`
      );
      setLookupBooking(data.booking);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <h1>Railway Reservation</h1>
            <p>Search. Reserve. Travel.</p>
          </div>
        </div>
        <span className="header-label">ONLINE BOOKING</span>
      </header>

      <section className="hero">
        <p className="eyebrow">YOUR JOURNEY STARTS HERE</p>
        <h2>Find your next train.</h2>
        <p>Search routes, check available seats and book your journey.</p>

        <form className="search-form" onSubmit={searchTrains}>
          <label>
            From
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Source station"
              required
            />
          </label>

          <label>
            To
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Destination station"
              required
            />
          </label>

          <label>
            Journey date
            <input
              type="date"
              value={date}
              min={getToday()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Please wait..." : "Search trains"}
          </button>
        </form>
      </section>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AVAILABLE SERVICES</p>
            <h2>Train results</h2>
          </div>
          <span className="result-count">
            {trains.length} {trains.length === 1 ? "train" : "trains"}
          </span>
        </div>

        {trains.length === 0 ? (
          <div className="empty-state">
            <h3>No results to display</h3>
            <p>Enter your route above and search for available trains.</p>
          </div>
        ) : (
          <div className="train-list">
            {trains.map((train) => (
              <article
                className={`train-card ${
                  selectedTrain?.number === train.number ? "selected" : ""
                }`}
                key={train.number || train.id}
              >
                <div className="train-main">
                  <div>
                    <span className="train-number">
                      TRAIN {train.number}
                    </span>
                    <h3>{train.name}</h3>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => selectTrain(train)}
                  >
                    {selectedTrain?.number === train.number
                      ? "Selected"
                      : "View details"}
                  </button>
                </div>

                <div className="route-line">
                  <div>
                    <strong>{train.departure || "--:--"}</strong>
                    <span>{train.source}</span>
                  </div>
                  <div className="route-duration">
                    <span>{train.duration || "Journey"}</span>
                    <div className="route-track" />
                  </div>
                  <div className="route-destination">
                    <strong>{train.arrival || "--:--"}</strong>
                    <span>{train.destination}</span>
                  </div>
                </div>

                <div className="class-list">
                  {(train.classes || []).map((item) => (
                    <span className="class-chip" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedTrain && (
        <section className="content-section booking-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RESERVATION</p>
              <h2>Book your tickets</h2>
            </div>
            <span className="result-count">{selectedTrain.number}</span>
          </div>

          <div className="selected-train">
            <h3>{selectedTrain.name}</h3>
            <p>
              {selectedTrain.source} to {selectedTrain.destination} · {date}
            </p>
          </div>

          <label className="field-label">
            Travel class
            <select
              value={travelClass}
              onChange={(e) => {
                setTravelClass(e.target.value);
                setAvailability(null);
              }}
            >
              {(selectedTrain.classes || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="secondary-button availability-button"
            disabled={loading}
            onClick={() => checkAvailability()}
          >
            Check seat availability
          </button>

          {availability && (
            <div className="availability-card">
              <div>
                <span>Available seats</span>
                <strong>{availability.availableSeats}</strong>
              </div>
              <div>
                <span>Total seats</span>
                <strong>{availability.totalSeats}</strong>
              </div>
              <div>
                <span>Class</span>
                <strong>{availability.travelClass}</strong>
              </div>
            </div>
          )}

          <form className="passenger-form" onSubmit={bookTickets}>
            <h3>Passenger details</h3>
            <p className="form-hint">
              Add up to six passengers. All passenger details are required.
            </p>

            {passengers.map((passenger, index) => (
              <div className="passenger-card" key={index}>
                <div className="passenger-title">
                  <strong>Passenger {index + 1}</strong>
                  {passengers.length > 1 && (
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => removePassenger(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="passenger-fields">
                  <label>
                    Full name
                    <input
                      value={passenger.name}
                      onChange={(e) =>
                        updatePassenger(index, "name", e.target.value)
                      }
                      placeholder="Passenger name"
                      required
                    />
                  </label>

                  <label>
                    Age
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={passenger.age}
                      onChange={(e) =>
                        updatePassenger(index, "age", e.target.value)
                      }
                      placeholder="Age"
                      required
                    />
                  </label>

                  <label>
                    Gender
                    <select
                      value={passenger.gender}
                      onChange={(e) =>
                        updatePassenger(index, "gender", e.target.value)
                      }
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="secondary-button"
              disabled={passengers.length >= 6}
              onClick={addPassenger}
            >
              Add passenger
            </button>

            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Processing..." : "Confirm booking"}
            </button>
          </form>

          {booking && (
            <div className="confirmation-card">
              <p className="eyebrow">BOOKING CONFIRMED</p>
              <h3>Your reservation is successful.</h3>
              <div className="confirmation-details">
                <span>Booking ID</span>
                <strong>{booking._id}</strong>
                <span>Train</span>
                <strong>
                  {booking.trainNumber} · {booking.trainName}
                </strong>
                <span>Journey date</span>
                <strong>{booking.journeyDate?.slice(0, 10) || date}</strong>
                <span>Class</span>
                <strong>{booking.travelClass}</strong>
                <span>Passengers</span>
                <strong>{booking.seatCount}</strong>
                <span>Status</span>
                <strong>{booking.status}</strong>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setLookupId(booking._id);
                  setLookupBooking(booking);
                }}
              >
                View booking details
              </button>
            </div>
          )}
        </section>
      )}

      <section className="content-section lookup-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR RESERVATION</p>
            <h2>Find a booking</h2>
          </div>
        </div>

        <form className="lookup-form" onSubmit={findBooking}>
          <label>
            Booking ID
            <input
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="Enter your booking ID"
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            Find booking
          </button>
        </form>

        {lookupBooking && (
          <div className="confirmation-card lookup-result">
            <h3>Booking details</h3>
            <div className="confirmation-details">
              <span>Booking ID</span>
              <strong>{lookupBooking._id}</strong>
              <span>Train</span>
              <strong>
                {lookupBooking.trainNumber} · {lookupBooking.trainName}
              </strong>
              <span>Route</span>
              <strong>
                {lookupBooking.source} to {lookupBooking.destination}
              </strong>
              <span>Journey date</span>
              <strong>
                {lookupBooking.journeyDate?.slice(0, 10) || "--"}
              </strong>
              <span>Class</span>
              <strong>{lookupBooking.travelClass}</strong>
              <span>Passengers</span>
              <strong>{lookupBooking.seatCount}</strong>
              <span>Status</span>
              <strong>{lookupBooking.status}</strong>
            </div>

            <h4>Passenger list</h4>
            {(lookupBooking.passengers || []).map((passenger, index) => (
              <p key={index}>
                {index + 1}. {passenger.name}, age {passenger.age},{" "}
                {passenger.gender}
              </p>
            ))}
          </div>
        )}
      </section>

      <footer className="site-footer">
        Railway Reservation System · Academic project
      </footer>
    </main>
  );
}
