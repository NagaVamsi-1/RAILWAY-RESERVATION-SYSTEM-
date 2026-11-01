import { useState } from "react";
import PaymentPanel from "../components/PaymentPanel";
import BookingSummary from "../components/BookingSummary";
import { ProgressSteps } from "../components/Layout";
import { useBooking } from "../useBooking";
import { navigate } from "../router";
import { useI18n } from "../i18n/useI18n";

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
  const { t } = useI18n();
  const { booking, loading, error, reload } = useBooking(bookingId);
  const [paidMessage, setPaidMessage] = useState("");

  const searchAgain = (
    <button className="primary-button" type="button" onClick={onBookAgain}>
      {t("common.searchAndBookAgain")}
    </button>
  );

  function handlePaid(confirmed, message) {
    // Only proceed if the backend returned a confirmed (or, for a waitlist booking,
    // waitlisted) booking with a PNR.
    if (
      (confirmed?.status === "CONFIRMED" || confirmed?.status === "WAITLISTED") &&
      confirmed?.pnr
    ) {
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
        <p>{t("common.loadingBooking")}</p>
      </div>
    );
  } else if (error || !booking) {
    body = (
      <Notice title={t("common.bookingNotFound")} action={searchAgain}>
        {error || t("common.couldNotLoad")}
      </Notice>
    );
  } else if (booking.status === "CONFIRMED" || booking.status === "WAITLISTED") {
    body = (
      <Notice
        title={t("paymentPage.alreadyPaid")}
        action={
          <button className="primary-button" type="button" onClick={() => navigate(`/confirmation/${booking._id}`)}>
            {t("paymentPage.viewConfirmation")}
          </button>
        }
      >
        {booking.status === "WAITLISTED"
          ? t("paymentPage.onWaitlistText")
          : t("paymentPage.alreadyPaidText")}
      </Notice>
    );
  } else if (booking.status === "EXPIRED") {
    body = (
      <Notice title={t("paymentPage.expired")} action={searchAgain}>
        {t("paymentPage.expiredText")}
      </Notice>
    );
  } else if (booking.status === "CANCELLED") {
    body = (
      <Notice title={t("paymentPage.cancelled")} action={searchAgain}>
        {t("paymentPage.cancelledText")}
      </Notice>
    );
  } else {
    body = (
      <section className="content-section booking-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("paymentPage.eyebrow")}</p>
            <h2>{t("paymentPage.title")}</h2>
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
          {t(booking.isWaitlist ? "paymentPage.leaveHintWaitlist" : "paymentPage.leaveHint")}
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
