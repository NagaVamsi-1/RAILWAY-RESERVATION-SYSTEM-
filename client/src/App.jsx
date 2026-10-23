
import { useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5050/api/trains/search";

function App() {
  const [source, setSource] = useState("Bengaluru");
  const [destination, setDestination] = useState("Chennai");
  const [date, setDate] = useState("");
  const [trains, setTrains] = useState([]);
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function swapStations() {
    setSource(destination);
    setDestination(source);
    setTrains([]);
    setSelectedTrain(null);
    setMessage("");
  }

  async function searchTrains(event) {
    event.preventDefault();
    setMessage("");
    setTrains([]);
    setSelectedTrain(null);

    if (!source.trim() || !destination.trim() || !date) {
      setMessage("Please enter source, destination and journey date.");
      return;
    }

    if (source.trim().toLowerCase() === destination.trim().toLowerCase()) {
      setMessage("Source and destination must be different.");
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        source: source.trim(),
        destination: destination.trim(),
        date,
      });

      const response = await fetch(`${API_URL}?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to search trains.");
      }

      setTrains(data.trains || []);

      if (!data.trains || data.trains.length === 0) {
        setMessage("No trains found for your selected journey.");
      }
    } catch (error) {
      setMessage(
        error.message === "Failed to fetch"
          ? "Unable to connect to the server. Make sure the backend is running."
          : error.message || "Something went wrong while searching."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-logo" aria-label="Railway logo">
            <svg
              viewBox="0 0 48 48"
              width="48"
              height="48"
              fill="none"
              aria-hidden="true"
            >
              <rect width="48" height="48" rx="10" fill="#174A80" />
              <rect
                x="11"
                y="7"
                width="26"
                height="25"
                rx="7"
                fill="#FFFFFF"
              />
              <rect
                x="15"
                y="11"
                width="18"
                height="10"
                rx="2"
                fill="#8EC5F4"
              />
              <path d="M15 26H33" stroke="#174A80" strokeWidth="3" />
              <path
                d="M17 32L12 40M31 32L36 40"
                stroke="#FFFFFF"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M13 40H35"
                stroke="#FFFFFF"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div>
            <h1>Railway Reservation</h1>
            <p>Find your next journey</p>
          </div>
        </div>

        <span className="status">TRAIN SEARCH</span>
      </header>

      <section className="hero">
        <p className="eyebrow">YOUR JOURNEY STARTS HERE</p>
        <h2>Where would you like to go?</h2>
        <p className="subtitle">
          Search trains, compare timings and explore available travel classes.
        </p>

        <form className="search-form" onSubmit={searchTrains}>
          <label>
            From
            <input
              type="text"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Source station"
              required
            />
          </label>

          <button
            type="button"
            className="swap-button"
            title="Swap source and destination"
            aria-label="Swap source and destination"
            onClick={swapStations}
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 7h13l-3-3" />
              <path d="m20 7-3 3" />
              <path d="M17 17H4l3 3" />
              <path d="m4 17 3-3" />
            </svg>
          </button>

          <label>
            To
            <input
              type="text"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Destination station"
              required
            />
          </label>

          <label>
            Journey date
            <input
              type="date"
              value={date}
              min={new Date().toLocaleDateString("en-CA")}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>

          <button
            className="search-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Searching..." : "Search trains"}
          </button>
        </form>
      </section>

      <section className="results">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR OPTIONS</p>
            <h2>Available trains</h2>
          </div>

          <span className="count">
            {trains.length} {trains.length === 1 ? "train" : "trains"}
          </span>
        </div>

        {message && (
          <p className="message" role="status">
            {message}
          </p>
        )}

        {!message && trains.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">
              ↗
            </div>
            <h3>Ready when you are</h3>
            <p>Enter your journey details above to see matching trains.</p>
          </div>
        )}

        <div className="train-list">
          {trains.map((train) => (
            <article className="train-card" key={train.id}>
              <div className="train-top">
                <div>
                  <h3>{train.name}</h3>
                  <p className="train-number">Train no. {train.number}</p>
                </div>

                <span className="route-tag">
                  {train.source} → {train.destination}
                </span>
              </div>

              <div className="journey-times">
                <div>
                  <strong>{train.departure}</strong>
                  <span>{train.source}</span>
                </div>

                <div className="duration">
                  <span>{train.duration}</span>
                  <div className="route-line" />
                </div>

                <div className="arrival">
                  <strong>{train.arrival}</strong>
                  <span>{train.destination}</span>
                </div>
              </div>

              <button
                type="button"
                className="details-button"
                onClick={() =>
                  setSelectedTrain(
                    selectedTrain?.id === train.id ? null : train
                  )
                }
              >
                {selectedTrain?.id === train.id
                  ? "Hide details"
                  : "View train details"}
              </button>

              {selectedTrain?.id === train.id && (
                <div className="details-panel">
                  <h4>Travel classes</h4>

                  <div className="class-list">
                    {(train.classes || []).map((travelClass) => (
                      <span className="class-chip" key={travelClass}>
                        {travelClass}
                      </span>
                    ))}
                  </div>

                  <p>Journey date: {date}</p>
                  <p className="sample-note">
                    Sample data for project testing. Live train schedules and
                    seat availability are not connected yet.
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <footer>
        Railway Reservation System · Software Engineering Mini-Project
      </footer>
    </main>
  );
}

export default App;
