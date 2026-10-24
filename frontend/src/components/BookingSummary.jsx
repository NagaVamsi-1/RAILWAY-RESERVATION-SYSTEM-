import { formatMoney } from "../api";

export function StatusBadge({ status }) {
  const key = String(status || "").toLowerCase();
  return <span className={`status-badge ${key}`}>{String(status || "").replace("_", " ")}</span>;
}

export default function BookingSummary({ booking }) {
  return (
    <div className="journey-summary">
      <div className="journey-head">
        <div>
          <span className="train-number">TRAIN {booking.trainNumber}</span>
          <h3>{booking.trainName}</h3>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="confirmation-details">
        <span>Route</span>
        <strong>{booking.source} → {booking.destination}</strong>
        <span>Journey date</span>
        <strong>
          {booking.journeyDate?.slice(0, 10)}
          {booking.departure ? ` · departs ${booking.departure}` : ""}
        </strong>
        <span>Class</span>
        <strong>{booking.travelClass}</strong>
        <span>Passengers</span>
        <strong>{booking.seatCount}</strong>
        {booking.farePerPassenger != null && (
          <>
            <span>Fare per passenger</span>
            <strong>{formatMoney(booking.farePerPassenger)}</strong>
          </>
        )}
      </div>
    </div>
  );
}
