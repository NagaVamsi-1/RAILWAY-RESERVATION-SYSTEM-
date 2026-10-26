import { useState } from "react";
import { formatMoney } from "../api";
import BookingSummary from "../components/BookingSummary";
import { ProgressSteps } from "../components/Layout";
import { useBooking } from "../useBooking";
import { navigate } from "../router";

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy copy */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export default function ConfirmationPage({ bookingId, onBookAgain }) {
  const { booking, loading, error } = useBooking(bookingId);
  const [copyState, setCopyState] = useState("");

  async function copyPnr() {
    const ok = await copyText(booking.pnr);
    setCopyState(ok ? "PNR copied." : "Copy failed. Please select the PNR and copy it manually.");
    setTimeout(() => setCopyState(""), 3000);
  }

  let body;
  if (loading) {
    body = (
      <div className="empty-state" role="status">
        <div className="spinner" aria-hidden="true" />
        <p>Loading your booking…</p>
      </div>
    );
  } else if (error || !booking) {
    body = (
      <div className="empty-state">
        <h3>Booking not found</h3>
        <p>{error || "We could not load this booking."}</p>
        <button className="primary-button" type="button" onClick={onBookAgain}>Search trains</button>
      </div>
    );
  } else if (booking.status === "PENDING_PAYMENT") {
    body = (
      <div className="empty-state">
        <h3>Payment not completed</h3>
        <p>This booking is not confirmed yet. Complete the payment to receive a PNR.</p>
        <button className="primary-button" type="button" onClick={() => navigate(`/payment/${booking._id}`)}>
          Go to payment
        </button>
      </div>
    );
  } else if (booking.status !== "CONFIRMED" && booking.status !== "CANCELLED") {
    body = (
      <div className="empty-state">
        <h3>Booking {booking.status.toLowerCase()}</h3>
        <p>This booking is not confirmed, so there is no ticket to show.</p>
        <button className="primary-button" type="button" onClick={onBookAgain}>Search trains</button>
      </div>
    );
  } else if (!booking.pnr) {
    body = (
      <div className="empty-state">
        <h3>PNR not available</h3>
        <p>The booking has no PNR yet. Please check again shortly or contact support.</p>
      </div>
    );
  } else {
    body = (
      <section className="ticket-card status-confirmed-card" aria-labelledby="confirm-title">
        <div className={`ticket-banner ${booking.status === "CANCELLED" ? "cancelled" : ""}`}>
          <span className="success-icon" aria-hidden="true">{booking.status === "CANCELLED" ? "✕" : "✓"}</span>
          <div>
            <h2 id="confirm-title">
              {booking.status === "CANCELLED" ? "This booking was cancelled" : "Booking confirmed"}
            </h2>
            <p>
              {booking.status === "CANCELLED"
                ? "The ticket below has been cancelled."
                : "Your payment was successful and your seats are reserved."}
            </p>
          </div>
        </div>

        <div className="pnr-block">
          <div>
            <p className="eyebrow">YOUR PNR</p>
            <p className="pnr-number big" aria-label={`PNR ${booking.pnr.split("").join(" ")}`}>{booking.pnr}</p>
          </div>
          <button type="button" className="secondary-button" onClick={copyPnr}>Copy PNR</button>
        </div>
        <p className="copy-status" role="status">{copyState}</p>

        <BookingSummary booking={booking} />

        <h4>Passengers ({booking.seatCount})</h4>
        <ul className="passenger-list">
          {(booking.passengers || []).map((p, i) => (
            <li key={i}>{i + 1}. {p.name}, age {p.age}, {p.gender}</li>
          ))}
        </ul>

        <div className="confirmation-details">
          <span>Total amount paid</span>
          <strong>{formatMoney(booking.payment?.amount ?? booking.totalAmount)}</strong>
          {booking.payment && (
            <>
              <span>Payment method</span>
              <strong>{booking.payment.method} · {booking.payment.maskedReference}</strong>
              <span>Payment reference</span>
              <strong>{booking.payment.paymentId}</strong>
              <span>Payment status</span>
              <strong>{booking.payment.status}</strong>
            </>
          )}
          <span>Booking status</span>
          <strong>{booking.status}</strong>
        </div>

        <div className="button-row">
          <button type="button" className="primary-button" onClick={() => navigate(`/pnr?pnr=${booking.pnr}`)}>
            View / Manage Booking
          </button>
          <button type="button" className="secondary-button" onClick={onBookAgain}>
            Book Another Journey
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <ProgressSteps current={3} />
      {body}
    </>
  );
}
