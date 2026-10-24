import { useState } from "react";
import PaymentPanel from "../components/PaymentPanel";
import BookingSummary from "../components/BookingSummary";
import { ProgressSteps } from "../components/Layout";
import { useBooking } from "../useBooking";
import { navigate } from "../router";

function Notice({ title, children, action }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export default function PaymentPage({ bookingId, onBookAgain }) {
  const { booking, loading, error, reload } = useBooking(bookingId);
  const [paidMessage, setPaidMessage] = useState("");

  const searchAgain = (
    <button className="primary-button" type="button" onClick={onBookAgain}>
      Search trains &amp; book again
    </button>
  );

  function handlePaid(confirmed, message) {
    // Only proceed if the backend returned a confirmed booking with a PNR.
    if (confirmed?.status === "CONFIRMED" && confirmed?.pnr) {
      setPaidMessage(message || "");
      navigate(`/confirmation/${confirmed._id}`);
    } else {
      reload();
    }
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
      <Notice title="Booking not found" action={searchAgain}>
        {error || "We could not load this booking."}
      </Notice>
    );
  } else if (booking.status === "CONFIRMED") {
    body = (
      <Notice
        title="Already paid"
        action={
          <button className="primary-button" type="button" onClick={() => navigate(`/confirmation/${booking._id}`)}>
            View confirmation
          </button>
        }
      >
        This booking has already been paid and confirmed.
      </Notice>
    );
  } else if (booking.status === "EXPIRED") {
    body = (
      <Notice title="Seat hold expired" action={searchAgain}>
        The payment window for this booking has expired and the seats were released. Please search
        and book again.
      </Notice>
    );
  } else if (booking.status === "CANCELLED") {
    body = (
      <Notice title="Booking cancelled" action={searchAgain}>
        This booking has been cancelled and cannot be paid.
      </Notice>
    );
  } else {
    body = (
      <section className="content-section booking-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PAYMENT</p>
            <h2>Review &amp; pay</h2>
          </div>
        </div>
        <BookingSummary booking={booking} />
        <PaymentPanel
          key={booking._id}
          booking={booking}
          onPaid={handlePaid}
          onExpired={reload}
          onSearchAgain={onBookAgain}
        />
        {paidMessage && <div className="alert success">{paidMessage}</div>}
        <p className="form-hint payment-leave-hint">
          Your seats are held until the timer ends. There is no step back from here because going
          back would leave these seats held and create a second booking. If you leave, the hold
          releases automatically when the timer runs out.
        </p>
      </section>
    );
  }

  return (
    <>
      <ProgressSteps current={2} />
      {body}
    </>
  );
}
