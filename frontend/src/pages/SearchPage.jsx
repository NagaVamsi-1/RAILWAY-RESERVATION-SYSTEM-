import { useState } from "react";
import { API, request } from "../api";
import { ProgressSteps } from "../components/Layout";
import { navigate } from "../router";
import { getToday, trainKey } from "../bookingFlow";

export default function SearchPage({ search, setSearch }) {
  const { source, destination, date, trains, selectedTrain } = search;
  const [viewedKey, setViewedKey] = useState(null); // View Details only expands; never selects
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(trains.length > 0);
  const [error, setError] = useState("");

  const patch = (changes) => setSearch((current) => ({ ...current, ...changes }));

  async function searchTrains(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    setViewedKey(null);

    try {
      const params = new URLSearchParams({
        source: source.trim(),
        destination: destination.trim(),
        date,
      });
      const data = await request(`${API}/trains/search?${params.toString()}`);
      patch({ trains: data.trains || [], selectedTrain: null, travelClass: "" });
    } catch (err) {
      patch({ trains: [], selectedTrain: null });
      setError(err.message);
    } finally {
      setSearched(true);
      setLoading(false);
    }
  }

  function selectAndBook(train) {
    patch({ selectedTrain: train, travelClass: train.classes?.[0] || "" });
    navigate("/passengers");
  }

  return (
    <>
      <ProgressSteps current={0} />

      <section className="hero">
        <p className="eyebrow">YOUR JOURNEY STARTS HERE</p>
        <h2>Find your next train.</h2>
        <p>Search routes, check available seats and book your journey.</p>

        <form className="search-form" onSubmit={searchTrains}>
          <label>
            From
            <input
              value={source}
              onChange={(e) => patch({ source: e.target.value })}
              placeholder="Source station"
              required
            />
          </label>
          <label>
            To
            <input
              value={destination}
              onChange={(e) => patch({ destination: e.target.value })}
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
              onChange={(e) => patch({ date: e.target.value })}
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search trains"}
          </button>
        </form>
      </section>

      {error && <div className="alert error" role="alert">{error}</div>}

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

        {loading ? (
          <div className="empty-state" role="status">
            <div className="spinner" aria-hidden="true" />
            <p>Searching for trains…</p>
          </div>
        ) : trains.length === 0 ? (
          <div className="empty-state">
            <h3>{searched && !error ? "No trains found" : "No results to display"}</h3>
            <p>
              {searched && !error
                ? "No trains found for this route and date. Try different stations or another date."
                : "Enter your route above and search for available trains."}
            </p>
          </div>
        ) : (
          <div className="train-list">
            {trains.map((train) => {
              const key = trainKey(train);
              const isViewed = viewedKey === key;
              const isSelected = trainKey(selectedTrain) === key;

              return (
                <article className={`train-card ${isSelected ? "selected" : ""}`} key={key}>
                  <div className="train-main">
                    <div>
                      <span className="train-number">TRAIN {train.number}</span>
                      <h3>{train.name}</h3>
                    </div>
                    <div className="train-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        aria-expanded={isViewed}
                        onClick={() => setViewedKey(isViewed ? null : key)}
                      >
                        {isViewed ? "Hide details" : "View details"}
                      </button>
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => selectAndBook(train)}
                      >
                        Select Train &amp; Book
                      </button>
                    </div>
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
                      <span className="class-chip" key={item}>{item}</span>
                    ))}
                  </div>

                  {isViewed && (
                    <div className="train-details">
                      <h4>Train information</h4>
                      <div className="train-details-grid">
                        <p><strong>Train number:</strong> {train.number || train.id || "Not available"}</p>
                        <p><strong>Train name:</strong> {train.name || "Not available"}</p>
                        <p><strong>From:</strong> {train.source || "Not available"}</p>
                        <p><strong>To:</strong> {train.destination || "Not available"}</p>
                        <p><strong>Departure:</strong> {train.departure || "Not available"}</p>
                        <p><strong>Arrival:</strong> {train.arrival || "Not available"}</p>
                        <p><strong>Duration:</strong> {train.duration || "Not available"}</p>
                        <p><strong>Available classes:</strong> {(train.classes || []).join(", ") || "Not available"}</p>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
