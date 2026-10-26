import { useEffect, useState } from "react";
import { API, request, formatMoney } from "../api";
import "./payment.css";

function formatLeadTime(hours) {
  if (hours >= 48) return `${Math.round(hours / 24)} days`;
  return `${Math.round(hours)} hours`;
}

// BL-12 – View booking confirmation by PNR (UC-05)
// BL-13 – Cancel ticket and see refund status (UC-06)
export default function PnrLookup({ initialBooking = null, initialPnr = "" }) {
  const [pnr, setPnr] = useState(initialBooking?.pnr || initialPnr || "");
  const [booking, setBooking] = useState(initialBooking);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function lookup(value) {
    setError("");
    setMessage("");
    setPreview(null);
    setBooking(null);

    if (!/^[1-9]\d{9}$/.test(value)) {
      setError("Enter a valid 10-digit PNR number.");
      return;
    }

    setLoading(true);
    try {
      const data = await request(`${API}/bookings/pnr/${encodeURIComponent(value)}`);
      setBooking(data.booking);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function findBooking(event) {
    event.preventDefault();
    lookup(pnr.trim());
  }

  // Prefilled PNR (e.g. from the confirmation page): look it up straight away.
  useEffect(() => {
    if (initialPnr && !initialBooking) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      lookup(initialPnr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCancel() {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const data = await request(`${API}/bookings/pnr/${booking.pnr}/refund-preview`);
      setPreview(data.refund);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmCancel() {
    setError("");
    setLoading(true);

    try {
      const data = await request(`${API}/bookings/pnr/${booking.pnr}/cancel`, {
        method: "POST",
      });
      setBooking(data.booking);
      setPreview(null);
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="content-section lookup-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR RESERVATION</p>
          <h2>Booking details &amp; cancellation</h2>
        </div>
      </div>

      <form className="lookup-form" onSubmit={findBooking}>
        <label>
          PNR number
          <input
            value={pnr}
            onChange={(e) => setPnr(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            placeholder="Enter your 10-digit PNR"
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading && !preview ? "Searching…" : "Find Booking"}
        </button>
      </form>

      {error && <div className="alert error" role="alert">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {booking && (
        <div className={`confirmation-card lookup-result status-${booking.status.toLowerCase()}`}>
          <div className="pnr-header">
            <div>
              <p className="eyebrow">PNR</p>
              <p className="pnr-number">{booking.pnr}</p>
            </div>
            <span className={`status-badge ${booking.status.toLowerCase()}`}>
              {booking.status.replace("_", " ")}
            </span>
          </div>

          <div className="confirmation-details">
            <span>Train</span>
            <strong>
              {booking.trainNumber} · {booking.trainName}
            </strong>
            <span>Route</span>
            <strong>
              {booking.source} to {booking.destination}
            </strong>
            <span>Journey date</span>
            <strong>
              {booking.journeyDate?.slice(0, 10)} · departs {booking.departure}
            </strong>
            <span>Class</span>
            <strong>{booking.travelClass}</strong>
            <span>Passengers</span>
            <strong>{booking.seatCount}</strong>
            <span>Amount paid</span>
            <strong>{formatMoney(booking.payment?.amount ?? booking.totalAmount)}</strong>
            {booking.payment && (
              <>
                <span>Payment</span>
                <strong>
                  {booking.payment.method} · {booking.payment.maskedReference}
                  <br />
                  Ref {booking.payment.paymentId}
                </strong>
              </>
            )}
          </div>

          <h4>Passenger list</h4>
          {(booking.passengers || []).map((passenger, index) => (
            <p key={index}>
              {index + 1}. {passenger.name}, age {passenger.age}, {passenger.gender}
            </p>
          ))}

          {booking.refund && (
            <div className="refund-box">
              <h4>Cancellation &amp; refund</h4>
              <div className="confirmation-details">
                <span>Cancelled on</span>
                <strong>{new Date(booking.cancelledAt).toLocaleString()}</strong>
                <span>Refund status</span>
                <strong>
                  {booking.refund.status === "PROCESSED" ? "Refund processed" : "No refund applicable"}
                </strong>
                <span>Refund amount</span>
                <strong>
                  {formatMoney(booking.refund.amount)} ({booking.refund.percentage}%)
                </strong>
                <span>Cancellation charge</span>
                <strong>{formatMoney(booking.refund.deduction)}</strong>
                {booking.refund.status === "PROCESSED" && (
                  <>
                    <span>Refund reference</span>
                    <strong>{booking.refund.refundId}</strong>
                  </>
                )}
              </div>
            </div>
          )}

          {booking.status === "CONFIRMED" && !preview && (
            <button
              type="button"
              className="danger-button"
              disabled={loading}
              onClick={startCancel}
            >
              Cancel ticket
            </button>
          )}

          {preview && (
            <div className="refund-box warning">
              <h4>Confirm cancellation</h4>
              <p>
                The train departs in about {formatLeadTime(preview.hoursBeforeDeparture)}, so{" "}
                <strong>{preview.percentage}%</strong> of the fare is refundable.
              </p>
              <div className="confirmation-details">
                <span>Ticket amount</span>
                <strong>{formatMoney(preview.totalAmount)}</strong>
                <span>Cancellation charge</span>
                <strong>{formatMoney(preview.deduction)}</strong>
                <span>You will receive</span>
                <strong>{formatMoney(preview.refundAmount)}</strong>
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className="danger-button"
                  disabled={loading}
                  onClick={confirmCancel}
                >
                  {loading ? "Cancelling..." : "Yes, cancel ticket"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={loading}
                  onClick={() => setPreview(null)}
                >
                  Keep ticket
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
