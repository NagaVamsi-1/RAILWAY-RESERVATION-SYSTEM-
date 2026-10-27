
import { useState } from "react";
import { API, request } from "../api";
import { ProgressSteps } from "../components/Layout";
import { navigate } from "../router";
import { getToday, trainKey } from "../bookingFlow";

const CITIES = [
  "Bengaluru",
  "Chennai",
  "Mumbai",
  "Delhi",
  "Hyderabad",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Mysuru",
  "Mangaluru",
  "Coimbatore",
  "Kochi",
  "Vijayawada",
  "Visakhapatnam",
];

export default function SearchPage({ search, setSearch }) {
  const { source, destination, date, trains, selectedTrain } = search;

  const [viewedKey, setViewedKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(trains.length > 0);
  const [error, setError] = useState("");

  const patch = (changes) =>
    setSearch((current) => ({ ...current, ...changes }));

  async function searchTrains(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    setViewedKey(null);

    if (source === destination) {
      setError("Departure and destination cities must be different.");
      setLoading(false);
      setSearched(true);
      patch({ trains: [], selectedTrain: null, travelClass: "" });
      return;
    }

    try {
      const params = new URLSearchParams({
        source: source.trim(),
        destination: destination.trim(),
        date,
      });

      const data = await request(
        `${API}/trains/search?${params.toString()}`
      );

      patch({
        trains: data.trains || [],
        selectedTrain: null,
        travelClass: "",
      });
    } catch (err) {
      patch({ trains: [], selectedTrain: null, travelClass: "" });
      setError(err.message || "Unable to search for trains.");
    } finally {
      setSearched(true);
      setLoading(false);
    }
  }

  function changeSource(value) {
    patch({
      source: value,
      ...(value === destination
        ? { destination: CITIES.find((city) => city !== value) || "" }
        : {}),
    });
  }

  function toggleDetails(key) {
    setViewedKey((current) => (current === key ? null : key));
  }

  function selectAndBook(event, train, travelClass) {
    event.stopPropagation();
    patch({ selectedTrain: train, travelClass });
    navigate("/passengers");
  }

  return (
    <>
      <ProgressSteps current={0} />

      <section className="hero">
        <p className="eyebrow">YOUR JOURNEY STARTS HERE</p>
        <h2>Find your next train.</h2>
        <p>
          Compare train timings, explore available classes and choose your
          journey.
        </p>

        <form className="search-form" onSubmit={searchTrains}>
          <label>
            From
            <select
              value={source}
              onChange={(event) => changeSource(event.target.value)}
              required
            >
              <option value="">Select departure city</option>
              {CITIES.map((city) => (
                <option value={city} key={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label>
            To
            <select
              value={destination}
              onChange={(event) => patch({ destination: event.target.value })}
              required
            >
              <option value="">Select destination city</option>
              {CITIES.map((city) => (
                <option
                  value={city}
                  key={city}
                  disabled={city === source}
                >
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label className="date-field">
            Journey date
            <span className="date-input-wrap">
              <input
                id="journey-date"
                type="date"
                value={date}
                min={getToday()}
                onChange={(event) => patch({ date: event.target.value })}
                required
              />

              <button
                className="calendar-button"
                type="button"
                aria-label="Open journey date calendar"
                onClick={(event) => {
                  event.stopPropagation();
                  const input = document.getElementById("journey-date");

                  if (input?.showPicker) {
                    input.showPicker();
                  } else {
                    input?.focus();
                    input?.click();
                  }
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 10h18" />
                  <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
                </svg>
              </button>
            </span>
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search trains"}
          </button>
        </form>
      </section>

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}

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
            <p>Searching for trains...</p>
          </div>
        ) : trains.length === 0 ? (
          <div className="empty-state">
            <h3>
              {searched && !error
                ? "No trains found"
                : "No results to display"}
            </h3>
            <p>
              {searched && !error
                ? "No trains found for this route and date. Try another date or route."
                : "Select your departure city, destination and journey date to search."}
            </p>
          </div>
        ) : (
          <div className="train-list">
            {trains.map((train) => {
              const key = trainKey(train);
              const isViewed = viewedKey === key;
              const isSelected = trainKey(selectedTrain) === key;
              const classes = train.classes || [];

              return (
                <article
                  className={`train-card clickable-train-card ${
                    isSelected ? "selected" : ""
                  }`}
                  key={key}
                  onClick={() => toggleDetails(key)}
                  onKeyDown={(event) => {
                    if (
                      event.target !== event.currentTarget ||
                      (event.key !== "Enter" && event.key !== " ")
                    ) {
                      return;
                    }

                    event.preventDefault();
                    toggleDetails(key);
                  }}
                  tabIndex={0}
                  aria-label={`${train.name || "Train"} details. Click to ${
                    isViewed ? "hide" : "view"
                  } details.`}
                >
                  <div className="train-main">
                    <div>
                      <span className="train-number">
                        TRAIN {train.number || train.id}
                      </span>
                      <h3>{train.name || "Train name unavailable"}</h3>
                    </div>

                    <button
                      className="secondary-button"
                      type="button"
                      aria-expanded={isViewed}
                      aria-controls={`details-${key}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleDetails(key);
                      }}
                    >
                      {isViewed ? "Hide details" : "View details"}
                    </button>
                  </div>

                  <div className="route-line">
                    <div>
                      <strong>{train.departure || "--:--"}</strong>
                      <span>{train.source || source}</span>
                    </div>

                    <div className="route-duration">
                      <span>{train.duration || "Duration unavailable"}</span>
                      <div className="route-track" />
                    </div>

                    <div className="route-destination">
                      <strong>{train.arrival || "--:--"}</strong>
                      <span>{train.destination || destination}</span>
                    </div>
                  </div>

                  <div className="details-class-section">
                    <h4>Available travel classes</h4>

                    {classes.length > 0 ? (
                      <div className="class-list">
                        {classes.map((item) => (
                          <span className="class-chip" key={item}>
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="detail-unavailable">
                        Class information is not available.
                      </p>
                    )}
                  </div>

                  {isViewed && (
                    <div className="train-details" id={`details-${key}`}>
                      <h4>Train details</h4>

                      <div className="train-details-grid">
                        <p>
                          <strong>Train number</strong>
                          <span>
                            {train.number || train.id || "Not available"}
                          </span>
                        </p>
                        <p>
                          <strong>Train name</strong>
                          <span>{train.name || "Not available"}</span>
                        </p>
                        <p>
                          <strong>Origin</strong>
                          <span>{train.source || "Not available"}</span>
                        </p>
                        <p>
                          <strong>Destination</strong>
                          <span>{train.destination || "Not available"}</span>
                        </p>
                        <p>
                          <strong>Departure</strong>
                          <span>{train.departure || "Not available"}</span>
                        </p>
                        <p>
                          <strong>Arrival</strong>
                          <span>{train.arrival || "Not available"}</span>
                        </p>
                        <p>
                          <strong>Journey duration</strong>
                          <span>{train.duration || "Not available"}</span>
                        </p>
                        <p>
                          <strong>Journey date</strong>
                          <span>{date || "Not available"}</span>
                        </p>
                      </div>

                      <div className="details-class-section">
                        <h4>Choose a travel class</h4>

                        {classes.length > 0 ? (
                          <div className="details-class-options">
                            {classes.map((item) => (
                              <div className="details-class-option" key={item}>
                                <div>
                                  <strong>{item}</strong>
                                  <span>Travel class</span>
                                </div>

                                <button
                                  className="primary-button"
                                  type="button"
                                  onClick={(event) =>
                                    selectAndBook(event, train, item)
                                  }
                                >
                                  Select class
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="detail-unavailable">
                            No travel classes are listed for this train.
                          </p>
                        )}
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
