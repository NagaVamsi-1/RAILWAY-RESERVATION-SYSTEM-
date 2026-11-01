import { useEffect, useState } from "react";
import { API, request } from "../api";
import { ProgressSteps } from "../components/Layout";
import { navigate } from "../router";
import { trainKey } from "../bookingFlow";
import { useI18n } from "../i18n/useI18n";

const MAX_PASSENGERS = 6;
const blankPassenger = () => ({ name: "", age: "", gender: "Male" });

// Fare per passenger is decided by the backend at booking time. The public API
// does not expose it before booking, so no estimate is shown here; the exact
// fare appears on the payment page.
export default function PassengerPage({ search, setSearch }) {
  const { t, city } = useI18n();
  const { selectedTrain, date, travelClass } = search;
  const [availability, setAvailability] = useState(null);
  const [availError, setAvailError] = useState("");
  const [availLoading, setAvailLoading] = useState(false);
  const [passengers, setPassengers] = useState([blankPassenger()]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Bumped to load the seat availability again (for example after the server says it changed).
  const [refreshKey, setRefreshKey] = useState(0);

  const trainId = selectedTrain ? trainKey(selectedTrain) : "";

  // BL-14: when the class cannot seat everyone, the passenger may join the waitlist instead.
  const waitlistMode = Boolean(availability) && passengers.length > availability.availableSeats;
  const waitlistRoom = availability?.waitlistSeatsRemaining ?? 0;
  const waitlistFull = waitlistMode && waitlistRoom < passengers.length;

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
  }, [trainId, date, travelClass, refreshKey]);

  if (!selectedTrain) {
    return (
      <>
        <ProgressSteps current={1} />
        <div className="empty-state">
          <h3>{t("passenger.noTrain")}</h3>
          <p>{t("passenger.noTrainText")}</p>
          <button className="primary-button" type="button" onClick={() => navigate("/")}>
            {t("common.searchTrains")}
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
      if (!p.name.trim()) errors[`${i}.name`] = t("passenger.errName");
      if (p.age === "" || !Number.isInteger(age) || age < 1 || age > 120) {
        errors[`${i}.age`] = t("passenger.errAge");
      }
      if (!["Male", "Female", "Other"].includes(p.gender)) {
        errors[`${i}.gender`] = t("passenger.errGender");
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
      setError(t("passenger.errFix"));
      return;
    }
    if (waitlistFull) {
      setError(t("passenger.waitlistFull", { count: passengers.length }));
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
          // Only asks for a waitlist place when the class cannot seat everyone.
          ...(waitlistMode ? { joinWaitlist: true } : {}),
          passengers: passengers.map((p) => ({
            name: p.name.trim(),
            age: Number(p.age),
            gender: p.gender,
          })),
        }),
      });

      if (!data.booking?._id) throw new Error(t("passenger.errCreate"));
      navigate(`/payment/${data.booking._id}`);
    } catch (err) {
      // Stay on this page and keep everything the user entered.
      setError(err.message);
      // The seat count changed since the page loaded: show the current numbers.
      if (err.status === 409) setRefreshKey((key) => key + 1);
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
            <p className="eyebrow">{t("passenger.eyebrow")}</p>
            <h2>{t("passenger.title")}</h2>
          </div>
          <span className="result-count">{selectedTrain.number}</span>
        </div>

        <div className="selected-train">
          <h3>{selectedTrain.name}</h3>
          <p>
            {city(selectedTrain.source)} → {city(selectedTrain.destination)} · {date}
            {selectedTrain.departure
              ? ` · ${t("common.departs", { time: selectedTrain.departure })}`
              : ""}
            {` · ${t("passenger.classLabel", { class: travelClass })}`}
          </p>
        </div>

        <label className="field-label">
          {t("passenger.travelClass")}
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
          {availLoading && <p className="form-hint">{t("passenger.checking")}</p>}
          {availError && <div className="alert error" role="alert">{availError}</div>}
          {availability && (
            <div className="availability-card">
              <div><span>{t("passenger.availableSeats")}</span><strong>{availability.availableSeats}</strong></div>
              <div><span>{t("passenger.totalSeats")}</span><strong>{availability.totalSeats}</strong></div>
              <div><span>{t("passenger.class")}</span><strong>{availability.travelClass}</strong></div>
            </div>
          )}

          {waitlistMode && (
            <div className="waitlist-offer" role="note">
              <h4>{t("passenger.waitlistTitle")}</h4>
              <p>
                {t("passenger.waitlistText", {
                  available: availability.availableSeats,
                  count: passengers.length,
                })}
              </p>
              <p className="waitlist-room">
                {waitlistFull
                  ? t("passenger.waitlistFull", { count: passengers.length })
                  : t("passenger.waitlistRoom", { count: waitlistRoom })}
              </p>
            </div>
          )}
        </div>

        <form className="passenger-form" onSubmit={submit} noValidate>
          <p className="form-hint">{t("passenger.hint")}</p>

          {passengers.map((passenger, index) => (
            <div className="passenger-card" key={index}>
              <div className="passenger-title">
                <strong>{t("passenger.number", { index: index + 1 })}</strong>
                {passengers.length > 1 && (
                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => {
                      setPassengers((c) => c.filter((_, i) => i !== index));
                      setFieldErrors({});
                    }}
                  >
                    {t("passenger.remove")}
                  </button>
                )}
              </div>

              <div className="passenger-fields">
                <label>
                  {t("passenger.fullName")}
                  <input
                    value={passenger.name}
                    onChange={(e) => updatePassenger(index, "name", e.target.value)}
                    placeholder={t("passenger.namePlaceholder")}
                    maxLength={100}
                    aria-invalid={Boolean(fieldErrors[`${index}.name`])}
                  />
                  {fieldErrors[`${index}.name`] && <small className="field-error">{fieldErrors[`${index}.name`]}</small>}
                </label>
                <label>
                  {t("passenger.age")}
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={passenger.age}
                    onChange={(e) => updatePassenger(index, "age", e.target.value)}
                    placeholder={t("passenger.agePlaceholder")}
                    aria-invalid={Boolean(fieldErrors[`${index}.age`])}
                  />
                  {fieldErrors[`${index}.age`] && <small className="field-error">{fieldErrors[`${index}.age`]}</small>}
                </label>
                <label>
                  {t("passenger.gender")}
                  <select
                    value={passenger.gender}
                    onChange={(e) => updatePassenger(index, "gender", e.target.value)}
                  >
                    <option value="Male">{t("gender.Male")}</option>
                    <option value="Female">{t("gender.Female")}</option>
                    <option value="Other">{t("gender.Other")}</option>
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
            {t("passenger.add", { count: passengers.length, max: MAX_PASSENGERS })}
          </button>

          {error && <div className="alert error" role="alert">{error}</div>}

          <div className="button-row form-actions">
            <button type="button" className="secondary-button" disabled={submitting} onClick={() => navigate("/")}>
              {t("passenger.back")}
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={submitting || availLoading || waitlistFull}
            >
              {submitting
                ? t("passenger.submitting")
                : waitlistMode
                  ? t("passenger.waitlistSubmit")
                  : t("passenger.submit")}
            </button>
          </div>
          {passengers.length > 0 && availability && (
            <p className="form-hint">
              {t(waitlistMode ? "passenger.waitlistHoldHint" : "passenger.holdHint", {
                count: passengers.length,
              })}
            </p>
          )}
        </form>
      </section>
    </>
  );
}
