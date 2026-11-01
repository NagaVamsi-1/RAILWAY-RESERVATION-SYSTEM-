import { useEffect, useState } from "react";
import { API, request, formatMoney } from "../api";
import { navigate } from "../router";
import { useI18n } from "../i18n/useI18n";
import { StatusBadge } from "./BookingSummary";
import "./payment.css";

function formatLeadTime(hours, t) {
  if (hours >= 48) return t("common.days", { count: Math.round(hours / 24) });
  return t("common.hours", { count: Math.round(hours) });
}

// BL-12 – View booking confirmation by PNR (UC-05)
// BL-13 – Cancel ticket and see refund status (UC-06)
export default function PnrLookup({ initialBooking = null, initialPnr = "" }) {
  const { t, city, lang } = useI18n();
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
      setError(t("pnr.invalid"));
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
          <p className="eyebrow">{t("pnr.eyebrow")}</p>
          <h2>{t("pnr.title")}</h2>
        </div>
      </div>

      <form className="lookup-form" onSubmit={findBooking}>
        <label>
          {t("pnr.number")}
          <input
            value={pnr}
            onChange={(e) => setPnr(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            placeholder={t("pnr.placeholder")}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading && !preview ? t("pnr.searching") : t("pnr.find")}
        </button>
      </form>

      {error && <div className="alert error" role="alert">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {booking && (
        <div className={`confirmation-card lookup-result status-${booking.status.toLowerCase()}`}>
          <div className="pnr-header">
            <div>
              <p className="eyebrow">{t("pnr.pnr")}</p>
              <p className="pnr-number">{booking.pnr}</p>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          <div className="confirmation-details">
            <span>{t("pnr.train")}</span>
            <strong>
              {booking.trainNumber} · {booking.trainName}
            </strong>
            <span>{t("common.route")}</span>
            <strong>
              {t("pnr.routeValue", {
                source: city(booking.source),
                destination: city(booking.destination),
              })}
            </strong>
            <span>{t("common.journeyDate")}</span>
            <strong>
              {booking.journeyDate?.slice(0, 10)} · {t("common.departs", { time: booking.departure })}
            </strong>
            <span>{t("common.class")}</span>
            <strong>{booking.travelClass}</strong>
            <span>{t("common.passengers")}</span>
            <strong>{booking.seatCount}</strong>
            <span>{t("pnr.amountPaid")}</span>
            <strong>{formatMoney(booking.payment?.amount ?? booking.totalAmount)}</strong>
            {booking.payment && (
              <>
                <span>{t("pnr.payment")}</span>
                <strong>
                  {booking.payment.method} · {booking.payment.maskedReference}
                  <br />
                  {t("pnr.ref", { id: booking.payment.paymentId })}
                </strong>
              </>
            )}
          </div>

          <h4>{t("pnr.passengerList")}</h4>
          {(booking.passengers || []).map((passenger, index) => (
            <p key={index}>
              {t("common.passengerLine", {
                index: index + 1,
                name: passenger.name,
                age: passenger.age,
                gender: t(`gender.${passenger.gender}`, undefined, passenger.gender),
              })}
            </p>
          ))}

          {booking.refund && (
            <div className="refund-box">
              <h4>{t("pnr.refundTitle")}</h4>
              <div className="confirmation-details">
                <span>{t("pnr.cancelledOn")}</span>
                <strong>{new Date(booking.cancelledAt).toLocaleString(lang)}</strong>
                <span>{t("pnr.refundStatus")}</span>
                <strong>
                  {booking.refund.status === "PROCESSED" ? t("pnr.refundProcessed") : t("pnr.noRefund")}
                </strong>
                <span>{t("pnr.refundAmount")}</span>
                <strong>
                  {formatMoney(booking.refund.amount)} ({booking.refund.percentage}%)
                </strong>
                <span>{t("pnr.charge")}</span>
                <strong>{formatMoney(booking.refund.deduction)}</strong>
                {booking.refund.status === "PROCESSED" && (
                  <>
                    <span>{t("pnr.refundRef")}</span>
                    <strong>{booking.refund.refundId}</strong>
                  </>
                )}
              </div>
            </div>
          )}

          {booking.status === "WAITLISTED" && (
            <div className="refund-box">
              <p>{t("pnr.waitlistNote")}</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate(`/waitlist?pnr=${booking.pnr}`)}
              >
                {t("pnr.monitor")}
              </button>
            </div>
          )}

          {(booking.status === "CONFIRMED" || booking.status === "WAITLISTED") && !preview && (
            <button
              type="button"
              className="danger-button"
              disabled={loading}
              onClick={startCancel}
            >
              {t("pnr.cancel")}
            </button>
          )}

          {preview && (
            <div className="refund-box warning">
              <h4>{t("pnr.confirmTitle")}</h4>
              <p>
                {t("pnr.confirmText", {
                  time: formatLeadTime(preview.hoursBeforeDeparture, t),
                  percentage: preview.percentage,
                })}
              </p>
              <div className="confirmation-details">
                <span>{t("pnr.ticketAmount")}</span>
                <strong>{formatMoney(preview.totalAmount)}</strong>
                <span>{t("pnr.charge")}</span>
                <strong>{formatMoney(preview.deduction)}</strong>
                <span>{t("pnr.willReceive")}</span>
                <strong>{formatMoney(preview.refundAmount)}</strong>
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className="danger-button"
                  disabled={loading}
                  onClick={confirmCancel}
                >
                  {loading ? t("pnr.cancelling") : t("pnr.yesCancel")}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={loading}
                  onClick={() => setPreview(null)}
                >
                  {t("pnr.keep")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
