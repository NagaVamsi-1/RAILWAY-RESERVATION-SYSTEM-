import { useEffect, useState } from "react";
import { API, request } from "../api";
import { ProgressSteps } from "../components/Layout";
import { navigate } from "../router";
import { trainKey } from "../bookingFlow";

const MAX_PASSENGERS = 6;
const blankPassenger = () => ({ name: "", age: "", gender: "Male" });

// Fare per passenger is decided by the backend at booking time. The public API
// does not expose it before booking, so no estimate is shown here; the exact
// fare appears on the payment page.
export default function PassengerPage({ search, setSearch }) {
  const { selectedTrain, date, travelClass } = search;
  const [availability, setAvailability] = useState(null);
  const [availError, setAvailError] = useState("");
  const [availLoading, setAvailLoading] = useState(false);
  const [passengers, setPassengers] = useState([blankPassenger()]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const trainId = selectedTrain ? trainKey(selectedTrain) : "";

  useEffect(() => {
    if (!trainId || !travelClass) return undefined;
    let cancelled = false;

    (async () => {
      setAvailLoading(true);
      setAvailError("");
      setAvailability(null);
      try {
        const params = new URLSearchParams({ trainId, date, travelClass });
        const data = await request(`${API}/seats/availability?${params.toString()}`);
        if (!cancelled) setAvailability(data);
      } catch (err) {
        if (!cancelled) setAvailError(err.message);
      } finally {
        if (!cancelled) setAvailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trainId, date, travelClass]);

  if (!selectedTrain) {
    return (
      <>
        <ProgressSteps current={1} />
        <div className="empty-state">
          <h3>No train selected</h3>
          <p>Search for a train and choose Select Train &amp; Book to continue.</p>
          <button className="primary-button" type="button" onClick={() => navigate("/")}>
            Search trains
          </button>
        </div>
      </>
    );
  }

  function updatePassenger(index, field, value) {
    setPassengers((current) =>
      current.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`${index}.${field}`];
      return next;
    });
  }

  function validate() {
    const errors = {};
    passengers.forEach((p, i) => {
      const age = Number(p.age);
      if (!p.name.trim()) errors[`${i}.name`] = "Enter the passenger's name.";
      if (p.age === "" || !Number.isInteger(age) || age < 1 || age > 120) {
        errors[`${i}.age`] = "Age must be a whole number from 1 to 120.";
      }
      if (!["Male", "Female", "Other"].includes(p.gender)) {
        errors[`${i}.gender`] = "Select a gender.";
      }
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");

    if (!validate()) {
      setError("Please correct the highlighted passenger details.");
      return;
    }
    if (availability && passengers.length > availability.availableSeats) {
      setError(`Only ${availability.availableSeats} seat(s) are available in ${travelClass}.`);
      return;
    }

    setSubmitting(true);
    try {
      const data = await request(`${API}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainId,
          journeyDate: date,
          travelClass,
          passengers: passengers.map((p) => ({
            name: p.name.trim(),
            age: Number(p.age),
            gender: p.gender,
          })),
        }),
      });

      if (!data.booking?._id) throw new Error("Booking could not be created. Please try again.");
      navigate(`/payment/${data.booking._id}`);
    } catch (err) {
      // Stay on this page and keep everything the user entered.
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ProgressSteps current={1} />

      <section className="content-section booking-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RESERVATION</p>
            <h2>Passenger details</h2>
          </div>
          <span className="result-count">{selectedTrain.number}</span>
        </div>

        <div className="selected-train">
          <h3>{selectedTrain.name}</h3>
          <p>
            {selectedTrain.source} → {selectedTrain.destination} · {date}
            {selectedTrain.departure ? ` · departs ${selectedTrain.departure}` : ""}
            {` · Class ${travelClass}`}
          </p>
        </div>

        <label className="field-label">
          Travel class
          <select
            value={travelClass}
            onChange={(e) => setSearch((c) => ({ ...c, travelClass: e.target.value }))}
          >
            {(selectedTrain.classes || []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <div aria-live="polite">
          {availLoading && <p className="form-hint">Checking seat availability…</p>}
          {availError && <div className="alert error" role="alert">{availError}</div>}
          {availability && (
            <div className="availability-card">
              <div><span>Available seats</span><strong>{availability.availableSeats}</strong></div>
              <div><span>Total seats</span><strong>{availability.totalSeats}</strong></div>
              <div><span>Class</span><strong>{availability.travelClass}</strong></div>
            </div>
          )}
        </div>

        <form className="passenger-form" onSubmit={submit} noValidate>
          <p className="form-hint">
            Add up to six passengers. All passenger details are required. The exact fare is
            confirmed by the booking system and shown on the payment page.
          </p>

          {passengers.map((passenger, index) => (
            <div className="passenger-card" key={index}>
              <div className="passenger-title">
                <strong>Passenger {index + 1}</strong>
                {passengers.length > 1 && (
                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => {
                      setPassengers((c) => c.filter((_, i) => i !== index));
                      setFieldErrors({});
                    }}
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
                    onChange={(e) => updatePassenger(index, "name", e.target.value)}
                    placeholder="Passenger name"
                    maxLength={100}
                    aria-invalid={Boolean(fieldErrors[`${index}.name`])}
                  />
                  {fieldErrors[`${index}.name`] && <small className="field-error">{fieldErrors[`${index}.name`]}</small>}
                </label>
                <label>
                  Age
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={passenger.age}
                    onChange={(e) => updatePassenger(index, "age", e.target.value)}
                    placeholder="Age"
                    aria-invalid={Boolean(fieldErrors[`${index}.age`])}
                  />
                  {fieldErrors[`${index}.age`] && <small className="field-error">{fieldErrors[`${index}.age`]}</small>}
                </label>
                <label>
                  Gender
                  <select
                    value={passenger.gender}
                    onChange={(e) => updatePassenger(index, "gender", e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {fieldErrors[`${index}.gender`] && <small className="field-error">{fieldErrors[`${index}.gender`]}</small>}
                </label>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="secondary-button"
            disabled={passengers.length >= MAX_PASSENGERS}
            onClick={() => setPassengers((c) => [...c, blankPassenger()])}
          >
            Add passenger ({passengers.length}/{MAX_PASSENGERS})
          </button>

          {error && <div className="alert error" role="alert">{error}</div>}

          <div className="button-row form-actions">
            <button type="button" className="secondary-button" disabled={submitting} onClick={() => navigate("/")}>
              ← Back to train search
            </button>
            <button className="primary-button" type="submit" disabled={submitting || availLoading}>
              {submitting ? "Creating booking…" : "Confirm Booking & Continue to Payment"}
            </button>
          </div>
          {passengers.length > 0 && availability && (
            <p className="form-hint">
              {passengers.length} passenger(s) · Seats are held for a limited time after you continue.
            </p>
          )}
        </form>
      </section>
    </>
  );
}
