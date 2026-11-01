import { useState } from "react";
import { formatMoney } from "../api";
import BookingSummary from "../components/BookingSummary";
import { ProgressSteps } from "../components/Layout";
import { useBooking } from "../useBooking";
import { navigate } from "../router";
import { useI18n } from "../i18n/useI18n";

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
  const { t } = useI18n();
  const { booking, loading, error } = useBooking(bookingId);
  const [copyState, setCopyState] = useState("");

  async function copyPnr() {
    const ok = await copyText(booking.pnr);
    setCopyState(ok ? t("confirm.copied") : t("confirm.copyFailed"));
    setTimeout(() => setCopyState(""), 3000);
  }

  let body;
  if (loading) {
    body = (
      <div className="empty-state" role="status">
        <div className="spinner" aria-hidden="true" />
        <p>{t("common.loadingBooking")}</p>
      </div>
    );
  } else if (error || !booking) {
    body = (
      <div className="empty-state">
        <h3>{t("common.bookingNotFound")}</h3>
        <p>{error || t("common.couldNotLoad")}</p>
        <button className="primary-button" type="button" onClick={onBookAgain}>{t("common.searchTrains")}</button>
      </div>
    );
  } else if (booking.status === "PENDING_PAYMENT") {
    body = (
      <div className="empty-state">
        <h3>{t("confirm.notPaid")}</h3>
        <p>{t("confirm.notPaidText")}</p>
        <button className="primary-button" type="button" onClick={() => navigate(`/payment/${booking._id}`)}>
          {t("confirm.goToPayment")}
        </button>
      </div>
    );
  } else if (!["CONFIRMED", "CANCELLED", "WAITLISTED"].includes(booking.status)) {
    body = (
      <div className="empty-state">
        <h3>
          {t("confirm.otherStatus", {
            status: t(`status.${booking.status}`, undefined, booking.status.toLowerCase()),
          })}
        </h3>
        <p>{t("confirm.otherStatusText")}</p>
        <button className="primary-button" type="button" onClick={onBookAgain}>{t("common.searchTrains")}</button>
      </div>
    );
  } else if (!booking.pnr) {
    body = (
      <div className="empty-state">
        <h3>{t("confirm.noPnr")}</h3>
        <p>{t("confirm.noPnrText")}</p>
      </div>
    );
  } else {
    const isCancelled = booking.status === "CANCELLED";
    const isWaitlisted = booking.status === "WAITLISTED";
    const bannerClass = isCancelled ? "cancelled" : isWaitlisted ? "waitlisted" : "";

    body = (
      <section className="ticket-card status-confirmed-card" aria-labelledby="confirm-title">
        <div className={`ticket-banner ${bannerClass}`}>
          <span className="success-icon" aria-hidden="true">
            {isCancelled ? "✕" : isWaitlisted ? "⏳" : "✓"}
          </span>
          <div>
            <h2 id="confirm-title">
              {isCancelled
                ? t("confirm.cancelledTitle")
                : isWaitlisted
                  ? t("confirm.waitlistTitle")
                  : t("confirm.title")}
            </h2>
            <p>
              {isCancelled
                ? t("confirm.cancelledText")
                : isWaitlisted
                  ? t("confirm.waitlistText")
                  : t("confirm.text")}
            </p>
          </div>
        </div>

        <div className="pnr-block">
          <div>
            <p className="eyebrow">{t("confirm.yourPnr")}</p>
            <p className="pnr-number big" aria-label={t("confirm.pnrAria", { digits: booking.pnr.split("").join(" ") })}>{booking.pnr}</p>
          </div>
          <button type="button" className="secondary-button" onClick={copyPnr}>{t("confirm.copyPnr")}</button>
        </div>
        <p className="copy-status" role="status">{copyState}</p>

        <BookingSummary booking={booking} />

        <h4>{t("confirm.passengers", { count: booking.seatCount })}</h4>
        <ul className="passenger-list">
          {(booking.passengers || []).map((p, i) => (
            <li key={i}>
              {t("common.passengerLine", {
                index: i + 1,
                name: p.name,
                age: p.age,
                gender: t(`gender.${p.gender}`, undefined, p.gender),
              })}
            </li>
          ))}
        </ul>

        <div className="confirmation-details">
          <span>{t("confirm.amountPaid")}</span>
          <strong>{formatMoney(booking.payment?.amount ?? booking.totalAmount)}</strong>
          {booking.payment && (
            <>
              <span>{t("confirm.method")}</span>
              <strong>{booking.payment.method} · {booking.payment.maskedReference}</strong>
              <span>{t("confirm.reference")}</span>
              <strong>{booking.payment.paymentId}</strong>
              <span>{t("confirm.paymentStatus")}</span>
              <strong>
                {t(`paymentStatus.${booking.payment.status}`, undefined, booking.payment.status)}
              </strong>
            </>
          )}
          <span>{t("confirm.bookingStatus")}</span>
          <strong>{t(`status.${booking.status}`, undefined, booking.status)}</strong>
        </div>

        <div className="button-row">
          {isWaitlisted && (
            <button type="button" className="primary-button" onClick={() => navigate(`/waitlist?pnr=${booking.pnr}`)}>
              {t("confirm.monitor")}
            </button>
          )}
          <button
            type="button"
            className={isWaitlisted ? "secondary-button" : "primary-button"}
            onClick={() => navigate(`/pnr?pnr=${booking.pnr}`)}
          >
            {t("confirm.manage")}
          </button>
          <button type="button" className="secondary-button" onClick={onBookAgain}>
            {t("confirm.another")}
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
